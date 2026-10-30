import test from "node:test";
import assert from "node:assert/strict";
import { AxiosError } from "axios";
import { api } from "../src/api.ts";
import {
  makeStore,
  fetchEmployees,
  saveEmployee,
  deleteSkill,
  setEmployeePage,
  setQuery,
  setDepartment,
} from "../src/reduxToolKit/store.ts";
import {
  startScenario,
  toggleCandidate,
  savePlannedScenario,
  setPlanningStep,
  editSavedScenario,
  openSavedScenario,
} from "../src/reduxToolKit/scenarioPlanningSlice.ts";
import { employeeInput } from "../src/skillsToEmp/employeeProfile.ts";
import {
  savedSummary,
  scenarioPayload,
  teamSummary,
} from "../src/Scenario/scenarioModel.ts";
const person = (id, level = 5) => ({
  id,
  version: "0x0000000000000001",
  firstName: "Person",
  lastName: String(id),
  name: "Person " + id,
  gender: "Not specified",
  departmentId: 1,
  department: "Engineering",
  jobTitle: "Developer",
  isAvailable: true,
  skills: [
    {
      skillId: 21,
      skillName: "React",
      folderId: 1,
      proficiencyLevel: level,
      experienceYears: 2.5,
    },
  ],
});
const candidate = (id, skillId = 21, level = 5) => ({
  employee: person(id, level),
  skillId,
  proficiencyLevel: level,
  compatibility: level * 20,
});
const paged = (items, total = items.length, page = 1) => ({
  items,
  total,
  page,
  pageSize: 15,
  totalPages: Math.ceil(total / 15),
});
const draft = {
  clientName: "Client",
  projectTitle: "Website",
  projectBrief: "",
  requiredPeople: 3,
  onlyAvailable: true,
  requirements: [
    { skillId: 21, count: 2 },
    { skillId: 29, count: 1 },
  ],
};
const record = {
  ...draft,
  id: 80,
  baseTitle: "Website",
  projectTitle: "Website (2)",
  status: "SAVED",
  version: 4,
  createdAt: "2026-10-30T12:00:00Z",
  updatedAt: "2026-10-30T12:00:00Z",
  selectedPeople: 3,
  averageCompatibility: 93,
  requirements: [
    { skillId: 21, count: 2, skillName: "React", isActive: true },
    { skillId: 29, count: 1, skillName: "Figma", isActive: true },
  ],
  assignments: [candidate(1), candidate(6, 21, 4), candidate(9, 29)].map(
    (c) => ({
      employeeId: c.employee.id,
      skillId: c.skillId,
      firstName: c.employee.firstName,
      lastName: c.employee.lastName,
      jobTitle: "Developer",
      department: "Engineering",
      proficiencyAtSelection: c.proficiencyLevel,
      compatibility: c.compatibility,
      selectedAt: "2026-10-30T12:00:00Z",
    }),
  ),
};
function adapter(handler) {
  api.defaults.adapter = async (config) => ({
    data: await handler(config),
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  });
}
test("employee requests use numeric department IDs, server envelopes and clamp a removed last page", async () => {
  const store = makeStore(),
    calls = [];
  store.dispatch(setEmployeePage(3));
  store.dispatch(setDepartment("2"));
  store.dispatch(setEmployeePage(3));
  adapter((config) => {
    calls.push(config.params);
    return paged(
      config.params.page === 2 ? [person(16)] : [],
      16,
      config.params.page,
    );
  });
  await store.dispatch(fetchEmployees()).unwrap();
  assert.deepEqual(
    calls.map((p) => p.page),
    [3, 2],
  );
  assert.equal(calls[0].departmentId, 2);
  assert.equal(store.getState().employees.page, 2);
  assert.equal(store.getState().employees.items[0].id, 16);
  const oldRequest = fetchEmployees.fulfilled(
    paged([person(99)]),
    "old-request",
    undefined,
  );
  store.dispatch(setQuery("New"));
  store.dispatch(oldRequest);
  assert.equal(store.getState().employees.query, "New");
  assert.equal(store.getState().employees.items[0].id, 16);
});
test("employee writes strip ID and display fields and retain unknown assessments", async () => {
  const store = makeStore();
  let body;
  const original = {
    ...person(4),
    skills: [
      { ...person(4).skills[0], proficiencyLevel: null, experienceYears: null },
    ],
  };
  adapter((config) => {
    if (config.method === "put") {
      body = JSON.parse(config.data);
      return original;
    }
    if (config.url === "/employees") return paged([original]);
    if (config.url === "/catalog") return { folders: [], skills: [] };
    if (config.url === "/departments") return [];
    return {
      employeeCount: 1,
      availableCount: 1,
      departmentCount: 1,
      skillCount: 1,
    };
  });
  await store.dispatch(saveEmployee(employeeInput(original))).unwrap();
  assert.equal(body.id, undefined);
  assert.equal(body.name, undefined);
  assert.equal(body.department, undefined);
  assert.equal(body.version, undefined);
  assert.equal(body.expectedVersion, original.version);
  assert.deepEqual(body.skills, [
    { skillId: 21, proficiencyLevel: null, experienceYears: null },
  ]);
});
test("selections survive pages, prevent duplicate people across skills and average people equally", () => {
  const store = makeStore();
  store.dispatch(startScenario(draft));
  store.dispatch(toggleCandidate({ skillId: 21, candidate: candidate(1) }));
  store.dispatch(
    toggleCandidate({ skillId: 21, candidate: candidate(6, 21, 4) }),
  );
  store.dispatch(toggleCandidate({ skillId: 29, candidate: candidate(1, 29) }));
  assert.equal(store.getState().planning.selections[29], undefined);
  store.dispatch(toggleCandidate({ skillId: 29, candidate: candidate(9, 29) }));
  store.dispatch(setPlanningStep(3));
  store.dispatch(setPlanningStep(1));
  store.dispatch(setPlanningStep(2));
  const selections = store.getState().planning.selections;
  assert.deepEqual(
    selections[21].map((c) => c.employee.id),
    [1, 6],
  );
  assert.equal(
    teamSummary(draft, selections, [
      { id: 21, name: "React" },
      { id: 29, name: "Figma" },
    ]).averageScore,
    93,
  );
  const payload = scenarioPayload(draft, selections, 4);
  assert.equal(payload.expectedVersion, 4);
  assert.equal(payload.assignments[1].employeeId, 6);
  assert.equal(payload.averageCompatibility, undefined);
  assert.equal(payload.assignments[0].compatibility, undefined);
  assert.equal(
    scenarioPayload(draft, selections, null).expectedVersion,
    undefined,
  );
});
test("saved scenario details and earlier steps work independently of the current library page", async () => {
  const store = makeStore();
  adapter((config) =>
    config.url.startsWith("/scenarios/")
      ? record
      : person(Number(config.url.split("/").at(-1))),
  );
  await store.dispatch(openSavedScenario(80)).unwrap();
  assert.equal(store.getState().planning.activeScenario.id, 80);
  assert.equal(savedSummary(record).averageScore, 93);
  await store.dispatch(editSavedScenario(80)).unwrap();
  const planning = store.getState().planning;
  assert.equal(planning.draft.projectTitle, "Website");
  assert.equal(planning.expectedVersion, 4);
  assert.equal(planning.selections[21].length, 2);
  assert.equal(planning.step, 1);
});
test("assigned-skill warnings retain the authoritative affected list and require explicit retry", async () => {
  const store = makeStore();
  let body;
  api.defaults.adapter = async (config) => {
    body = JSON.parse(config.data);
    throw new AxiosError("Conflict", "ERR_BAD_REQUEST", config, undefined, {
      status: 409,
      data: {
        code: "assigned_skill",
        message: "Review employees.",
        affectedEmployees: [{ id: 7, name: "Person Seven" }],
      },
      config,
      headers: {},
      statusText: "Conflict",
    });
  };
  await assert.rejects(
    store
      .dispatch(deleteSkill({ id: 21, confirmAssignedRemoval: false }))
      .unwrap(),
    (e) => e.code === "assigned_skill" && e.affectedEmployees[0].id === 7,
  );
  assert.equal(body.confirmAssignedRemoval, false);
});
test("stale scenario saves keep edits and show a reload conflict", async () => {
  const store = makeStore();
  adapter((config) =>
    config.url.startsWith("/scenarios/")
      ? record
      : person(Number(config.url.split("/").at(-1))),
  );
  await store.dispatch(editSavedScenario(80)).unwrap();
  let body;
  api.defaults.adapter = async (config) => {
    body = JSON.parse(config.data);
    throw new AxiosError("Conflict", "ERR_BAD_REQUEST", config, undefined, {
      status: 409,
      data: { code: "stale_scenario", message: "Reload the latest scenario." },
      config,
      headers: {},
      statusText: "Conflict",
    });
  };
  await assert.rejects(store.dispatch(savePlannedScenario()).unwrap());
  assert.equal(body.expectedVersion, 4);
  assert.equal(body.projectTitle, "Website");
  assert.equal(store.getState().planning.errorCode, "stale_scenario");
  assert.equal(store.getState().planning.editingScenarioId, 80);
});
