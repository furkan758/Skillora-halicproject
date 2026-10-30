import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { EmployeesState } from "../types";
import { emptyPage } from "../otherComponents/serverPage";
import { fetchEmployees } from "./thunks";
const initialState: EmployeesState = {
  ...emptyPage(),
  status: "idle",
  error: null,
  requestId: null,
  query: "",
  department: "All",
  availability: "All",
};
const slice = createSlice({
  name: "employees",
  initialState,
  reducers: {
    setQuery: (s, a: PayloadAction<string>) => {
      s.query = a.payload;
      s.page = 1;
      s.requestId = null;
    },
    setDepartment: (s, a: PayloadAction<string>) => {
      s.department = a.payload;
      s.page = 1;
      s.requestId = null;
    },
    setAvailability: (s, a: PayloadAction<string>) => {
      s.availability = a.payload;
      s.page = 1;
      s.requestId = null;
    },
    setEmployeePage: (s, a: PayloadAction<number>) => {
      s.page = a.payload;
      s.requestId = null;
    },
    clearFilters: (s) => {
      s.query = "";
      s.department = "All";
      s.availability = "All";
      s.page = 1;
      s.requestId = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchEmployees.pending, (s, a) => {
      s.status = "loading";
      s.error = null;
      s.requestId = a.meta.requestId;
    })
      .addCase(fetchEmployees.fulfilled, (s, a) => {
        if (s.requestId !== a.meta.requestId) return;
        Object.assign(s, a.payload);
        s.status = "succeeded";
        s.requestId = null;
      })
      .addCase(fetchEmployees.rejected, (s, a) => {
        if (s.requestId !== a.meta.requestId) return;
        s.status = "failed";
        s.error = a.payload?.message || "Could not load the team.";
        s.requestId = null;
      });
  },
});
export const {
  setQuery,
  setDepartment,
  setAvailability,
  setEmployeePage,
  clearFilters,
} = slice.actions;
export default slice.reducer;
