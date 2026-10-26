import { createSlice } from "@reduxjs/toolkit";
import type { CatalogState } from "../types";
import { catalogMutations, fetchEmployees } from "./thunks";

const initialState: CatalogState = { folders: [], skills: [], saving: false };
const catalogSlice = createSlice({
  name: "catalog",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchEmployees.fulfilled, (s, a) => {
      Object.assign(s, a.payload.catalog);
    });
    catalogMutations.forEach((thunk) => {
      b.addCase(thunk.pending, (s) => {
        s.saving = true;
      })
        .addCase(thunk.fulfilled, (s, a) => {
          Object.assign(s, a.payload.catalog);
          s.saving = false;
        })
        .addCase(thunk.rejected, (s) => {
          s.saving = false;
        });
    });
  },
});
export default catalogSlice.reducer;
