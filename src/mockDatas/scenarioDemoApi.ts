import type MockAdapter from "axios-mock-adapter";
import { apiError } from "../otherComponents/errors";
import {
  allocationError,
  skillCandidates,
  teamSummary,
  uniqueScenarioTitle,
} from "../Scenario/scenarioModel";
import type {
  Catalog,
  Employee,
  SavedScenario,
  ScenarioDraft,
  ScenarioPayload,
  StorageLike,
} from "../types";

export function installScenarioEndpoints(
  mock: MockAdapter,
  {
    getEmployees,
    getCatalog,
    storage,
  }: {
    getEmployees: () => Employee[];
    getCatalog: () => Catalog;
    storage?: StorageLike;
  },
) {
  let scenarios: SavedScenario[] = [];
  try {
    const saved = JSON.parse(storage?.getItem("skillora-scenarios-v1") || "[]");
    if (Array.isArray(saved))
      scenarios = saved.filter((s) => s.id && s.title && s.summary?.groups);
  } catch {
    /* Start with an empty local library. */
  }
  const copy = <T>(value: T): T => structuredClone(value);
  mock.onGet("/scenarios").reply(() => [200, copy(scenarios)]);
  mock.onPost("/scenarios/candidates").reply((config) => {
    const draft: ScenarioDraft = JSON.parse(config.data);
    const error = allocationError(draft, getCatalog().skills);
    if (error) return [400, { message: error }];
    return [
      200,
      copy(
        skillCandidates(
          getEmployees(),
          draft.requirements,
          draft.onlyAvailable,
        ),
      ),
    ];
  });
  mock.onPost("/scenarios").reply((config) => {
    const { draft, selections }: ScenarioPayload = JSON.parse(config.data);
    try {
      const summary = teamSummary(
        draft,
        selections,
        getEmployees(),
        getCatalog().skills,
      );
      const scenario = {
        id: crypto.randomUUID(),
        title: uniqueScenarioTitle(draft.title, scenarios),
        projectTitle: draft.title.trim(),
        client: draft.client.trim(),
        description: draft.description.trim(),
        headcount: draft.headcount,
        requirements: copy(draft.requirements),
        onlyAvailable: !!draft.onlyAvailable,
        summary,
        createdAt: new Date().toISOString(),
      };
      const next = [scenario, ...scenarios];
      // A save is successful only after the snapshot has been stored.
      if (storage?.setItem)
        storage.setItem("skillora-scenarios-v1", JSON.stringify(next));
      scenarios = next;
      return [201, copy(scenario)];
    } catch (error) {
      return [400, { message: apiError(error).message }];
    }
  });
  mock.onPut(/^\/scenarios\/[^/]+$/).reply((config) => {
    const id = decodeURIComponent((config.url || "").split("/").pop() || "");
    const existing = scenarios.find((scenario) => scenario.id === id);
    if (!existing)
      return [404, { message: "This saved scenario could not be found." }];
    const { draft, selections }: ScenarioPayload = JSON.parse(config.data);
    try {
      const summary = teamSummary(
        draft,
        selections,
        getEmployees(),
        getCatalog().skills,
      );
      const projectTitle = draft.title.trim();
      const title =
        projectTitle === (existing.projectTitle || existing.title)
          ? existing.title
          : uniqueScenarioTitle(
              projectTitle,
              scenarios.filter((scenario) => scenario.id !== id),
            );
      const scenario = {
        ...existing,
        title,
        projectTitle,
        client: draft.client.trim(),
        description: draft.description.trim(),
        headcount: draft.headcount,
        requirements: copy(draft.requirements),
        onlyAvailable: !!draft.onlyAvailable,
        summary,
        updatedAt: new Date().toISOString(),
      };
      const next = scenarios.map((record) =>
        record.id === id ? scenario : record,
      );
      if (storage?.setItem)
        storage.setItem("skillora-scenarios-v1", JSON.stringify(next));
      scenarios = next;
      return [200, copy(scenario)];
    } catch (error) {
      return [400, { message: apiError(error).message }];
    }
  });
}
