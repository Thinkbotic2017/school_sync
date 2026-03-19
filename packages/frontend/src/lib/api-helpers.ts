export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

const DEFAULT_META: PaginationMeta = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

// Unwraps: AxiosResponse.data (ApiResponse) → .data (PaginatedResponse) → { data, meta }
export function unwrapList<T>(response: unknown): PaginatedResult<T> {
  const apiResponse = (response as any)?.data;
  const paginated = apiResponse?.data;
  return {
    data: Array.isArray(paginated?.data) ? paginated.data : [],
    meta: paginated?.meta ?? DEFAULT_META,
  };
}

// Unwraps: AxiosResponse.data (ApiResponse) → .data (single item)
export function unwrapItem<T>(response: unknown): T | null {
  return (response as any)?.data?.data ?? null;
}
