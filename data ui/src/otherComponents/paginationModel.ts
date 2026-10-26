export const PAGE_SIZE = 15;

export function paginate<T>(
  items: T[],
  requestedPage = 1,
  pageSize = PAGE_SIZE,
) {
  const size = Math.max(1, Math.floor(pageSize) || PAGE_SIZE);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(
    totalPages,
    Math.max(1, Math.floor(requestedPage) || 1),
  );
  const offset = (page - 1) * size;
  return {
    items: items.slice(offset, offset + size),
    page,
    totalPages,
    total,
    start: total ? offset + 1 : 0,
    end: Math.min(offset + size, total),
  };
}

export function pageNumbers(totalPages: number, page: number) {
  if (totalPages <= 7)
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  const keep = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3].forEach((n) => keep.add(n));
  if (page >= totalPages - 2)
    [totalPages - 2, totalPages - 1].forEach((n) => keep.add(n));
  const numbers = [...keep]
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);
  const result: (number | string)[] = [];
  numbers.forEach((n, i) => {
    if (i && n - numbers[i - 1] > 1) result.push(`gap-${n}`);
    result.push(n);
  });
  return result;
}
