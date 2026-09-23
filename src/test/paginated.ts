import type { PaginatedResponse, PaginationMeta } from "../api";

/**
 * Builds the `{ data, meta }` envelope the catalogue endpoints return
 * (`/players`, `/coaches`, the admin lists), so page tests mock the real shape
 * instead of a bare array.
 */
export function paginated<T>(
  data: T[],
  overrides: Partial<PaginationMeta> = {},
): PaginatedResponse<T> {
  return {
    data,
    meta: {
      page: 1,
      per_page: 20,
      total: data.length,
      total_pages: data.length === 0 ? 0 : 1,
      ...overrides,
    },
  };
}
