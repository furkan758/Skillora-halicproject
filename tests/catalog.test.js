import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { installDemoApi } from "../src/mockDatas/demoApi.ts";
import {
  initialEmployees,
  initialFolders,
  initialSkillCatalog,
} from "../src/mockDatas/data.ts";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
}
function fixture(storage = memoryStorage()) {
  const api = axios.create();
  installDemoApi(api, { storage, delay: 0 });
  return {
    api,
    storage,
    catalog: async () => (await api.get("/skill-catalog")).data,
    employees: async () => (await api.get("/employees")).data,
  };
}

test("assigned skill deletion returns a warning and changes no employee records", async () => {
  const f = fixture();
  const react = (await f.catalog()).skills.find((s) => s.name === "React");
  const before = await f.employees();
  await assert.rejects(f.api.delete(`/skills/${react.id}`), (error) => {
    assert.equal(error.response.status, 409);
    assert.deepEqual(
      error.response.data.affectedEmployees.map((e) => e.id),
      initialEmployees
        .filter((e) => Object.hasOwn(e.skills, "React"))
        .map((e) => e.id),
    );
    return true;
  });
  assert.deepEqual(await f.employees(), before);
  assert.ok((await f.catalog()).skills.some((s) => s.id === react.id));
});

test("confirmed deletion removes only the selected skill and stays deleted after reload", async () => {
  const f = fixture();
  const react = (await f.catalog()).skills.find((s) => s.name === "React");
  const { data } = await f.api.delete(`/skills/${react.id}`, {
    data: { confirmAssignedRemoval: true },
  });
  assert.equal(data.deletedSkill, "React");
  assert.ok(data.employees.every((e) => !Object.hasOwn(e.skills, "React")));
  assert.equal(data.employees[0].skills.TypeScript, 5);
  const reloaded = fixture(f.storage);
  assert.ok(!(await reloaded.catalog()).skills.some((s) => s.name === "React"));
  assert.ok(
    (await reloaded.employees()).every(
      (e) => !Object.hasOwn(e.skills, "React"),
    ),
  );
});

test("new skills exist without assignees and duplicate names are rejected", async () => {
  const f = fixture();
  await f.api.post("/skills", {
    name: "  Demo Integration  ",
    folderId: "backend",
  });
  const skill = (await f.catalog()).skills.find(
    (s) => s.name === "Demo Integration",
  );
  assert.ok(skill);
  assert.ok(
    (await f.employees()).every(
      (e) => !Object.hasOwn(e.skills, "Demo Integration"),
    ),
  );
  await assert.rejects(
    f.api.post("/skills", { name: " demo integration ", folderId: "frontend" }),
    (error) => error.response.status === 400,
  );
  await assert.rejects(
    f.api.post("/skills", { name: "   ", folderId: "frontend" }),
    (error) => error.response.status === 400,
  );
  await f.api.delete(`/skills/${skill.id}`);
  assert.ok(!(await f.catalog()).skills.some((s) => s.id === skill.id));
});

test("moving JavaScript to another folder preserves every employee and proficiency", async () => {
  const f = fixture();
  const before = await f.employees();
  const skill = (await f.catalog()).skills.find((s) => s.name === "JavaScript");
  assert.equal(skill.folderId, "frontend");
  await f.api.put(`/skills/${skill.id}`, { ...skill, folderId: "backend" });
  assert.equal(
    (await f.catalog()).skills.find((s) => s.id === skill.id).folderId,
    "backend",
  );
  assert.deepEqual(await f.employees(), before);
});

test("renaming a skill keeps the same proficiency and employee assignments", async () => {
  const f = fixture();
  const skill = (await f.catalog()).skills.find((s) => s.name === "React");
  const { data } = await f.api.put(`/skills/${skill.id}`, {
    ...skill,
    name: "React.js",
  });
  assert.deepEqual(data.renamedSkill, { from: "React", to: "React.js" });
  assert.equal(data.employees[0].skills["React.js"], 5);
  assert.equal(data.employees[2].skills["React.js"], 4);
  assert.equal(data.employees[5].skills["React.js"], 4);
  assert.ok(data.employees.every((e) => !Object.hasOwn(e.skills, "React")));
});

test("folder creation, rename and deletion preserve contained skills in Unsorted", async () => {
  const f = fixture();
  await f.api.post("/skill-folders", { name: "Data Science" });
  const folder = (await f.catalog()).folders.find(
    (f) => f.name === "Data Science",
  );
  await f.api.put(`/skill-folders/${folder.id}`, { name: "Analytics" });
  assert.equal(
    (await f.catalog()).folders.find((f) => f.id === folder.id).name,
    "Analytics",
  );
  await assert.rejects(
    f.api.post("/skill-folders", { name: "ANALYTICS" }),
    (error) => error.response.status === 400,
  );
  const python = (await f.catalog()).skills.find((s) => s.name === "Python");
  await f.api.put(`/skills/${python.id}`, { ...python, folderId: folder.id });
  const before = await f.employees();
  await f.api.delete(`/skill-folders/${folder.id}`);
  assert.equal(
    (await f.catalog()).skills.find((s) => s.id === python.id).folderId,
    "unsorted",
  );
  assert.deepEqual(await f.employees(), before);
  await assert.rejects(
    f.api.delete("/skill-folders/unsorted"),
    (error) => error.response.status === 400,
  );
});

test("upgrading legacy browser data preserves custom employee skills", async () => {
  const employees = structuredClone(initialEmployees);
  employees[0].skills["Legacy Framework"] = 4;
  const f = fixture(
    memoryStorage({ "skillora-employees": JSON.stringify(employees) }),
  );
  assert.equal(
    (await f.catalog()).skills.find((s) => s.name === "Legacy Framework")
      .folderId,
    "unsorted",
  );
  assert.equal((await f.employees())[0].skills["Legacy Framework"], 4);
});

test("deleted skills cannot be reintroduced by employee saves or scenario evaluation", async () => {
  const f = fixture();
  const skill = (await f.catalog()).skills.find((s) => s.name === "React");
  await f.api.delete(`/skills/${skill.id}`, {
    data: { confirmAssignedRemoval: true },
  });
  await assert.rejects(
    f.api.put("/employees/1", initialEmployees[0]),
    (error) => error.response.status === 400,
  );
  await assert.rejects(
    f.api.post("/scenarios/evaluate", {
      criteria: [{ skill: "React", weight: 5 }],
      onlyAvailable: false,
    }),
    (error) => error.response.status === 400,
  );
});

test("Redux synchronizes renames/deletions with profiles and current scenario criteria", async () => {
  const { api } = await import("../src/api.ts");
  const {
    makeStore,
    fetchEmployees,
    saveSkill,
    deleteSkill,
    evaluateScenario,
  } = await import("../src/reduxToolKit/store.ts");
  installDemoApi(api, { storage: memoryStorage(), delay: 0 });
  const store = makeStore();
  await store.dispatch(fetchEmployees()).unwrap();
  const skill = store.getState().catalog.skills.find((s) => s.name === "React");
  await store.dispatch(saveSkill({ ...skill, name: "React.js" })).unwrap();
  assert.ok(
    store.getState().scenario.criteria.some((c) => c.skill === "React.js"),
  );
  assert.equal(store.getState().employees.items[0].skills["React.js"], 5);
  await store.dispatch(evaluateScenario()).unwrap();
  assert.equal(store.getState().scenario.results[0].score, 100);
  await store
    .dispatch(deleteSkill({ id: skill.id, confirmAssignedRemoval: true }))
    .unwrap();
  assert.ok(
    !store.getState().scenario.criteria.some((c) => c.skill === "React.js"),
  );
  assert.deepEqual(store.getState().scenario.results, []);
  assert.equal(store.getState().scenario.status, "idle");
  assert.ok(
    store
      .getState()
      .employees.items.every((e) => !Object.hasOwn(e.skills, "React.js")),
  );
});

test("expanded mock data has unique identities, valid skill references and proficiency levels", () => {
  assert.equal(
    new Set(initialEmployees.map((e) => e.id)).size,
    initialEmployees.length,
  );
  assert.equal(
    new Set(initialFolders.map((f) => f.id)).size,
    initialFolders.length,
  );
  assert.equal(
    new Set(initialSkillCatalog.map((s) => s.id)).size,
    initialSkillCatalog.length,
  );
  assert.equal(
    new Set(initialSkillCatalog.map((s) => s.name.toLowerCase())).size,
    initialSkillCatalog.length,
  );
  for (const skill of initialSkillCatalog)
    assert.ok(
      initialFolders.some((f) => f.id === skill.folderId),
      `Orphaned skill: ${skill.name}`,
    );
  for (const employee of initialEmployees) {
    for (const [name, level] of Object.entries(employee.skills)) {
      assert.ok(
        initialSkillCatalog.some((s) => s.name === name),
        `Unknown skill ${name} on ${employee.name}`,
      );
      assert.ok(Number.isInteger(level) && level >= 1 && level <= 5);
    }
  }
});

test("expansion preserves old edits, deleted skills and existing folders with matching names", async () => {
  const employees = structuredClone(initialEmployees.slice(0, 6));
  employees[0].role = "Custom role";
  employees[0].skills.JavaScript = 2;
  employees.forEach((e) => {
    delete e.skills.Git;
  });
  const originalFolderIds = [
    "frontend",
    "backend",
    "design",
    "management",
    "devops",
    "unsorted",
  ];
  const folders = structuredClone(
    initialFolders.filter((f) => originalFolderIds.includes(f.id)),
  );
  folders.find((f) => f.id === "frontend").name = "Web UI";
  folders.push({ id: "custom-mobile", name: "Mobile", color: "blue" });
  const skills = structuredClone(
    initialSkillCatalog.filter(
      (s) => s.id.startsWith("skill-") && s.name !== "Git",
    ),
  );
  skills.push({
    id: "custom-react-native",
    name: "React Native",
    folderId: "custom-mobile",
  });
  const storage = memoryStorage({
    "skillora-workspace-v2": JSON.stringify({
      employees,
      catalog: { folders, skills },
    }),
  });
  const f = fixture(storage);
  const upgradedEmployees = await f.employees();
  const upgraded = await f.catalog();
  assert.equal(upgradedEmployees.length, initialEmployees.length);
  assert.equal(upgradedEmployees[0].role, "Custom role");
  assert.equal(upgradedEmployees[0].skills.JavaScript, 2);
  assert.equal(
    upgraded.folders.find((f) => f.id === "frontend").name,
    "Web UI",
  );
  assert.equal(upgraded.folders.filter((f) => f.name === "Mobile").length, 1);
  assert.equal(
    upgraded.skills.find((s) => s.name === "Swift").folderId,
    "custom-mobile",
  );
  assert.equal(
    upgraded.skills.find((s) => s.name === "React Native").id,
    "custom-react-native",
  );
  assert.ok(!upgraded.skills.some((s) => s.name === "Git"));
  assert.ok(upgradedEmployees.every((e) => !Object.hasOwn(e.skills, "Git")));
  const svelte = upgraded.skills.find((s) => s.name === "Svelte");
  await f.api.delete(`/skills/${svelte.id}`);
  await f.api.delete("/skill-folders/cloud");
  const reloaded = fixture(storage);
  assert.ok(
    !(await reloaded.catalog()).skills.some((s) => s.name === "Svelte"),
  );
  assert.ok(!(await reloaded.catalog()).folders.some((f) => f.id === "cloud"));
  assert.equal((await reloaded.employees()).length, initialEmployees.length);
});
