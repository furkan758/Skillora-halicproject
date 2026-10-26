export const SCENARIO_PAGE_SIZE = 5;

// Rank the complete result set before taking a page. Ties have a stable order.
export function rankMatches<
  T extends { score: number; employee: { name: string; id: number } },
>(results: T[]) {
  return [...results].sort(
    (a, b) =>
      b.score - a.score ||
      a.employee.name.localeCompare(b.employee.name, "en") ||
      String(a.employee.id).localeCompare(String(b.employee.id), "en"),
  );
}
