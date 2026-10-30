import { configureStore } from "@reduxjs/toolkit";
import catalog from "./catalogSlice";
import employees from "./employeesSlice";
import planning, {
  restoreLocalDraft,
  setDraftStorageError,
} from "./scenarioPlanningSlice";
import { scenarioDraftMiddleware } from "./scenarioDraftPersistence";
import {
  browserDraftStorage,
  readDraft,
  validScenarioDraft,
  type DraftStorage,
} from "../otherComponents/draftStorage";
export const makeStore = (storage: DraftStorage | null = null) => {
  const store = configureStore({
    reducer: { employees, catalog, planning },
    middleware: (getDefault) =>
      storage
        ? getDefault().concat(scenarioDraftMiddleware(storage))
        : getDefault(),
  });
  const draft = readDraft("scenario", validScenarioDraft, storage);
  if (draft) store.dispatch(restoreLocalDraft(draft));
  return store;
};
const storage = browserDraftStorage();
export const store = makeStore(storage);
if (typeof window !== "undefined" && !storage)
  store.dispatch(
    setDraftStorageError(
      "Browser draft storage is unavailable. Save your scenario before refreshing.",
    ),
  );
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export * from "./thunks";
export {
  setQuery,
  setDepartment,
  setAvailability,
  setEmployeePage,
  clearFilters,
} from "./employeesSlice";
