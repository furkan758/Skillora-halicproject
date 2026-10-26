import test from "node:test";
import assert from "node:assert/strict";
import {
  SCENARIO_PAGE_SIZE,
  rankMatches,
} from "../src/Scenario/matchRanking.ts";
import { paginate } from "../src/otherComponents/paginationModel.ts";

test("scenario matches are ranked globally before splitting into five-person pages", () => {
  const scores = [12, 90, 30, 100, 65, 0, 85, 45, 10, 75, 55];
  const results = scores.map((score, i) => ({
    score,
    employee: { id: i + 1, name: `Person ${i + 1}` },
  }));
  const ranked = rankMatches(results);
  const pages = Array.from(
    { length: paginate(ranked, 1, SCENARIO_PAGE_SIZE).totalPages },
    (_, i) => paginate(ranked, i + 1, SCENARIO_PAGE_SIZE),
  );
  assert.equal(SCENARIO_PAGE_SIZE, 5);
  assert.deepEqual(
    pages.map((page) => page.items.length),
    [5, 5, 1],
  );
  assert.deepEqual(
    pages[0].items.map((r) => r.score),
    [100, 90, 85, 75, 65],
  );
  assert.deepEqual(
    pages[1].items.map((r) => r.score),
    [55, 45, 30, 12, 10],
  );
  assert.deepEqual(
    pages.flatMap((p) => p.items),
    ranked,
  );
  assert.deepEqual(
    results.map((r) => r.score),
    scores,
  );
});

test("tied compatibility scores have a predictable name order", () => {
  const ranked = rankMatches([
    { score: 80, employee: { id: 1, name: "Zoe" } },
    { score: 80, employee: { id: 2, name: "Alex" } },
    { score: 100, employee: { id: 3, name: "Sam" } },
  ]);
  assert.deepEqual(
    ranked.map((r) => r.employee.name),
    ["Sam", "Alex", "Zoe"],
  );
});

test("Redux normalizes unsorted API results before the UI paginates them", async () => {
  const { api } = await import("../src/api.ts");
  const { makeStore, evaluateScenario } =
    await import("../src/reduxToolKit/store.ts");
  const { default: MockAdapter } = await import("axios-mock-adapter");
  const mock = new MockAdapter(api);
  const results = [10, 90, 30, 100, 60, 80].map((score, i) => ({
    score,
    employee: { id: i + 1, name: `Person ${i + 1}` },
    contributions: [],
  }));
  mock.onPost("/scenarios/evaluate").reply(200, results);
  const store = makeStore();
  await store.dispatch(evaluateScenario()).unwrap();
  const ranked = store.getState().scenario.results;
  assert.deepEqual(
    ranked.map((r) => r.score),
    [100, 90, 80, 60, 30, 10],
  );
  assert.equal(paginate(ranked, 1, SCENARIO_PAGE_SIZE).items.length, 5);
  assert.equal(paginate(ranked, 2, SCENARIO_PAGE_SIZE).items[0].score, 10);
  mock.restore();
});
