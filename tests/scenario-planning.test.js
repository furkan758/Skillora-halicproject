import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { installDemoApi } from "../src/mockDatas/demoApi.ts";
import {
  initialEmployees,
  initialSkillCatalog,
} from "../src/mockDatas/data.ts";
import {
  allocationError,
  skillCandidates,
  teamSummary,
  uniqueScenarioTitle,
} from "../src/Scenario/scenarioModel.ts";

const draft = {
  client: "OpenAI",
  title: "Team project",
  description: "A new website.",
  headcount: 3,
  requirements: [
    { skill: "React", count: 2 },
    { skill: "Figma", count: 1 },
  ],
  onlyAvailable: false,
};
const selections = { React: [1, 6], Figma: [2] };
function storage() {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) || null,
    setItem: (key, value) => map.set(key, value),
  };
}
function fixture(saved = storage()) {
  const api = axios.create();
  installDemoApi(api, { storage: saved, delay: 0 });
  return { api, storage: saved };
}

test("headcount must equal the sum of positive, whole-number skill allocations", () => {
  assert.equal(allocationError(draft, initialSkillCatalog), "");
  assert.match(
    allocationError({ ...draft, headcount: 5 }, initialSkillCatalog),
    /2 more/,
  );
  assert.match(
    allocationError({ ...draft, headcount: 2 }, initialSkillCatalog),
    /too many/,
  );
  assert.match(
    allocationError(
      { ...draft, requirements: [{ skill: "React", count: 1.5 }] },
      initialSkillCatalog,
    ),
    /at least one/,
  );
  assert.match(
    allocationError(
      {
        ...draft,
        requirements: [
          { skill: "React", count: 1 },
          { skill: "React", count: 2 },
        ],
      },
      initialSkillCatalog,
    ),
    /only once/,
  );
});

test("candidates are ranked by the individual required skill and missing skills are excluded", () => {
  const groups = skillCandidates(initialEmployees, draft.requirements, true);
  for (const group of groups) {
    assert.ok(
      group.candidates.every(
        (c) => c.employee.available && c.employee.skills[group.skill] > 0,
      ),
    );
    assert.ok(
      group.candidates.every(
        (c, i, list) => !i || list[i - 1].score >= c.score,
      ),
    );
  }
  assert.equal(
    groups.find((g) => g.skill === "Figma").candidates[0].employee.id,
    2,
  );
  assert.equal(
    groups.find((g) => g.skill === "React").candidates[0].employee.id,
    1,
  );
});

test("overall compatibility averages people, rather than averaging skill groups equally", () => {
  const summary = teamSummary(
    draft,
    selections,
    initialEmployees,
    initialSkillCatalog,
  );
  assert.equal(summary.averageScore, 93);
  assert.deepEqual(
    summary.groups.map((g) => g.averageScore),
    [90, 100],
  );
  assert.notEqual(summary.averageScore, 95);
  assert.equal(summary.groups.flatMap((g) => g.members).length, 3);
});

test("incomplete teams and duplicate people cannot produce a valid summary", () => {
  assert.throws(
    () =>
      teamSummary(
        draft,
        { React: [1], Figma: [2] },
        initialEmployees,
        initialSkillCatalog,
      ),
    /exactly 2/,
  );
  const shared = {
    ...draft,
    headcount: 2,
    requirements: [
      { skill: "React", count: 1 },
      { skill: "TypeScript", count: 1 },
    ],
  };
  assert.throws(
    () =>
      teamSummary(
        shared,
        { React: [1], TypeScript: [1] },
        initialEmployees,
        initialSkillCatalog,
      ),
    /only one place/,
  );
  assert.throws(
    () =>
      teamSummary(
        draft,
        { React: [1, 4], Figma: [2] },
        initialEmployees,
        initialSkillCatalog,
      ),
    /no longer has React/,
  );
});

test("duplicate titles get unique numbered suffixes, including case and whitespace collisions", () => {
  const scenarios = [
    { title: "Website" },
    { title: "Website (2)" },
    { title: "Website (3)" },
  ];
  assert.equal(uniqueScenarioTitle(" Website ", scenarios), "Website (4)");
  assert.equal(uniqueScenarioTitle("website", scenarios), "website (4)");
  assert.equal(uniqueScenarioTitle("API", scenarios), "API");
});

test("Axios scenario saves persist snapshots and distinguish projects with identical titles", async () => {
  const f = fixture();
  const candidates = await f.api.post("/scenarios/candidates", draft);
  assert.equal(candidates.data.length, 2);
  const first = (await f.api.post("/scenarios", { draft, selections })).data;
  const second = (await f.api.post("/scenarios", { draft, selections })).data;
  const third = (await f.api.post("/scenarios", { draft, selections })).data;
  assert.deepEqual(
    [first.title, second.title, third.title],
    ["Team project", "Team project (2)", "Team project (3)"],
  );
  assert.equal(first.summary.averageScore, 93);
  await f.api.put("/employees/1", {
    ...initialEmployees[0],
    skills: { ...initialEmployees[0].skills, React: 1 },
  });
  const reloaded = fixture(f.storage);
  const saved = (await reloaded.api.get("/scenarios")).data;
  assert.equal(saved.length, 3);
  assert.equal(saved.find((s) => s.id === first.id).summary.averageScore, 93);
  assert.equal(
    saved.find((s) => s.id === first.id).summary.groups[0].members[0].level,
    5,
  );
});

test("invalid or reused selections are rejected without creating a saved scenario", async () => {
  const { api } = fixture();
  await assert.rejects(
    api.post("/scenarios", { draft, selections: { React: [1], Figma: [2] } }),
    (e) => e.response.status === 400,
  );
  const shared = {
    ...draft,
    headcount: 2,
    requirements: [
      { skill: "React", count: 1 },
      { skill: "TypeScript", count: 1 },
    ],
  };
  await assert.rejects(
    api.post("/scenarios", {
      draft: shared,
      selections: { React: [1], TypeScript: [1] },
    }),
    (e) => e.response.status === 400,
  );
  assert.equal((await api.get("/scenarios")).data.length, 0);
});

test("Redux keeps selections unique, saves the team, and invalidates stale choices after skill edits", async () => {
  const { api } = await import("../src/api.ts");
  const { makeStore, fetchEmployees, deleteSkill } =
    await import("../src/reduxToolKit/store.ts");
  const {
    startScenario,
    findScenarioCandidates,
    toggleCandidate,
    savePlannedScenario,
  } = await import("../src/reduxToolKit/scenarioPlanningSlice.ts");
  installDemoApi(api, { storage: storage(), delay: 0 });
  const store = makeStore();
  await store.dispatch(fetchEmployees()).unwrap();
  store.dispatch(
    startScenario({
      ...draft,
      headcount: 2,
      requirements: [
        { skill: "React", count: 1 },
        { skill: "TypeScript", count: 1 },
      ],
    }),
  );
  await store.dispatch(findScenarioCandidates()).unwrap();
  assert.equal(store.getState().planning.step, 2);
  store.dispatch(toggleCandidate({ skill: "React", employeeId: 1 }));
  store.dispatch(toggleCandidate({ skill: "TypeScript", employeeId: 1 }));
  assert.deepEqual(store.getState().planning.selections, { React: [1] });
  store.dispatch(toggleCandidate({ skill: "TypeScript", employeeId: 3 }));
  const record = await store.dispatch(savePlannedScenario()).unwrap();
  assert.equal(record.summary.averageScore, 90);
  assert.equal(store.getState().planning.activeSavedId, record.id);
  const skill = store.getState().catalog.skills.find((s) => s.name === "React");
  await store
    .dispatch(deleteSkill({ id: skill.id, confirmAssignedRemoval: true }))
    .unwrap();
  assert.deepEqual(store.getState().planning.selections, {});
  assert.equal(store.getState().planning.step, 1);
  assert.equal(store.getState().planning.saved[0].summary.averageScore, 90);
});

test("updating a saved scenario preserves its identity, suffix and creation date across reloads", async () => {
  const f = fixture();
  const first = (await f.api.post("/scenarios", { draft, selections })).data;
  const second = (await f.api.post("/scenarios", { draft, selections })).data;
  const changed = { ...draft, description: "Updated brief" };
  const updated = (
    await f.api.put(`/scenarios/${second.id}`, {
      draft: changed,
      selections: { React: [6, 7], Figma: [2] },
    })
  ).data;
  assert.equal(updated.id, second.id);
  assert.equal(updated.title, "Team project (2)");
  assert.equal(updated.createdAt, second.createdAt);
  assert.ok(updated.updatedAt);
  assert.equal(updated.summary.averageScore, 87);
  const saved = (await fixture(f.storage).api.get("/scenarios")).data;
  assert.equal(saved.length, 2);
  assert.deepEqual(
    saved.find((s) => s.id === first.id),
    first,
  );
  assert.equal(
    saved.find((s) => s.id === second.id).description,
    "Updated brief",
  );
  assert.equal(saved.find((s) => s.id === second.id).summary.averageScore, 87);
  const renamed = (
    await f.api.put(`/scenarios/${first.id}`, {
      draft: { ...draft, title: "Team project (2)" },
      selections,
    })
  ).data;
  assert.equal(renamed.title, "Team project (2) (2)");
});

test("invalid updates and missing IDs leave the original saved snapshot intact", async () => {
  const { api } = fixture();
  const saved = (await api.post("/scenarios", { draft, selections })).data;
  await assert.rejects(
    api.put(`/scenarios/${saved.id}`, {
      draft,
      selections: { React: [1], Figma: [2] },
    }),
    (e) => e.response.status === 400,
  );
  await assert.rejects(
    api.put("/scenarios/missing", { draft, selections }),
    (e) => e.response.status === 404,
  );
  assert.deepEqual((await api.get("/scenarios")).data, [saved]);
});

test("reopening prior steps restores quotas and selections, cancels safely and updates the same record", async () => {
  const { api } = await import("../src/api.ts");
  const { makeStore, fetchEmployees } =
    await import("../src/reduxToolKit/store.ts");
  const actions = await import("../src/reduxToolKit/scenarioPlanningSlice.ts");
  installDemoApi(api, { storage: storage(), delay: 0 });
  const store = makeStore();
  await store.dispatch(fetchEmployees()).unwrap();
  const saved = (await api.post("/scenarios", { draft, selections })).data;
  await store.dispatch(actions.fetchSavedScenarios()).unwrap();
  store.dispatch(actions.openSavedScenario(saved.id));
  store.dispatch(actions.editSavedScenario(saved.id));
  assert.equal(store.getState().planning.step, 1);
  assert.deepEqual(store.getState().planning.draft, draft);
  assert.deepEqual(store.getState().planning.selections, selections);
  await store.dispatch(actions.findScenarioCandidates()).unwrap();
  assert.equal(store.getState().planning.step, 2);
  assert.deepEqual(store.getState().planning.selections, selections);
  store.dispatch(actions.setPlanningStep(1));
  store.dispatch(
    actions.setDraftField({ field: "description", value: "Unsaved change" }),
  );
  assert.equal(
    store.getState().planning.saved[0].description,
    draft.description,
  );
  store.dispatch(actions.openSavedScenario(saved.id));
  assert.equal(store.getState().planning.editingScenarioId, null);
  store.dispatch(actions.editSavedScenario(saved.id));
  assert.equal(store.getState().planning.draft.description, draft.description);
  await store.dispatch(actions.findScenarioCandidates()).unwrap();
  store.dispatch(actions.toggleCandidate({ skill: "React", employeeId: 1 }));
  store.dispatch(actions.toggleCandidate({ skill: "React", employeeId: 7 }));
  await store.dispatch(actions.savePlannedScenario()).unwrap();
  assert.equal(store.getState().planning.saved.length, 1);
  assert.equal(store.getState().planning.saved[0].id, saved.id);
  assert.equal(store.getState().planning.saved[0].summary.averageScore, 87);
  assert.equal(store.getState().planning.editingScenarioId, null);
});

test("restored teams drop ineligible people and ignore candidate responses after switching scenarios", async () => {
  const { api } = await import("../src/api.ts");
  const { makeStore, fetchEmployees } =
    await import("../src/reduxToolKit/store.ts");
  const actions = await import("../src/reduxToolKit/scenarioPlanningSlice.ts");
  installDemoApi(api, { storage: storage(), delay: 0 });
  const store = makeStore();
  await store.dispatch(fetchEmployees()).unwrap();
  const saved = (await api.post("/scenarios", { draft, selections })).data;
  await store.dispatch(actions.fetchSavedScenarios()).unwrap();
  await api.put("/employees/1", {
    ...initialEmployees[0],
    skills: { ...initialEmployees[0].skills, React: 0 },
  });
  await store.dispatch(fetchEmployees()).unwrap();
  store.dispatch(actions.editSavedScenario(saved.id));
  await store.dispatch(actions.findScenarioCandidates()).unwrap();
  assert.deepEqual(store.getState().planning.selections, {
    React: [6],
    Figma: [2],
  });
  assert.match(store.getState().planning.notice, /no longer eligible/);
  assert.deepEqual(store.getState().planning.saved[0], saved);
  const request = store.dispatch(actions.findScenarioCandidates());
  store.dispatch(actions.openSavedScenario(saved.id));
  await request;
  assert.equal(store.getState().planning.step, 3);
  assert.equal(store.getState().planning.status, "idle");
  assert.deepEqual(store.getState().planning.candidates, []);
});
