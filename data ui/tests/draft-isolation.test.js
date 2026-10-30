import test from "node:test";
import assert from "node:assert/strict";
import { makeStore } from "../src/reduxToolKit/store.ts";
import {
  startScenario,
  setDraftField,
} from "../src/reduxToolKit/scenarioPlanningSlice.ts";
import {
  blankDraft,
  hasScenarioDraftChanges,
} from "../src/Scenario/scenarioModel.ts";
import {
  createTabDraftStorage,
  readDraft,
  writeDraft,
  validScenarioDraft,
} from "../src/otherComponents/draftStorage.ts";
const storage = (initial = []) => {
  const map = new Map(initial);
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
};
for (const change of [
  { field: "requiredPeople", value: 7 },
  { field: "onlyAvailable", value: false },
]) {
  test(
    "a draft containing only " +
      change.field +
      " survives reload and requires a discard check",
    () => {
      const session = storage(),
        tab = makeStore(createTabDraftStorage(session));
      tab.dispatch(startScenario());
      tab.dispatch(setDraftField(change));
      assert.equal(
        hasScenarioDraftChanges(tab.getState().planning.draft),
        true,
      );
      assert.equal(
        makeStore(session).getState().planning.draft[change.field],
        change.value,
      );
      tab.dispatch(startScenario());
      assert.equal(readDraft("scenario", validScenarioDraft, session), null);
      assert.equal(hasScenarioDraftChanges(blankDraft()), false);
    },
  );
}
test("independent and duplicated tabs cannot overwrite or clear each other's drafts", () => {
  const legacy = storage(),
    sessionA = storage();
  const tabA = makeStore(createTabDraftStorage(sessionA, legacy));
  tabA.dispatch(setDraftField({ field: "projectTitle", value: "Project A" }));
  // A duplicated tab initially receives an independent copy of sessionStorage.
  const sessionB = storage([...sessionA.map]);
  const tabB = makeStore(createTabDraftStorage(sessionB, legacy));
  assert.equal(tabB.getState().planning.draft.projectTitle, "Project A");
  tabB.dispatch(setDraftField({ field: "projectTitle", value: "Project B" }));
  assert.equal(
    makeStore(sessionA).getState().planning.draft.projectTitle,
    "Project A",
  );
  assert.equal(
    makeStore(sessionB).getState().planning.draft.projectTitle,
    "Project B",
  );
  tabA.dispatch(startScenario());
  assert.equal(
    makeStore(sessionB).getState().planning.draft.projectTitle,
    "Project B",
  );
  writeDraft("employee:new", { firstName: "A" }, sessionA);
  writeDraft("employee:new", { firstName: "B" }, sessionB);
  assert.equal(
    JSON.parse(sessionA.getItem("skillora:unsaved:v1:employee:new")).value
      .firstName,
    "A",
  );
  assert.equal(
    JSON.parse(sessionB.getItem("skillora:unsaved:v1:employee:new")).value
      .firstName,
    "B",
  );
});
test("the existing shared draft migrates once without touching unrelated browser data", () => {
  const legacy = storage(),
    sessionA = storage(),
    sessionB = storage();
  const snapshot = {
    draft: { ...blankDraft(), projectTitle: "Existing draft" },
    selectionIds: {},
    editingScenarioId: null,
    expectedVersion: null,
  };
  writeDraft("scenario", snapshot, legacy);
  writeDraft("active-employee", { kind: "employee", id: null }, legacy);
  legacy.setItem("unrelated-setting", "keep");
  createTabDraftStorage(sessionA, legacy);
  assert.equal(
    makeStore(sessionA).getState().planning.draft.projectTitle,
    "Existing draft",
  );
  assert.equal(legacy.getItem("skillora:unsaved:v1:scenario"), null);
  assert.equal(legacy.getItem("unrelated-setting"), "keep");
  createTabDraftStorage(sessionB, legacy);
  assert.equal(makeStore(sessionB).getState().planning.draft.projectTitle, "");
});
test("failed migration preserves the original and never overwrites a tab's own draft", () => {
  const legacy = storage(),
    session = storage();
  writeDraft("employee:new", { firstName: "Shared" }, legacy);
  const blocked = {
    getItem: () => null,
    setItem: () => {
      throw new Error("Storage full");
    },
    removeItem: () => {},
  };
  assert.doesNotThrow(() => createTabDraftStorage(blocked, legacy));
  assert.ok(legacy.getItem("skillora:unsaved:v1:employee:new"));
  writeDraft("employee:new", { firstName: "My tab" }, session);
  createTabDraftStorage(session, legacy);
  assert.equal(
    JSON.parse(session.getItem("skillora:unsaved:v1:employee:new")).value
      .firstName,
    "My tab",
  );
  assert.ok(legacy.getItem("skillora:unsaved:v1:employee:new"));
});
