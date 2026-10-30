import { createSlice } from "@reduxjs/toolkit";
import type { CatalogState } from "../types";
import { catalogMutations, fetchWorkspace } from "./thunks";
const initialState: CatalogState = {
  folders: [],
  skills: [],
  departments: [],
  overview: {
    employeeCount: 0,
    availableCount: 0,
    departmentCount: 0,
    skillCount: 0,
  },
  saving: false,
  status: "idle",
  error: null,
  revision: 0,
  requestId: null,
};
const slice = createSlice({
  name: "catalog",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchWorkspace.pending, (s, a) => {
      s.requestId = a.meta.requestId;
      s.status = "loading";
      s.error = null;
    })
      .addCase(fetchWorkspace.fulfilled, (s, a) => {
        if (s.requestId !== a.meta.requestId) return;
        s.requestId = null;
        Object.assign(s, a.payload);
        s.status = "succeeded";
        s.revision += 1;
      })
      .addCase(fetchWorkspace.rejected, (s, a) => {
        if (s.requestId !== a.meta.requestId) return;
        s.requestId = null;
        s.status = "failed";
        s.error = a.payload?.message || "Could not load the workspace.";
      });
    catalogMutations.forEach((thunk) => {
      b.addCase(thunk.pending, (s) => {
        s.saving = true;
      })
        .addCase(thunk.fulfilled, (s) => {
          s.saving = false;
        })
        .addCase(thunk.rejected, (s) => {
          s.saving = false;
        });
    });
  },
});
export default slice.reducer;
