import { createAsyncThunk } from "@reduxjs/toolkit";
import type { AxiosResponse } from "axios";
import { api } from "../api";
import { apiError } from "../otherComponents/errors";
import type {
  ApiError,
  AppState,
  Catalog,
  Employee,
  EmployeeInput,
  FolderInput,
  RankedMatch,
  SkillInput,
  WorkspaceSnapshot,
} from "../types";

export const fetchEmployees = createAsyncThunk("employees/fetch", async () => {
  const [employees, catalog] = await Promise.all([
    api.get<Employee[]>("/employees"),
    api.get<Catalog>("/skill-catalog"),
  ]);
  return { employees: employees.data, catalog: catalog.data };
});
export const saveEmployee = createAsyncThunk(
  "employees/save",
  async (employee: EmployeeInput) =>
    (
      await (employee.id
        ? api.put<Employee>(`/employees/${employee.id}`, employee)
        : api.post<Employee>("/employees", employee))
    ).data,
);
const mutation = <T>(
  name: string,
  request: (input: T) => Promise<AxiosResponse<WorkspaceSnapshot>>,
) =>
  createAsyncThunk<WorkspaceSnapshot, T, { rejectValue: ApiError }>(
    name,
    async (input, { rejectWithValue }) => {
      try {
        return (await request(input)).data;
      } catch (error) {
        return rejectWithValue(apiError(error));
      }
    },
  );
export const saveSkill = mutation("catalog/saveSkill", (skill: SkillInput) =>
  skill.id
    ? api.put(`/skills/${encodeURIComponent(skill.id)}`, skill)
    : api.post("/skills", skill),
);
export const deleteSkill = mutation(
  "catalog/deleteSkill",
  ({
    id,
    confirmAssignedRemoval,
  }: {
    id: string;
    confirmAssignedRemoval: boolean;
  }) =>
    api.delete(`/skills/${encodeURIComponent(id)}`, {
      data: { confirmAssignedRemoval },
    }),
);
export const saveFolder = mutation(
  "catalog/saveFolder",
  (folder: FolderInput) =>
    folder.id
      ? api.put(`/skill-folders/${encodeURIComponent(folder.id)}`, folder)
      : api.post("/skill-folders", folder),
);
export const deleteFolder = mutation("catalog/deleteFolder", (id: string) =>
  api.delete(`/skill-folders/${encodeURIComponent(id)}`),
);
export const catalogMutations = [
  saveSkill,
  deleteSkill,
  saveFolder,
  deleteFolder,
];
export const evaluateScenario = createAsyncThunk<
  RankedMatch[],
  void,
  { state: AppState }
>("scenario/evaluate", async (_, { getState }) => {
  const { criteria, onlyAvailable } = getState().scenario;
  return (
    await api.post<RankedMatch[]>("/scenarios/evaluate", {
      criteria,
      onlyAvailable,
    })
  ).data;
});
