import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { presets } from "../mockDatas/data";
import { rankMatches } from "../Scenario/matchRanking";
import type {
  Catalog,
  Criterion,
  LegacyScenarioState,
  Preset,
  WorkspaceSnapshot,
} from "../types";
import {
  catalogMutations,
  evaluateScenario,
  fetchEmployees,
  saveEmployee,
} from "./thunks";

const initialState: LegacyScenarioState = {
  ...presets[0],
  onlyAvailable: false,
  results: [],
  status: "idle",
  error: null,
  requestId: null,
};
const resetResults = (s: LegacyScenarioState) => {
  s.results = [];
  s.status = "idle";
  s.error = null;
  s.requestId = null;
};
const reconcileCriteria = (
  s: LegacyScenarioState,
  catalog: Catalog,
  renamedSkill?: WorkspaceSnapshot["renamedSkill"],
) => {
  const names = new Set(catalog.skills.map((skill) => skill.name));
  s.criteria = s.criteria
    .map((c) =>
      renamedSkill && c.skill === renamedSkill.from
        ? { ...c, skill: renamedSkill.to }
        : c,
    )
    .filter((c) => names.has(c.skill));
  resetResults(s);
};
const scenarioSlice = createSlice({
  name: "scenario",
  initialState,
  reducers: {
    setScenarioField: (
      s,
      a: PayloadAction<
        | { field: "client" | "title" | "description"; value: string }
        | { field: "onlyAvailable"; value: boolean }
      >,
    ) => {
      if (a.payload.field === "onlyAvailable")
        s.onlyAvailable = a.payload.value as boolean;
      else s[a.payload.field] = a.payload.value as string;
      resetResults(s);
    },
    usePreset: (s, a: PayloadAction<Preset>) => {
      Object.assign(s, a.payload);
      resetResults(s);
    },
    setCriteria: (s, a: PayloadAction<Criterion[]>) => {
      s.criteria = a.payload;
      resetResults(s);
    },
    invalidateResults: resetResults,
  },
  extraReducers: (b) => {
    b.addCase(fetchEmployees.fulfilled, (s, a) =>
      reconcileCriteria(s, a.payload.catalog),
    )
      .addCase(saveEmployee.fulfilled, resetResults)
      .addCase(evaluateScenario.pending, (s, a) => {
        s.status = "loading";
        s.error = null;
        s.requestId = a.meta.requestId;
      })
      .addCase(evaluateScenario.fulfilled, (s, a) => {
        if (s.requestId !== a.meta.requestId) return;
        s.results = rankMatches(a.payload);
        s.status = "succeeded";
        s.requestId = null;
      })
      .addCase(evaluateScenario.rejected, (s, a) => {
        if (s.requestId !== a.meta.requestId) return;
        s.status = "failed";
        s.error = "Could not calculate matches. Please try again.";
        s.requestId = null;
      });
    catalogMutations.forEach((thunk) =>
      b.addCase(thunk.fulfilled, (s, a) =>
        reconcileCriteria(s, a.payload.catalog, a.payload.renamedSkill),
      ),
    );
  },
});
export const { setScenarioField, usePreset, setCriteria, invalidateResults } =
  scenarioSlice.actions;
export default scenarioSlice.reducer;
