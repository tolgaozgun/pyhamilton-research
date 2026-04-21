/**
 * Generic API response types and utilities for the frontend.
 */

// Base API response interface
export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data: T | null
  details?: Record<string, unknown> | null
  errors?: ErrorDetail[]
}

// Error detail structure
export interface ErrorDetail {
  code: string
  field?: string
  message: string
  details?: Record<string, unknown>
}

// Pagination info
export interface PaginationInfo {
  total: number
  page: number
  page_size: number
  total_pages: number
}

// Paginated response
export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationInfo
}

// Specific response types
export type SuccessResponse<T> = ApiResponse<T> & { success: true }
export type ErrorResponse = ApiResponse<never> & { success: false }

// API error class
export class ApiError extends Error {
  status: number
  details?: Record<string, unknown>
  errors?: ErrorDetail[]

  constructor(
    message: string,
    status: number,
    details?: Record<string, unknown>,
    errors?: ErrorDetail[]
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
    this.errors = errors
    Object.setPrototypeOf(this, ApiError.prototype)
  }

  static fromResponse(response: ApiResponse<never>, status: number): ApiError {
    return new ApiError(
      response.message,
      status,
      response.details || undefined,
      response.errors || undefined
    )
  }

  isValidationError(): boolean {
    return this.details?.error_type === 'validation' || this.status === 400
  }

  isNotFound(): boolean {
    return this.details?.error_type === 'not_found' || this.status === 404
  }

  isRateLimitError(): boolean {
    return this.details?.error_type === 'rate_limit' || this.status === 429
  }

  isExternalServiceError(): boolean {
    return this.details?.error_type === 'external_service' || this.status === 502
  }

  getRetryAfter(): number | null {
    if (this.details && 'retry_after_seconds' in this.details && typeof this.details.retry_after_seconds === 'number') {
      return this.details.retry_after_seconds as number
    }
    return null
  }

  getFieldErrors(): Record<string, string> {
    if (!this.errors) return {}
    const fieldErrors: Record<string, string> = {}
    this.errors.forEach(error => {
      if (error.field) {
        fieldErrors[error.field] = error.message
      }
    })
    return fieldErrors
  }
}

// Type guards
export function isSuccess<T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: true } {
  return response.success === true
}

export function isError(response: ApiResponse<unknown>): response is ApiResponse<never> & { success: false } {
  return response.success === false
}

export function isPaginated<T>(response: ApiResponse<unknown>): response is ApiResponse<T[]> & { success: true; pagination: PaginationInfo } {
  return 'pagination' in response
}

// Utility type for API call results
export type ApiResult<T> =
  | { success: true; data: T; message: string }
  | { success: false; error: ApiError }

export type AsyncApiResult<T> = Promise<ApiResult<T>>

// Request configuration
export interface ApiRequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  queryParams?: Record<string, string | number | boolean>
  headers?: Record<string, string>
  timeout?: number
  retries?: number
}

// Pagination request parameters
export interface PaginationParams {
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// Common API endpoints
export interface ApiEndpoints {
  // Health check
  health: () => AsyncApiResult<{ status: string }>

  // Agentic endpoints
  agentic: {
    validate: (data: {
      phase: string
      goal: string
      deck_config?: Record<string, unknown>
      procedure_context?: string
      llm_config: Record<string, unknown>
    }) => AsyncApiResult<{ valid: boolean; feedback: string }>

    chat: (data: {
      phase: string
      goal: string
      conversation: Array<{ role: string; content: string }>
      llm_config: Record<string, unknown>
      deck_config?: Record<string, unknown>
      procedure_context?: string
    }) => AsyncApiResult<{ ready: boolean; question?: string; summary?: string }>

    generate: (data: {
      goal: string
      deck_config?: Record<string, unknown>
      procedure_context?: string
      llm_config: Record<string, unknown>
    }) => AsyncApiResult<{ script: string; tests: string; notes?: string }>

    verify: (data: {
      script: string
      tests: string
    }) => AsyncApiResult<{
      syntax: { passed: boolean; exit_code: number; stdout: string; stderr: string; command: string }
      interpreter: { passed: boolean; exit_code: number; stdout: string; stderr: string }
      pytest: { passed: boolean; exit_code: number; stdout: string; stderr: string }
      passed: boolean
      feedback: string
    }>

    fix: (data: {
      goal: string
      deck_config?: Record<string, unknown>
      procedure_context?: string
      script: string
      tests: string
      verification_feedback: string
      llm_config: Record<string, unknown>
    }) => AsyncApiResult<{ script: string; tests: string; notes?: string }>
  }

  // Settings endpoints
  settings: {
    get: () => AsyncApiResult<Record<string, unknown>>
    update: (provider: string, config: Record<string, unknown>) => AsyncApiResult<{ success: boolean }>
  }

  // Labware endpoints
  labware: {
    getCarriers: () => AsyncApiResult<Array<{
      code: string
      name: string
      num_slots: number
      width_rails: number
      category: string
      accepts: string[]
    }>>
  }
}
