import { configureStore } from "@reduxjs/toolkit";
import catalog from "./catalogSlice";
import employees from "./employeesSlice";
import scenario from "./legacyScenarioSlice";
import planning from "./scenarioPlanningSlice";

export const makeStore = () =>
  configureStore({ reducer: { employees, catalog, scenario, planning } });
export const store = makeStore();
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export * from "./thunks";
export {
  setQuery,
  setDepartment,
  setAvailability,
  clearFilters,
} from "./employeesSlice";
export {
  setScenarioField,
  usePreset,
  setCriteria,
  invalidateResults,
} from "./legacyScenarioSlice";
