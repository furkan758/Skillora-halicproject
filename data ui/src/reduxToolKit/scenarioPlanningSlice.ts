import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import axios from "axios";
import type { ScenarioDraftSnapshot } from "../otherComponents/draftStorage";
import { api } from "../api";
import { apiError } from "../otherComponents/errors";
import { emptyPage } from "../otherComponents/serverPage";
import {
  allocationError,
  blankDraft,
  savedDraft,
  scenarioPayload,
} from "../Scenario/scenarioModel";
import type {
  ApiError,
  AppState,
  Candidate,
  Employee,
  PageResult,
  PlanningState,
  SavedScenario,
  ScenarioDraft,
  ScenarioHeader,
  Selections,
  SkillRequirement,
} from "../types";

type Config = { state: AppState; rejectValue: ApiError };
export const fetchSavedScenarios = createAsyncThunk<
  PageResult<ScenarioHeader>,
  void,
  Config
>("planning/fetchSaved", async (_, { getState, rejectWithValue }) => {
  const { saved, libraryQuery, libraryStatus } = getState().planning;
  try {
    const params = {
      page: saved.page,
      q: libraryQuery,
      status: libraryStatus === "ARCHIVED" ? "ARCHIVED" : undefined,
    };
    let response = await api.get<PageResult<ScenarioHeader>>("/scenarios", {
      params,
    });
    if (saved.page > Math.max(1, response.data.totalPages))
      response = await api.get("/scenarios", {
        params: { ...params, page: Math.max(1, response.data.totalPages) },
      });
    return response.data;
  } catch (error) {
    return rejectWithValue(apiError(error));
  }
});
export const openSavedScenario = createAsyncThunk<
  SavedScenario,
  number,
  Config
>("planning/open", async (id, { rejectWithValue }) => {
  try {
    return (await api.get<SavedScenario>(`/scenarios/${id}`)).data;
  } catch (error) {
    return rejectWithValue(apiError(error));
  }
});
async function currentSelections(
  draft: ScenarioDraft,
  previous: Record<number, { employee: { id: number } }[]>,
) {
  const selections: Selections = {};
  const used = new Set<number>();
  for (const r of draft.requirements) {
    selections[r.skillId] = [];
    for (const selected of previous[r.skillId] || []) {
      try {
        const employee = (
          await api.get<Employee>(`/employees/${selected.employee.id}`)
        ).data;
        const skill = employee.skills.find((s) => s.skillId === r.skillId);
        if (
          !used.has(employee.id) &&
          (!draft.onlyAvailable || employee.isAvailable) &&
          skill?.proficiencyLevel &&
          selections[r.skillId].length < r.count
        ) {
          used.add(employee.id);
          selections[r.skillId].push({
            employee,
            skillId: r.skillId,
            proficiencyLevel: skill.proficiencyLevel,
            compatibility: skill.proficiencyLevel * 20,
          });
        }
      } catch (error) {
        if (!axios.isAxiosError(error) || error.response?.status !== 404)
          throw error;
      }
    }
  }
  return selections;
}
export const editSavedScenario = createAsyncThunk<
  { record: SavedScenario; selections: Selections },
  number,
  Config
>("planning/edit", async (id, { rejectWithValue }) => {
  try {
    const record = (await api.get<SavedScenario>(`/scenarios/${id}`)).data;
    const previous: Record<number, { employee: { id: number } }[]> = {};
    for (const a of record.assignments) {
      // Only IDs are used by currentSelections; profiles are loaded from SQL before editing.
      (previous[a.skillId] ||= []).push({ employee: { id: a.employeeId } });
    }
    return {
      record,
      selections: await currentSelections(savedDraft(record), previous),
    };
  } catch (error) {
    return rejectWithValue(apiError(error));
  }
});
export const findScenarioCandidates = createAsyncThunk<
  Selections,
  void,
  Config
>("planning/prepareTeam", async (_, { getState, rejectWithValue }) => {
  const { draft, selections, restoredSelectionIds } = getState().planning;
  const validation = allocationError(draft, getState().catalog.skills);
  if (validation) return rejectWithValue({ message: validation });
  try {
    return await currentSelections(
      draft,
      restoredSelectionIds
        ? Object.fromEntries(
            Object.entries(restoredSelectionIds).map(([key, ids]) => [
              key,
              ids.map((id) => ({ employee: { id } })),
            ]),
          )
        : selections,
    );
  } catch (error) {
    return rejectWithValue(apiError(error));
  }
});
export const savePlannedScenario = createAsyncThunk<
  SavedScenario,
  void,
  Config
>(
  "planning/save",
  async (_, { getState, dispatch, rejectWithValue }) => {
    const { draft, selections, editingScenarioId, expectedVersion } =
      getState().planning;
    try {
      const payload = scenarioPayload(draft, selections, expectedVersion);
      const result = await (editingScenarioId
        ? api.put<SavedScenario>(`/scenarios/${editingScenarioId}`, payload)
        : api.post<SavedScenario>("/scenarios", payload));
      await dispatch(fetchSavedScenarios());
      return result.data;
    } catch (error) {
      return rejectWithValue(apiError(error));
    }
  },
  {
    condition: (_, { getState }) =>
      getState().planning.saveStatus !== "loading",
  },
);
export const hydrateDraftScenario = createAsyncThunk<
  SavedScenario,
  number,
  Config
>("planning/hydrateDraft", async (id, { rejectWithValue }) => {
  try {
    return (await api.get<SavedScenario>(`/scenarios/${id}`)).data;
  } catch (error) {
    return rejectWithValue(apiError(error));
  }
});
export const scenarioLifecycle = createAsyncThunk<
  { operation: string; record: SavedScenario | null; id: number },
  { record: SavedScenario; operation: "archive" | "restore" | "delete" },
  Config
>(
  "planning/lifecycle",
  async ({ record, operation }, { dispatch, rejectWithValue }) => {
    try {
      const payload = { expectedVersion: record.version };
      const response =
        operation === "delete"
          ? await api.delete(`/scenarios/${record.id}`, { data: payload })
          : await api.post<SavedScenario>(
              `/scenarios/${record.id}/${operation}`,
              payload,
            );
      await dispatch(fetchSavedScenarios());
      return {
        operation,
        record: operation === "delete" ? null : response.data,
        id: record.id,
      };
    } catch (error) {
      return rejectWithValue(apiError(error));
    }
  },
);
const initialState: PlanningState = {
  draft: blankDraft(),
  step: 1,
  selections: {},
  status: "idle",
  requestId: null,
  error: null,
  errorCode: null,
  notice: null,
  saved: emptyPage(),
  libraryQuery: "",
  libraryStatus: "active",
  restoredSelectionIds: null,
  draftStorageError: null,
  savedStatus: "idle",
  libraryError: null,
  libraryRequestId: null,
  saveStatus: "idle",
  activeScenario: null,
  editingScenarioId: null,
  expectedVersion: null,
};
function invalidate(s: PlanningState) {
  s.selections = {};
  s.restoredSelectionIds = null;
  s.status = "idle";
  s.requestId = null;
  s.step = 1;
  s.error = null;
  s.errorCode = null;
  s.notice = null;
  s.saveStatus = "idle";
}
const slice = createSlice({
  name: "planning",
  initialState,
  reducers: {
    restoreLocalDraft: (s, a: PayloadAction<ScenarioDraftSnapshot>) => {
      s.draft = a.payload.draft;
      s.selections = {};
      s.restoredSelectionIds = a.payload.selectionIds;
      s.editingScenarioId = a.payload.editingScenarioId;
      s.expectedVersion = a.payload.expectedVersion;
      s.activeScenario = null;
      s.step = 1;
      s.notice =
        "Unsaved scenario draft restored. Review the brief, then recheck your team before saving.";
    },
    setDraftStorageError: (s, a: PayloadAction<string | null>) => {
      s.draftStorageError = a.payload;
    },
    copyDraftAsNew: (s) => {
      s.editingScenarioId = null;
      s.expectedVersion = null;
      s.activeScenario = null;
      s.notice = "This draft will be saved as a new scenario.";
    },
    setLibraryStatus: (s, a: PayloadAction<"active" | "ARCHIVED">) => {
      s.libraryStatus = a.payload;
      s.saved.page = 1;
      s.libraryRequestId = null;
    },
    startScenario: (s, a: PayloadAction<ScenarioDraft | undefined>) => {
      s.draft = a.payload || blankDraft();
      s.activeScenario = null;
      s.editingScenarioId = null;
      s.expectedVersion = null;
      invalidate(s);
    },
    setDraftField: (
      s,
      a: PayloadAction<
        | {
            field: "clientName" | "projectTitle" | "projectBrief";
            value: string;
          }
        | { field: "requiredPeople"; value: number }
        | { field: "onlyAvailable"; value: boolean }
      >,
    ) => {
      const { field, value } = a.payload;
      if (field === "requiredPeople") s.draft.requiredPeople = value;
      else if (field === "onlyAvailable") s.draft.onlyAvailable = value;
      else s.draft[field] = value;
      s.error = null;
      s.errorCode = null;
      s.saveStatus = "idle";
      // Keep valid selections when returning to edit the brief; revalidate before the next step.
      s.status = "idle";
      s.requestId = null;
    },
    setRequirements: (s, a: PayloadAction<SkillRequirement[]>) => {
      s.draft.requirements = a.payload;
      s.status = "idle";
      s.requestId = null;
      s.error = null;
      s.saveStatus = "idle";
      for (const key of Object.keys(s.selections))
        if (!a.payload.some((r) => r.skillId === Number(key)))
          delete s.selections[Number(key)];
    },
    setPlanningStep: (s, a: PayloadAction<number>) => {
      s.step = a.payload;
      s.error = null;
      s.errorCode = null;
    },
    setLibraryQuery: (s, a: PayloadAction<string>) => {
      s.libraryQuery = a.payload;
      s.saved.page = 1;
      s.libraryRequestId = null;
    },
    setLibraryPage: (s, a: PayloadAction<number>) => {
      s.saved.page = a.payload;
      s.libraryRequestId = null;
    },
    toggleCandidate: (
      s,
      a: PayloadAction<{ skillId: number; candidate: Candidate }>,
    ) => {
      const { skillId, candidate } = a.payload;
      const r = s.draft.requirements.find((r) => r.skillId === skillId);
      if (!r || candidate.skillId !== skillId) return;
      const selected = s.selections[skillId] || [];
      if (selected.some((c) => c.employee.id === candidate.employee.id))
        s.selections[skillId] = selected.filter(
          (c) => c.employee.id !== candidate.employee.id,
        );
      else if (
        selected.length < r.count &&
        !Object.values(s.selections)
          .flat()
          .some((c) => c.employee.id === candidate.employee.id)
      )
        s.selections[skillId] = [...selected, candidate];
      s.error = null;
      s.errorCode = null;
      s.saveStatus = "idle";
    },
  },
  extraReducers: (b) => {
    b.addCase(hydrateDraftScenario.fulfilled, (s, a) => {
      if (s.editingScenarioId !== a.payload.id) return;
      s.activeScenario = a.payload;
      if (s.expectedVersion !== a.payload.version)
        s.notice =
          "Your local draft is based on an older scenario version. Reload the saved scenario before updating, or save the draft as a new scenario.";
    })
      .addCase(hydrateDraftScenario.rejected, (s) => {
        s.notice =
          "The original scenario could not be loaded. Your local draft is kept; you can save it as a new scenario.";
      })
      .addCase(scenarioLifecycle.pending, (s) => {
        s.saveStatus = "loading";
        s.error = null;
      })
      .addCase(scenarioLifecycle.fulfilled, (s, a) => {
        s.saveStatus = "succeeded";
        s.error = null;
        if (s.activeScenario?.id === a.payload.id) {
          if (a.payload.record) {
            s.activeScenario = a.payload.record;
            s.editingScenarioId = null;
            s.expectedVersion = null;
            s.step = 3;
          } else {
            s.activeScenario = null;
            s.draft = blankDraft();
            s.editingScenarioId = null;
            s.expectedVersion = null;
            invalidate(s);
          }
        }
      })
      .addCase(scenarioLifecycle.rejected, (s, a) => {
        s.saveStatus = "failed";
        s.error = a.payload?.message || "Could not update the scenario.";
        s.errorCode = a.payload?.code || null;
      });

    b.addCase(fetchSavedScenarios.pending, (s, a) => {
      s.savedStatus = "loading";
      s.libraryError = null;
      s.libraryRequestId = a.meta.requestId;
    })
      .addCase(fetchSavedScenarios.fulfilled, (s, a) => {
        if (s.libraryRequestId !== a.meta.requestId) return;
        s.saved = a.payload;
        s.savedStatus = "succeeded";
        s.libraryRequestId = null;
      })
      .addCase(fetchSavedScenarios.rejected, (s, a) => {
        if (s.libraryRequestId !== a.meta.requestId) return;
        s.savedStatus = "failed";
        s.libraryError = a.payload?.message || "Could not load scenarios.";
        s.libraryRequestId = null;
      })
      .addCase(openSavedScenario.pending, (s, a) => {
        s.status = "loading";
        s.requestId = a.meta.requestId;
        s.error = null;
      })
      .addCase(openSavedScenario.fulfilled, (s, a) => {
        if (s.requestId !== a.meta.requestId) return;
        invalidate(s);
        s.activeScenario = a.payload;
        s.editingScenarioId = null;
        s.expectedVersion = null;
        s.step = 3;
        s.status = "succeeded";
      })
      .addCase(openSavedScenario.rejected, (s, a) => {
        if (s.requestId !== a.meta.requestId) return;
        s.status = "failed";
        s.error = a.payload?.message || "Could not open scenario.";
        s.requestId = null;
      })
      .addCase(editSavedScenario.pending, (s, a) => {
        s.status = "loading";
        s.requestId = a.meta.requestId;
        s.error = null;
      })
      .addCase(editSavedScenario.fulfilled, (s, a) => {
        if (s.requestId !== a.meta.requestId) return;
        const { record, selections } = a.payload;
        invalidate(s);
        s.activeScenario = record;
        s.editingScenarioId = record.id;
        s.expectedVersion = record.version;
        s.draft = savedDraft(record);
        s.selections = selections;
        s.status = "succeeded";
        if (Object.values(selections).flat().length < record.selectedPeople)
          s.notice =
            "Some saved selections are no longer eligible. Review the remaining places before saving.";
      })
      .addCase(editSavedScenario.rejected, (s, a) => {
        if (s.requestId !== a.meta.requestId) return;
        s.status = "failed";
        s.error = a.payload?.message || "Could not edit scenario.";
        s.requestId = null;
      })
      .addCase(findScenarioCandidates.pending, (s, a) => {
        s.status = "loading";
        s.error = null;
        s.errorCode = null;
        s.requestId = a.meta.requestId;
      })
      .addCase(findScenarioCandidates.fulfilled, (s, a) => {
        if (s.requestId !== a.meta.requestId) return;
        const before = Object.values(s.selections).flat().length;
        s.selections = a.payload;
        s.restoredSelectionIds = null;
        s.status = "succeeded";
        s.step = 2;
        s.requestId = null;
        if (Object.values(a.payload).flat().length < before)
          s.notice =
            "Some selections are no longer eligible. Please fill the remaining places.";
      })
      .addCase(findScenarioCandidates.rejected, (s, a) => {
        if (s.requestId !== a.meta.requestId) return;
        s.status = "failed";
        s.error = a.payload?.message || "Could not check the team.";
        s.requestId = null;
      })
      .addCase(savePlannedScenario.pending, (s) => {
        s.saveStatus = "loading";
        s.error = null;
        s.errorCode = null;
      })
      .addCase(savePlannedScenario.fulfilled, (s, a) => {
        s.activeScenario = a.payload;
        s.editingScenarioId = null;
        s.expectedVersion = null;
        s.saveStatus = "succeeded";
        s.notice = null;
        s.step = 3;
      })
      .addCase(savePlannedScenario.rejected, (s, a) => {
        s.saveStatus = "failed";
        s.error = a.payload?.message || "Could not save scenario.";
        s.errorCode = a.payload?.code || null;
      });
  },
});
export const {
  restoreLocalDraft,
  setDraftStorageError,
  copyDraftAsNew,
  setLibraryStatus,
  startScenario,
  setDraftField,
  setRequirements,
  setPlanningStep,
  toggleCandidate,
  setLibraryPage,
  setLibraryQuery,
} = slice.actions;
export default slice.reducer;
