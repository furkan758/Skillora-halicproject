import test from "node:test";
import assert from "node:assert/strict";
import { AxiosError } from "axios";
import { api } from "../src/api.ts";
import { makeStore, saveEmployee } from "../src/reduxToolKit/store.ts";
import { employeeInput } from "../src/skillsToEmp/employeeProfile.ts";
import { readDraft, writeDraft, validEmployeeDraft, formDraftKey } from "../src/otherComponents/draftStorage.ts";

const employee = {
  id: 7, version: "0x000000000000001A", firstName: "Alex", lastName: "Example",
  name: "Alex Example", departmentId: 1, department: "Engineering",
  jobTitle: "Developer", gender: "Not specified", isAvailable: true, skills: [],
};
function storage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) };
}

test("employee drafts retain the version originally viewed across refresh", () => {
  const disk = storage(), key = formDraftKey("employee", employee.id);
  const draft = { ...employeeInput(employee), jobTitle: "Unsaved title" };
  writeDraft(key, draft, disk);
  const restored = readDraft(key, validEmployeeDraft, disk);
  assert.equal(restored.expectedVersion, employee.version);
  assert.equal(restored.jobTitle, "Unsaved title");
  assert.ok(validEmployeeDraft({ ...draft, expectedVersion: undefined }));
  assert.equal(validEmployeeDraft({ ...draft, expectedVersion: "invalid" }), false);
  assert.equal(validEmployeeDraft({ ...draft, expectedVersion: 2 }), false);
});

test("employee conflict keeps the edited draft and never retries with a newer version", async () => {
  const disk = storage(), key = formDraftKey("employee", employee.id);
  const draft = { ...employeeInput(employee), jobTitle: "Unsaved title" };
  writeDraft(key, draft, disk);
  const originalAdapter = api.defaults.adapter;
  const requests = [];
  api.defaults.adapter = async (config) => {
    requests.push(JSON.parse(config.data));
    throw new AxiosError("Conflict", "ERR_BAD_REQUEST", config, null, {
      status: 409, data: { code: "stale_employee", message: "Reload the latest profile." },
      statusText: "Conflict", headers: {}, config,
    });
  };
  try {
    const store = makeStore(disk);
    await assert.rejects(store.dispatch(saveEmployee(draft)).unwrap(), (error) => error.code === "stale_employee");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].expectedVersion, employee.version);
    assert.deepEqual(readDraft(key, validEmployeeDraft, disk), draft);
  } finally {
    api.defaults.adapter = originalAdapter;
  }
});
