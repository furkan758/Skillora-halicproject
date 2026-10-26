import test from "node:test";
import assert from "node:assert/strict";
import {
  PAGE_SIZE,
  paginate,
  pageNumbers,
} from "../src/otherComponents/paginationModel.ts";
import {
  initialEmployees,
  initialFolders,
  initialSkillCatalog,
} from "../src/mockDatas/data.ts";

test("a second page starts at record 16 and exact multiples have no empty last page", () => {
  const items = Array.from({ length: 31 }, (_, i) => i + 1);
  assert.equal(PAGE_SIZE, 15);
  assert.deepEqual(paginate(items, 2).items, items.slice(15, 30));
  assert.deepEqual(paginate(items, 3).items, [31]);
  assert.equal(paginate(items.slice(0, 15)).totalPages, 1);
  assert.equal(paginate(items.slice(0, 16)).totalPages, 2);
  assert.equal(paginate(items.slice(0, 30)).totalPages, 2);
});

test("filtering, an empty collection, and deleting the final record cannot produce an invalid page", () => {
  const items = Array.from({ length: 16 }, (_, i) => i);
  const afterDelete = paginate(items.slice(0, 15), 2);
  assert.equal(afterDelete.page, 1);
  assert.equal(afterDelete.items.length, 15);
  const empty = paginate([], 4);
  assert.deepEqual(empty.items, []);
  assert.equal(empty.page, 1);
  assert.equal(empty.start, 0);
  assert.equal(empty.end, 0);
  assert.equal(paginate(items, -10).page, 1);
  assert.equal(paginate(items, 99).page, 2);
});

test("every employee, skill, and folder appears once across pages, with no more than 15 per page", () => {
  for (const records of [
    initialEmployees,
    initialSkillCatalog,
    initialFolders,
  ]) {
    const { totalPages } = paginate(records);
    const allPages = Array.from({ length: totalPages }, (_, i) =>
      paginate(records, i + 1),
    );
    assert.ok(
      allPages.every(
        (page) => page.items.length <= 15 && page.items.length > 0,
      ),
    );
    assert.deepEqual(
      allPages.flatMap((page) => page.items.map((item) => item.id)),
      records.map((item) => item.id),
    );
    assert.equal(
      new Set(allPages.flatMap((page) => page.items.map((item) => item.id)))
        .size,
      records.length,
    );
  }
});

test("page navigation keeps first, last and current pages reachable with compact ellipses", () => {
  for (let page = 1; page <= 20; page++) {
    const numbers = pageNumbers(20, page);
    assert.ok(numbers.includes(1));
    assert.ok(numbers.includes(20));
    assert.ok(numbers.includes(page));
    assert.equal(new Set(numbers).size, numbers.length);
    assert.ok(numbers.length <= 7);
  }
  assert.deepEqual(pageNumbers(2, 1), [1, 2]);
});
