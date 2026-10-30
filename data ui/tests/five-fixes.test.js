import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../src/api.ts";
import { makeStore, fetchWorkspace } from "../src/reduxToolKit/store.ts";
import {
  startScenario,
  setDraftField,
  toggleCandidate,
  savePlannedScenario,
  editSavedScenario,
  hydrateDraftScenario,
  scenarioLifecycle,
} from "../src/reduxToolKit/scenarioPlanningSlice.ts";
import {
  readDraft,
  writeDraft,
  validScenarioDraft,
  validEmployeeDraft,
  validCatalogDraft,
} from "../src/otherComponents/draftStorage.ts";
const storage = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
    map,
  };
};
const draft = {
  clientName: "Draft client",
  projectTitle: "Draft project",
  projectBrief: "Keep this brief",
  requiredPeople: 1,
  onlyAvailable: true,
  requirements: [{ skillId: 21, count: 1 }],
};
const person = {
  id: 7,
  name: "Alex Example",
  firstName: "Alex",
  lastName: "Example",
  gender: "Not specified",
  jobTitle: "Developer",
  departmentId: 1,
  department: "Engineering",
  isAvailable: true,
  skills: [
    {
      skillId: 21,
      skillName: "React",
      folderId: 1,
      proficiencyLevel: 4,
      experienceYears: 2.5,
    },
  ],
};
const selected = {
  employee: person,
  skillId: 21,
  proficiencyLevel: 4,
  compatibility: 80,
};
const record = {
  ...draft,
  id: 9,
  baseTitle: draft.projectTitle,
  status: "SAVED",
  version: 3,
  selectedPeople: 1,
  averageCompatibility: 80,
  createdAt: "2026-10-30T12:00:00Z",
  updatedAt: "2026-10-30T12:00:00Z",
  requirements: [{ skillId: 21, skillName: "React", count: 1, isActive: true }],
  assignments: [],
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
test("a delayed old workspace success or failure cannot overwrite the newest request", async () => {
  const store = makeStore(),
    pending = [];
  let calls = 0;
  api.defaults.adapter = (config) => {
    const old = calls++ < 3;
    const data =
      config.url === "/catalog"
        ? { folders: [], skills: old ? [] : [{ id: 21, name: "React" }] }
        : config.url === "/departments"
          ? []
          : {
              employeeCount: old ? 0 : 42,
              availableCount: 0,
              departmentCount: 0,
              skillCount: 1,
            };
    const response = {
      data,
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
    return old
      ? new Promise((resolve) => pending.push(() => resolve(response)))
      : Promise.resolve(response);
  };
  const first = store.dispatch(fetchWorkspace());
  await store.dispatch(fetchWorkspace());
  pending.forEach((resolve) => resolve());
  await first;
  assert.equal(store.getState().catalog.overview.employeeCount, 42);
  store.dispatch(
    fetchWorkspace.rejected(new Error("Old error"), "old-request", undefined),
  );
  assert.equal(store.getState().catalog.status, "succeeded");
  assert.equal(store.getState().catalog.skills[0].id, 21);
});
test("cold reload restores the scenario brief and IDs without caching candidate profiles or scores", () => {
  const disk = storage(),
    store = makeStore(disk);
  store.dispatch(startScenario(draft));
  store.dispatch(toggleCandidate({ skillId: 21, candidate: selected }));
  const raw = disk.getItem("skillora:unsaved:v1:scenario");
  assert.ok(raw.includes("selectionIds"));
  assert.equal(raw.includes("compatibility"), false);
  assert.equal(raw.includes("Alex Example"), false);
  const reloaded = makeStore(disk).getState().planning;
  assert.equal(reloaded.draft.projectTitle, draft.projectTitle);
  assert.deepEqual(reloaded.restoredSelectionIds, { 21: [7] });
  assert.equal(reloaded.step, 1);
});
test("restored edits keep their original version instead of silently adopting a newer server version", async () => {
  const disk = storage();
  writeDraft(
    "scenario",
    {
      draft,
      selectionIds: { 21: [7] },
      editingScenarioId: 9,
      expectedVersion: 2,
    },
    disk,
  );
  const store = makeStore(disk);
  adapter(() => record);
  await store.dispatch(hydrateDraftScenario(9)).unwrap();
  assert.equal(store.getState().planning.expectedVersion, 2);
  assert.ok(store.getState().planning.notice.includes("older"));
});
test("saving clears the local scenario draft while failed saves keep it", async () => {
  const disk = storage(),
    store = makeStore(disk);
  store.dispatch(startScenario(draft));
  store.dispatch(toggleCandidate({ skillId: 21, candidate: selected }));
  api.defaults.adapter = async () => {
    throw new Error("Connection interrupted");
  };
  await assert.rejects(store.dispatch(savePlannedScenario()).unwrap());
  assert.ok(readDraft("scenario", validScenarioDraft, disk));
  adapter((config) =>
    config.url === "/scenarios" && config.method === "get"
      ? { items: [record], total: 1, page: 1, pageSize: 15, totalPages: 1 }
      : record,
  );
  await store.dispatch(savePlannedScenario()).unwrap();
  assert.equal(readDraft("scenario", validScenarioDraft, disk), null);
});
test("malformed, incompatible and blocked draft storage never crashes initialization", () => {
  const disk = storage();
  disk.setItem("skillora:unsaved:v1:scenario", "{broken");
  assert.doesNotThrow(() => makeStore(disk));
  assert.equal(makeStore(disk).getState().planning.draft.projectTitle, "");
  writeDraft(
    "scenario",
    {
      draft: { ...draft, requirements: [{ skillId: "React", count: 1 }] },
      selectionIds: {},
      editingScenarioId: null,
      expectedVersion: null,
    },
    disk,
  );
  assert.equal(readDraft("scenario", validScenarioDraft, disk), null);
  assert.equal(
    writeDraft(
      "x",
      {},
      {
        setItem() {
          throw new Error("Quota exceeded");
        },
      },
    ),
    false,
  );
  assert.ok(
    validEmployeeDraft({
      ...person,
      skills: [{ skillId: 21, proficiencyLevel: null, experienceYears: null }],
    }),
  );
  assert.ok(
    validCatalogDraft({
      name: "Work in progress",
      description: "",
      folderId: 1,
    }),
  );
});
test("archive, restore and delete requests include the viewed version and update the open record", async () => {
  const store = makeStore();
  store.dispatch(editSavedScenario.pending("edit", 9));
  store.dispatch(
    editSavedScenario.fulfilled(
      { record, selections: { 21: [selected] } },
      "edit",
      9,
    ),
  );
  let method, body;
  adapter((config) => {
    if (config.url === "/scenarios")
      return { items: [], total: 0, page: 1, pageSize: 15, totalPages: 0 };
    method = config.method;
    body = JSON.parse(config.data);
    return { ...record, status: "ARCHIVED", version: 4 };
  });
  await store
    .dispatch(scenarioLifecycle({ record, operation: "archive" }))
    .unwrap();
  assert.equal(method, "post");
  assert.equal(body.expectedVersion, 3);
  assert.equal(store.getState().planning.activeScenario.status, "ARCHIVED");
  await store
    .dispatch(
      scenarioLifecycle({
        record: { ...record, status: "ARCHIVED", version: 4 },
        operation: "delete",
      }),
    )
    .unwrap();
  assert.equal(method, "delete");
  assert.equal(body.expectedVersion, 4);
  assert.equal(store.getState().planning.activeScenario, null);
});
test("frontend requests default to the same-origin proxy", () =>
  assert.equal(api.defaults.baseURL, "/api"));
