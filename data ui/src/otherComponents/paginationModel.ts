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
