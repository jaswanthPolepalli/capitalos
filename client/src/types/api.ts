/**
 * Shared API response envelope and pagination types used across all modules.
 * Real Catalyst Functions will return this shape; mock hooks mirror it exactly.
 */

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;
