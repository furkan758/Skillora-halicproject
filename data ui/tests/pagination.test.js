import test from "node:test";
import assert from "node:assert/strict";
import { pageControls } from "../src/otherComponents/serverPage.ts";
import { pageNumbers } from "../src/otherComponents/paginationModel.ts";
test("server totals determine page numbers and record ranges", () => {
  const rows = {
    items: Array(15).fill({}),
    total: 42,
    page: 2,
    pageSize: 15,
    totalPages: 3,
  };
  const controls = pageControls(rows, () => {});
  assert.deepEqual(
    [controls.start, controls.end, controls.totalPages],
    [16, 30, 3],
  );
  assert.deepEqual(pageNumbers(3, 2), [1, 2, 3]);
  const empty = pageControls(
    { items: [], total: 0, page: 1, pageSize: 15, totalPages: 0 },
    () => {},
  );
  assert.equal(empty.start, 0);
  assert.equal(empty.end, 0);
});
