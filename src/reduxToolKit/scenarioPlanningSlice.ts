import {
  createAsyncThunk,
  createSlice,
  isAnyOf,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { api } from "../api";
import { presets } from "../mockDatas/data";
import { apiError } from "../otherComponents/errors";
import { rankMatches } from "../Scenario/matchRanking";
import { allocationError } from "../Scenario/scenarioModel";
import type {
  ApiError,
  AppState,
  CandidateGroup,
  PlanningState,
  Preset,
  SavedScenario,
  ScenarioDraft,
  SkillRequirement,
  WorkspaceSnapshot,
} from "../types";
import { deleteSkill, fetchEmployees, saveEmployee, saveSkill } from "./thunks";

export function draftFromPreset(preset: Preset = presets[0]): ScenarioDraft {
  return {
    client: preset.client,
    title: preset.title,
    description: preset.description,
    headcount: preset.criteria.length,
    requirements: preset.criteria.map((c) => ({ skill: c.skill, count: 1 })),
    onlyAvailable: false,
  };
}
const fail = apiError;
export const fetchSavedScenarios = createAsyncThunk<
  SavedScenario[],
  void,
  { state: AppState; rejectValue: ApiError }
>(
  "planning/fetchSaved",
  async (_, { rejectWithValue }) => {
    try {
      return (await api.get("/scenarios")).data;
    } catch (error) {
      return rejectWithValue(fail(error));
    }
  },
  {
    condition: (_, { getState }) =>
      getState().planning.savedStatus !== "loading",
  },
);
export const findScenarioCandidates = createAsyncThunk<
  CandidateGroup[],
  void,
  { state: AppState; rejectValue: ApiError }
>("planning/findCandidates", async (_, { getState, rejectWithValue }) => {
  const { draft } = getState().planning;
  const error = allocationError(draft, getState().catalog.skills);
  if (error) return rejectWithValue({ message: error });
  try {
    return (await api.post("/scenarios/candidates", draft)).data;
  } catch (error) {
    return rejectWithValue(fail(error));
  }
});
export const savePlannedScenario = createAsyncThunk<
  SavedScenario,
  void,
  { state: AppState; rejectValue: ApiError }
>(
  "planning/save",
  async (_, { getState, rejectWithValue }) => {
    const { draft, selections, editingScenarioId } = getState().planning;
    try {
      return (
        await (editingScenarioId
          ? api.put(`/scenarios/${editingScenarioId}`, { draft, selections })
          : api.post("/scenarios", { draft, selections }))
      ).data;
    } catch (error) {
      return rejectWithValue(fail(error));
    }
  },
  {
    condition: (_, { getState }) =>
      getState().planning.saveStatus !== "loading",
  },
);
const invalidateTeam = (s: PlanningState) => {
  s.candidates = [];
  s.selections = {};
  s.status = "idle";
  s.requestId = null;
  s.step = 1;
  s.error = null;
  s.notice = null;
  s.saveStatus = "idle";
};
const initialState: PlanningState = {
  draft: draftFromPreset(),
  step: 1,
  selections: {},
  candidates: [],
  status: "idle",
  requestId: null,
  error: null,
  notice: null,
  saved: [],
  savedStatus: "idle",
  libraryError: null,
  saveStatus: "idle",
  activeSavedId: null,
  editingScenarioId: null,
};
const slice = createSlice({
  name: "planning",
  initialState,
  reducers: {
    startScenario: (s, a: PayloadAction<ScenarioDraft | undefined>) => {
      s.draft = a.payload || draftFromPreset();
      s.activeSavedId = null;
      s.editingScenarioId = null;
      invalidateTeam(s);
    },
    replaceBrief: (s, a: PayloadAction<ScenarioDraft>) => {
      s.draft = a.payload;
      invalidateTeam(s);
    },
    setDraftField: (
      s,
      a: PayloadAction<
        | { field: "client" | "title" | "description"; value: string }
        | { field: "headcount"; value: number }
        | { field: "onlyAvailable"; value: boolean }
      >,
    ) => {
      const change = a.payload;
      if (change.field === "headcount") s.draft.headcount = change.value;
      else if (change.field === "onlyAvailable")
        s.draft.onlyAvailable = change.value;
      else s.draft[change.field] = change.value;
      s.error = null;
      s.saveStatus = "idle";
      if (["headcount", "onlyAvailable"].includes(a.payload.field))
        invalidateTeam(s);
    },
    setRequirements: (s, a: PayloadAction<SkillRequirement[]>) => {
      s.draft.requirements = a.payload;
      invalidateTeam(s);
    },
    setPlanningStep: (s, a: PayloadAction<number>) => {
      s.step = a.payload;
      s.error = null;
    },
    openSavedScenario: (s, a: PayloadAction<string>) => {
      if (!s.saved.some((record) => record.id === a.payload)) return;
      invalidateTeam(s);
      s.activeSavedId = a.payload;
      s.editingScenarioId = null;
      s.step = 3;
    },
    editSavedScenario: (s, a: PayloadAction<string>) => {
      const record = s.saved.find((record) => record.id === a.payload);
      if (!record) return;
      invalidateTeam(s);
      s.activeSavedId = record.id;
      s.editingScenarioId = record.id;
      s.draft = {
        client: record.client,
        title: record.projectTitle || record.title,
        description: record.description,
        headcount: record.headcount,
        requirements: record.requirements,
        onlyAvailable: !!record.onlyAvailable,
      };
      s.selections = Object.fromEntries(
        record.summary.groups.map((group) => [
          group.skill,
          group.members.map((member) => member.employeeId),
        ]),
      );
    },
    toggleCandidate: (
      s,
      a: PayloadAction<{ skill: string; employeeId: number }>,
    ) => {
      const { skill, employeeId } = a.payload;
      const requirement = s.draft.requirements.find((r) => r.skill === skill);
      if (
        !requirement ||
        !s.candidates
          .find((g) => g.skill === skill)
          ?.candidates.some((c) => c.employee.id === employeeId)
      )
        return;
      const selected = s.selections[skill] || [];
      if (selected.includes(employeeId))
        s.selections[skill] = selected.filter((id) => id !== employeeId);
      else if (
        selected.length < requirement.count &&
        !Object.values(s.selections).some((ids) => ids.includes(employeeId))
      )
        s.selections[skill] = [...selected, employeeId];
      s.error = null;
      s.saveStatus = "idle";
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchSavedScenarios.pending, (s) => {
      s.savedStatus = "loading";
      s.libraryError = null;
    })
      .addCase(fetchSavedScenarios.fulfilled, (s, a) => {
        s.saved = a.payload;
        s.savedStatus = "succeeded";
      })
      .addCase(fetchSavedScenarios.rejected, (s, a) => {
        s.savedStatus = "failed";
        s.libraryError =
          a.payload?.message || "Could not load saved scenarios.";
      })
      .addCase(findScenarioCandidates.pending, (s, a) => {
        s.status = "loading";
        s.requestId = a.meta.requestId;
        s.error = null;
        s.saveStatus = "idle";
      })
      .addCase(findScenarioCandidates.fulfilled, (s, a) => {
        if (s.requestId !== a.meta.requestId) return;
        s.candidates = a.payload.map((group) => ({
          ...group,
          candidates: rankMatches(group.candidates),
        }));
        const used = new Set(),
          previousCount = Object.values(s.selections).flat().length;
        s.selections = Object.fromEntries(
          s.candidates
            .map((group) => [
              group.skill,
              (s.selections[group.skill] || [])
                .filter((id) => {
                  if (
                    used.has(id) ||
                    !group.candidates.some(
                      (candidate) => candidate.employee.id === id,
                    )
                  )
                    return false;
                  used.add(id);
                  return true;
                })
                .slice(0, group.count),
            ])
            .filter(([, ids]) => ids.length),
        );
        s.notice =
          Object.values(s.selections).flat().length < previousCount
            ? "Some saved selections are no longer eligible. Please fill the remaining places."
            : null;
        s.status = "succeeded";
        s.step = 2;
        s.requestId = null;
      })
      .addCase(findScenarioCandidates.rejected, (s, a) => {
        if (s.requestId !== a.meta.requestId) return;
        s.status = "failed";
        s.error = a.payload?.message || "Could not find candidates.";
        s.requestId = null;
      })
      .addCase(savePlannedScenario.pending, (s) => {
        s.saveStatus = "loading";
        s.error = null;
      })
      .addCase(savePlannedScenario.fulfilled, (s, a) => {
        s.saved = [
          a.payload,
          ...s.saved.filter((record) => record.id !== a.payload.id),
        ];
        s.saveStatus = "succeeded";
        s.activeSavedId = a.payload.id;
        s.editingScenarioId = null;
        s.notice = null;
        s.step = 3;
      })
      .addCase(savePlannedScenario.rejected, (s, a) => {
        s.saveStatus = "failed";
        s.error = a.payload?.message || "Could not save this scenario.";
      })
      .addMatcher(
        isAnyOf(
          fetchEmployees.fulfilled,
          saveSkill.fulfilled,
          deleteSkill.fulfilled,
          saveEmployee.fulfilled,
        ),
        (s, a) => {
          if ("catalog" in a.payload) {
            const { renamedSkill, catalog } = a.payload as WorkspaceSnapshot;
            s.draft.requirements = s.draft.requirements
              .map((r) =>
                renamedSkill && r.skill === renamedSkill.from
                  ? { ...r, skill: renamedSkill.to }
                  : r,
              )
              .filter((r) =>
                catalog.skills.some((skill) => skill.name === r.skill),
              );
          }
          invalidateTeam(s);
        },
      );
  },
});
export const {
  startScenario,
  replaceBrief,
  setDraftField,
  setRequirements,
  setPlanningStep,
  toggleCandidate,
  openSavedScenario,
  editSavedScenario,
} = slice.actions;
export default slice.reducer;
