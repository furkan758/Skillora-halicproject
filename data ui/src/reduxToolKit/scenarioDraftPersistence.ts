import type { Middleware } from "@reduxjs/toolkit";
import type { AppState } from "../types";
import {
  removeDraft,
  writeDraft,
  type DraftStorage,
} from "../otherComponents/draftStorage";
import { setDraftStorageError } from "./scenarioPlanningSlice";
import { hasScenarioDraftChanges } from "../Scenario/scenarioModel";
export function scenarioDraftMiddleware(
  storage: DraftStorage,
): Middleware<{}, AppState> {
  return (store) => (next) => (action) => {
    const result = next(action);
    if (
      typeof action !== "object" ||
      !action ||
      !("type" in action) ||
      typeof action.type !== "string" ||
      !action.type.startsWith("planning/") ||
      action.type === setDraftStorageError.type
    )
      return result;
    const p = store.getState().planning;
    if (
      (p.activeScenario && !p.editingScenarioId) ||
      (!p.editingScenarioId && !hasScenarioDraftChanges(p.draft))
    ) {
      removeDraft("scenario", storage);
      return result;
    }
    const value = {
      draft: p.draft,
      selectionIds:
        p.restoredSelectionIds ??
        Object.fromEntries(
          Object.entries(p.selections).map(([key, people]) => [
            key,
            people.map((c) => c.employee.id),
          ]),
        ),
      editingScenarioId: p.editingScenarioId,
      expectedVersion: p.expectedVersion,
    };
    const message = writeDraft("scenario", value, storage)
      ? null
      : "This browser could not save the scenario draft. Keep this page open until you save.";
    if (p.draftStorageError !== message)
      store.dispatch(setDraftStorageError(message));
    return result;
  };
}
