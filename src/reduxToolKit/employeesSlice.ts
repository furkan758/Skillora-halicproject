import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { EmployeesState } from "../types";
import { catalogMutations, fetchEmployees, saveEmployee } from "./thunks";

const initialState: EmployeesState = {
  items: [],
  status: "idle",
  error: null,
  query: "",
  department: "All",
  availability: "All",
};
const employeesSlice = createSlice({
  name: "employees",
  initialState,
  reducers: {
    setQuery: (s, a: PayloadAction<string>) => {
      s.query = a.payload;
    },
    setDepartment: (s, a: PayloadAction<string>) => {
      s.department = a.payload;
    },
    setAvailability: (s, a: PayloadAction<string>) => {
      s.availability = a.payload;
    },
    clearFilters: (s) => {
      s.query = "";
      s.department = "All";
      s.availability = "All";
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchEmployees.pending, (s) => {
      s.status = "loading";
      s.error = null;
    })
      .addCase(fetchEmployees.fulfilled, (s, a) => {
        s.items = a.payload.employees;
        s.status = "succeeded";
      })
      .addCase(fetchEmployees.rejected, (s) => {
        s.status = "failed";
        s.error = "Could not load the workspace. Please try again.";
      })
      .addCase(saveEmployee.fulfilled, (s, a) => {
        const index = s.items.findIndex((e) => e.id === a.payload.id);
        if (index < 0) s.items.push(a.payload);
        else s.items[index] = a.payload;
      });
    catalogMutations.forEach((thunk) =>
      b.addCase(thunk.fulfilled, (s, a) => {
        s.items = a.payload.employees;
      }),
    );
  },
});
export const { setQuery, setDepartment, setAvailability, clearFilters } =
  employeesSlice.actions;
export default employeesSlice.reducer;
