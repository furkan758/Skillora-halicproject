import type { PageResult } from "../types";
export const emptyPage = <T>(pageSize = 15): PageResult<T> => ({
  items: [],
  total: 0,
  page: 1,
  pageSize,
  totalPages: 0,
});
export function pageControls<T>(
  result: PageResult<T>,
  goToPage: (page: number) => void,
) {
  return {
    ...result,
    start: result.items.length ? (result.page - 1) * result.pageSize + 1 : 0,
    end: result.items.length
      ? (result.page - 1) * result.pageSize + result.items.length
      : 0,
    goToPage,
  };
}
