import { ChevronLeft, ChevronRight } from "lucide-react";
import type { RefObject } from "react";
import "../scss/pagination.scss";
import { pageNumbers } from "./paginationModel";

export default function Pagination({
  pagination,
  label,
  scrollTarget,
}: {
  pagination: {
    page: number;
    totalPages: number;
    start: number;
    end: number;
    total: number;
    goToPage: (page: number) => void;
  };
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
