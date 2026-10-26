import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { installDemoApi } from "../src/mockDatas/demoApi.ts";
import {
  initialEmployees,
  initialFolders,
  initialSkillCatalog,
} from "../src/mockDatas/data.ts";
import { normalizeEmployee } from "../src/skillsToEmp/employeeProfile.ts";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

function fixture(storage = memoryStorage()) {
  const api = axios.create();
  installDemoApi(api, { storage, delay: 0 });
  return { api, storage };
}

test("legacy employee names split without changing existing profile details or assuming gender", () => {
  const { firstName, lastName, gender, ...legacy } = initialEmployees[0];
  const migrated = normalizeEmployee({ ...legacy, name: "Alex Jamie Morgan" });
  assert.equal(migrated.firstName, "Alex Jamie");
  assert.equal(migrated.lastName, "Morgan");
  assert.equal(migrated.gender, "Not specified");
  assert.deepEqual(migrated.skills, legacy.skills);
  assert.equal(migrated.department, legacy.department);
  assert.equal(migrated.available, legacy.available);
  const singleName = normalizeEmployee({ ...legacy, name: "Alex" });
  assert.equal(singleName.firstName, "Alex");
  assert.equal(singleName.lastName, "");
});

test("employee demo records include the new table fields and do not include a hire date", () => {
  for (const employee of initialEmployees) {
    assert.equal(employee.name, `${employee.firstName} ${employee.lastName}`);
    assert.ok(employee.gender);
    assert.ok(!("hireDate" in employee));
  }
});

test("existing browser profiles migrate idempotently while keeping custom edits", async () => {
  const { firstName, lastName, gender, ...legacy } = initialEmployees[0];
  const saved = memoryStorage({
    "skillora-workspace-v2": JSON.stringify({
      employees: [
        {
          ...legacy,
          name: "Alex Morgan",
          available: false,
          experience: 11,
          gender: "Non-binary",
        },
      ],
      catalog: { folders: initialFolders, skills: initialSkillCatalog },
      seedRevision: 1,
    }),
  });
  const first = (await fixture(saved).api.get("/employees")).data[0];
  assert.equal(first.firstName, "Alex");
  assert.equal(first.lastName, "Morgan");
  assert.equal(first.gender, "Not specified");
  assert.equal(first.available, false);
  assert.equal(first.experience, 11);
  assert.deepEqual(first.skills, legacy.skills);
  assert.deepEqual((await fixture(saved).api.get("/employees")).data[0], first);
});

test("separate names and gender persist after editing without changing compatibility scores", async () => {
  const { api, storage } = fixture();
  const criteria = {
    criteria: [{ skill: "React", weight: 5 }],
    onlyAvailable: false,
  };
  const scores = (await api.post("/scenarios/evaluate", criteria)).data;
  const { data: employee } = await api.put("/employees/1", {
    ...initialEmployees[0],
    firstName: "Alex Jamie",
    lastName: "van Morgan",
    name: "Alex Jamie van Morgan",
    gender: "Male",
  });
  assert.equal(employee.firstName, "Alex Jamie");
  assert.equal(employee.lastName, "van Morgan");
  assert.equal(employee.gender, "Male");
  const reloaded = (await fixture(storage).api.get("/employees")).data.find(
    (e) => e.id === 1,
  );
  assert.deepEqual(reloaded, employee);
  const updatedScores = (await api.post("/scenarios/evaluate", criteria)).data;
  for (const previous of scores)
    assert.equal(
      updatedScores.find((next) => next.employee.id === previous.employee.id)
        .score,
      previous.score,
    );
});

test("saved demo genders are assigned once without overwriting custom profiles or later administrator choices", async () => {
  const demoFemale = {
    ...initialEmployees[0],
    gender: "Not specified",
    available: false,
    experience: 12,
  };
  const demoMale = { ...initialEmployees[1], gender: "Not specified" };
  const custom = {
    ...initialEmployees[2],
    id: 1001,
    name: "Alex Morgan",
    firstName: "Alex",
    lastName: "Morgan",
    gender: "Not specified",
  };
  const chosen = { ...initialEmployees[3], gender: "Prefer not to say" };
  const storage = memoryStorage({
    "skillora-workspace-v2": JSON.stringify({
      employees: [demoFemale, demoMale, custom, chosen],
      catalog: { folders: initialFolders, skills: initialSkillCatalog },
      seedRevision: 1,
    }),
  });
  const { api } = fixture(storage);
  const employees = (await api.get("/employees")).data;
  assert.equal(employees[0].gender, "Female");
  assert.equal(employees[1].gender, "Male");
  assert.equal(employees[2].gender, "Not specified");
  assert.equal(employees[3].gender, "Prefer not to say");
  assert.equal(employees[0].available, false);
  assert.equal(employees[0].experience, 12);
  assert.deepEqual(employees[0].skills, demoFemale.skills);
  assert.equal(
    JSON.parse(storage.getItem("skillora-workspace-v2")).employeeGenderRevision,
    1,
  );
  await api.put("/employees/1", { ...employees[0], gender: "Not specified" });
  assert.equal(
    (await fixture(storage).api.get("/employees")).data[0].gender,
    "Not specified",
  );
});
