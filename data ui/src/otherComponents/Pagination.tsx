import { ChevronLeft, ChevronRight } from "lucide-react";
import type { RefObject } from "react";
import { useEffect, useState } from "react";
import "../scss/pagination.scss";
import { PAGE_SIZE, pageNumbers, paginate } from "./paginationModel";

export function usePagination<T>(
  items: T[],
  resetKey = "",
  pageSize = PAGE_SIZE,
) {
  const [selection, setSelection] = useState({ key: resetKey, page: 1 });
  const result = paginate(
    items,
    selection.key === resetKey ? selection.page : 1,
    pageSize,
  );
  // Clamp after deletes, and reset when filters or the selected folder change.
  useEffect(() => {
    setSelection((previous) =>
      previous.key === resetKey && previous.page === result.page
        ? previous
        : { key: resetKey, page: result.page },
    );
  }, [resetKey, result.page]);
  return {
    ...result,
    goToPage: (page: number) => setSelection({ key: resetKey, page }),
  };
}

export default function Pagination({
  pagination,
  label,
  scrollTarget,
}: {
  pagination: ReturnType<typeof usePagination>;
  label: string;
  scrollTarget?: RefObject<HTMLElement | null>;
}) {
  const { page, totalPages, start, end, total } = pagination;
  const changePage = (next: number) => {
    pagination.goToPage(next);
    scrollTarget?.current?.scrollIntoView({
      block: "start",
      behavior: "instant",
    });
  };
  return (
    <div className="pagination-bar">
      <p className="pagination-summary" role="status">
        Showing{" "}
        <strong>
          {start}
          {end !== start ? `–${end}` : ""}
        </strong>{" "}
        of <strong>{total}</strong> {label.toLowerCase()}
      </p>
      {totalPages > 1 && (
        <nav className="pagination-controls" aria-label={`${label} pagination`}>
          <button
            className="pagination-arrow"
            disabled={page === 1}
            aria-label={`Previous ${label.toLowerCase()} page`}
            onClick={() => changePage(page - 1)}
          >
            <ChevronLeft size={15} />
            <span>Previous</span>
          </button>
          {pageNumbers(totalPages, page).map((number) =>
            typeof number === "number" ? (
              <button
                key={number}
                className={number === page ? "current" : ""}
                aria-current={number === page ? "page" : undefined}
                aria-label={`Go to ${label.toLowerCase()} page ${number}`}
                onClick={() => changePage(number)}
              >
                {number}
              </button>
            ) : (
              <span className="pagination-gap" key={number} aria-hidden="true">
                …
              </span>
            ),
          )}
          <button
            className="pagination-arrow"
            disabled={page === totalPages}
            aria-label={`Next ${label.toLowerCase()} page`}
            onClick={() => changePage(page + 1)}
          >
            <span>Next</span>
            <ChevronRight size={15} />
          </button>
        </nav>
      )}
    </div>
  );
}
