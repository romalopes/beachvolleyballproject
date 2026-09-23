import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
}

function getPageNumbers(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  const pages: (number | "ellipsis")[] = [];
  const maxVisiblePages = 7;

  if (totalPages <= maxVisiblePages) {
    // Show all pages if total is small
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    // Always show first page
    pages.push(1);

    if (currentPage <= 4) {
      // Near the beginning
      for (let i = 2; i <= 5; i++) {
        pages.push(i);
      }
      pages.push("ellipsis");
    } else if (currentPage >= totalPages - 3) {
      // Near the end
      pages.push("ellipsis");
      for (let i = totalPages - 4; i < totalPages; i++) {
        pages.push(i);
      }
    } else {
      // In the middle
      pages.push("ellipsis");
      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
        pages.push(i);
      }
      pages.push("ellipsis");
    }

    // Always show last page
    pages.push(totalPages);
  }

  return pages;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage = 20,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <div className="pagination">
      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn pagination-nav"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          aria-label="First page"
          title="First page"
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          type="button"
          className="pagination-btn pagination-nav"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
          title="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="pagination-pages">
          {pageNumbers.map((page, index) =>
            page === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                …
              </span>
            ) : (
              <button
                key={page}
                type="button"
                className={`pagination-btn pagination-page ${page === currentPage ? "active" : ""}`}
                onClick={() => onPageChange(page)}
                aria-label={`Page ${page}`}
                aria-current={page === currentPage ? "page" : undefined}
              >
                {page}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          className="pagination-btn pagination-nav"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
          title="Next page"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          className="pagination-btn pagination-nav"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="Last page"
          title="Last page"
        >
          <ChevronsRight size={16} />
        </button>
      </div>

      <div className="pagination-info">
        Showing <strong>{startItem}</strong>–<strong>{endItem}</strong> of <strong>{totalItems}</strong> items
      </div>
    </div>
  );
}