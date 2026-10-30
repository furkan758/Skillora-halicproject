import { createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../api";
import { apiError } from "../otherComponents/errors";
import type {
  ApiError,
  AppState,
  Catalog,
  Department,
  Employee,
  EmployeeInput,
  FolderInput,
  Overview,
  PageResult,
  SkillInput,
} from "../types";

type Config = { state: AppState; rejectValue: ApiError };
export const fetchWorkspace = createAsyncThunk<
  Catalog & { departments: Department[]; overview: Overview },
  void,
  Config
>("catalog/fetch", async (_, { rejectWithValue }) => {
  try {
    const [catalog, departments, overview] = await Promise.all([
      api.get<Catalog>("/catalog"),
      api.get<Department[]>("/departments"),
      api.get<Overview>("/overview"),
    ]);
    return {
      ...catalog.data,
      departments: departments.data,
      overview: overview.data,
    };
  } catch (error) {
    return rejectWithValue(apiError(error));
  }
});
export const fetchEmployees = createAsyncThunk<
  PageResult<Employee>,
  void,
  Config
>("employees/fetch", async (_, { getState, rejectWithValue }) => {
  const { query, department, availability, page } = getState().employees;
  const params = {
    q: query,
    page,
    departmentId: department === "All" ? undefined : Number(department),
    available:
      availability === "All" ? undefined : availability === "Available",
  };
  try {
    let response = await api.get<PageResult<Employee>>("/employees", {
      params,
    });
    if (page > Math.max(1, response.data.totalPages))
      response = await api.get("/employees", {
        params: { ...params, page: Math.max(1, response.data.totalPages) },
      });
    return response.data;
  } catch (error) {
    return rejectWithValue(apiError(error));
  }
});
export const saveEmployee = createAsyncThunk<Employee, EmployeeInput, Config>(
  "employees/save",
  async ({ id, ...payload }, { dispatch, rejectWithValue }) => {
    try {
      const result = await (id
        ? api.put<Employee>(`/employees/${id}`, payload)
        : api.post<Employee>("/employees", payload));
      await Promise.all([
        dispatch(fetchWorkspace()),
        dispatch(fetchEmployees()),
      ]);
      return result.data;
    } catch (error) {
      return rejectWithValue(apiError(error));
    }
  },
);
export const deleteEmployee = createAsyncThunk<number, number, Config>(
  "employees/delete",
  async (id, { dispatch, rejectWithValue }) => {
    try {
      await api.delete(`/employees/${id}`);
      await Promise.all([
        dispatch(fetchWorkspace()),
        dispatch(fetchEmployees()),
      ]);
      return id;
    } catch (error) {
      return rejectWithValue(apiError(error));
    }
  },
);
function mutation<T>(name: string, request: (input: T) => Promise<unknown>) {
  return createAsyncThunk<void, T, Config>(
    name,
    async (input, { dispatch, rejectWithValue }) => {
      try {
        await request(input);
        await Promise.all([
          dispatch(fetchWorkspace()),
          dispatch(fetchEmployees()),
        ]);
      } catch (error) {
        return rejectWithValue(apiError(error));
      }
    },
  );
}
export const saveSkill = mutation(
  "catalog/saveSkill",
  ({ id, ...payload }: SkillInput) =>
    id ? api.put(`/skills/${id}`, payload) : api.post("/skills", payload),
);
export const deleteSkill = mutation(
  "catalog/deleteSkill",
  ({
    id,
    confirmAssignedRemoval,
  }: {
    id: number;
    confirmAssignedRemoval: boolean;
  }) => api.delete(`/skills/${id}`, { data: { confirmAssignedRemoval } }),
);
export const saveFolder = mutation(
  "catalog/saveFolder",
  ({ id, ...payload }: FolderInput) =>
    id ? api.put(`/folders/${id}`, payload) : api.post("/folders", payload),
);
export const deleteFolder = mutation("catalog/deleteFolder", (id: number) =>
  api.delete(`/folders/${id}`),
);
export const restoreSkill = mutation("catalog/restoreSkill", (id: number) =>
  api.post(`/skills/${id}/restore`),
);
export const catalogMutations = [
  restoreSkill,
  saveSkill,
  deleteSkill,
  saveFolder,
  deleteFolder,
];
