/**
 * Enhanced Base Repository with standardized error handling and toast notifications.
 */
import { toast } from '../toast'
import type { ApiResponse } from './types'
import { axiosInstance, axiosAuthInstance } from '../axios'

export interface RequestConfig {
  timeout?: number
  headers?: Record<string, string>
}

// ─── Enhanced Base Repository Classes ─────────────────────────────────────────────

/**
 * Base Repository for non-authenticated requests
 */
export abstract class BaseRepository {
  protected axiosInstance = axiosInstance

  protected async get<T>(url: string, config?: RequestConfig): Promise<T> {
    console.log(`📡 API GET: ${url}`)

    try {
      const response = await this.axiosInstance.get<ApiResponse<T>>(url, config)
      const data = response.data

      // Handle the new standardized response format
      if (data && typeof data === 'object' && 'success' in data) {
        if (!data.success) {
          const error = data as ApiResponse<never>
          toast.error('Request Failed', error.message)
          throw new Error(error.message)
        }
        console.log(`✅ API GET ${url} response:`, data.data)
        return data.data as T
      }

      // Handle legacy direct data response
      console.log(`✅ API GET ${url} response:`, data)
      return data as T

    } catch (error) {
      console.error(`❌ API GET ${url} error:`, error)
      this.handleApiError(error)
      throw error
    }
  }

  protected async post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    console.log(`📡 API POST: ${url}`)
    console.log(`📤 Request data:`, data)

    try {
      const response = await this.axiosInstance.post<ApiResponse<T>>(url, data, config)
      const responseData = response.data

      // Handle the new standardized response format
      if (responseData && typeof responseData === 'object' && 'success' in responseData) {
        if (!responseData.success) {
          const error = responseData as ApiResponse<never>
          this.handleErrorResponse(error)
          throw new Error(error.message)
        }
        console.log(`✅ API POST ${url} response:`, responseData.data)

        // Show success message if present
        if (responseData.message && responseData.message !== 'Success') {
          toast.success('Success', responseData.message)
        }

        return responseData.data as T
      }

      // Handle legacy direct data response
      console.log(`✅ API POST ${url} response:`, responseData)
      return responseData as T

    } catch (error) {
      console.error(`❌ API POST ${url} error:`, error)
      if (error && typeof error === 'object' && 'response' in error) {
        console.error(`❌ Response data:`, (error as any).response?.data)
        console.error(`❌ Response status:`, (error as any).response?.status)
      }
      this.handleApiError(error)
      throw error
    }
  }

  protected async put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    console.log(`📡 API PUT: ${url}`)
    console.log(`📤 Request data:`, data)

    try {
      const response = await this.axiosInstance.put<ApiResponse<T>>(url, data, config)
      const responseData = response.data

      // Handle the new standardized response format
      if (responseData && typeof responseData === 'object' && 'success' in responseData) {
        if (!responseData.success) {
          const error = responseData as ApiResponse<never>
          this.handleErrorResponse(error)
          throw new Error(error.message)
        }
        console.log(`✅ API PUT ${url} response:`, responseData.data)

        // Show success message if present
        if (responseData.message && responseData.message !== 'Success') {
          toast.success('Success', responseData.message)
        }

        return responseData.data as T
      }

      // Handle legacy direct data response
      console.log(`✅ API PUT ${url} response:`, responseData)
      return responseData as T

    } catch (error) {
      console.error(`❌ API PUT ${url} error:`, error)
      this.handleApiError(error)
      throw error
    }
  }

  protected async patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    console.log(`📡 API PATCH: ${url}`)
    console.log(`📤 Request data:`, data)

    try {
      const response = await this.axiosInstance.patch<ApiResponse<T>>(url, data, config)
      const responseData = response.data

      // Handle the new standardized response format
      if (responseData && typeof responseData === 'object' && 'success' in responseData) {
        if (!responseData.success) {
          const error = responseData as ApiResponse<never>
          this.handleErrorResponse(error)
          throw new Error(error.message)
        }
        console.log(`✅ API PATCH ${url} response:`, responseData.data)

        // Show success message if present
        if (responseData.message && responseData.message !== 'Success') {
          toast.success('Success', responseData.message)
        }

        return responseData.data as T
      }

      // Handle legacy direct data response
      console.log(`✅ API PATCH ${url} response:`, responseData)
      return responseData as T

    } catch (error) {
      console.error(`❌ API PATCH ${url} error:`, error)
      this.handleApiError(error)
      throw error
    }
  }

  protected async delete<T>(url: string, config?: RequestConfig): Promise<T> {
    console.log(`📡 API DELETE: ${url}`)

    try {
      const response = await this.axiosInstance.delete<ApiResponse<T>>(url, config)
      const responseData = response.data

      // Handle the new standardized response format
      if (responseData && typeof responseData === 'object' && 'success' in responseData) {
        if (!responseData.success) {
          const error = responseData as ApiResponse<never>
          this.handleErrorResponse(error)
          throw new Error(error.message)
        }
        console.log(`✅ API DELETE ${url} response:`, responseData.data)

        // Show success message if present
        if (responseData.message && responseData.message !== 'Success') {
          toast.success('Success', responseData.message)
        }

        return responseData.data as T
      }

      // Handle legacy direct data response
      console.log(`✅ API DELETE ${url} response:`, responseData)
      return responseData as T

    } catch (error) {
      console.error(`❌ API DELETE ${url} error:`, error)
      this.handleApiError(error)
      throw error
    }
  }

  /**
   * Handle API errors with toast notifications.
   */
  private handleApiError(error: unknown): void {
    // Already handled by axios interceptor (e.g. 401 session-expired toast)
    if (error && typeof error === 'object' && '_handled' in error) {
      return
    }

    // Don't show toast for validation errors (422/400) - let the form handle them
    if (this.isAxiosError(error)) {
      const axiosError = error as {
        response?: { data?: { message?: string; details?: unknown; data?: Record<string, string> }; status?: number }
        code?: string
      }

      if (axiosError.response?.data) {
        const data = axiosError.response.data
        const message = data.message || this.getDefaultErrorMessage(axiosError.response.status)

        // Skip toast for validation errors with field errors
        const hasFieldErrors = data.data && typeof data.data === 'object' && Object.keys(data.data).length > 0

        if (hasFieldErrors) {
          // Don't show toast for field validation errors
          return
        }

        // Handle specific error types
        if (axiosError.response.status === 429) {
          toast.error('Rate Limit Exceeded', message)
        } else if (axiosError.response.status === 403) {
          toast.error('Permission Denied', message)
        } else if (axiosError.response.status === 404) {
          toast.error('Not Found', message)
        } else if (axiosError.response.status === 502 || axiosError.response.status === 503) {
          toast.error('Service Unavailable', message)
        } else {
          toast.error('Request Failed', message)
        }
      } else if (axiosError.code === 'ECONNABORTED') {
        toast.error('Timeout', 'Request timed out. Please try again.')
      } else if (axiosError.code === 'ERR_NETWORK') {
        toast.error('Network Error', 'Unable to connect to the server. Please check your connection.')
      } else {
        toast.error('Request Failed', 'An unexpected error occurred. Please try again.')
      }
    } else {
      toast.error('Error', 'An unexpected error occurred. Please try again.')
    }
  }

  /**
   * Handle error responses with specific details.
   */
  private handleErrorResponse(error: ApiResponse<never>): void {
    const message = error.message || 'Request failed'

    // Handle validation errors
    if (error.details?.error_type === 'validation') {
      toast.error('Validation Error', message)
    }
    // Handle rate limit errors
    else if (error.details?.error_type === 'rate_limit') {
      const retryAfter = error.details.retry_after_seconds as number | undefined
      const retryMessage = retryAfter
        ? `${message}. Retry after ${retryAfter} seconds.`
        : message
      toast.error('Rate Limit Exceeded', retryMessage)
    }
    // Handle external service errors
    else if (error.details?.error_type === 'external_service') {
      const service = error.details.service as string || 'External service'
      toast.error('Service Error', `${service}: ${message}`)
    }
    // Handle general errors
    else {
      toast.error('Request Failed', message)
    }
  }

  /**
   * Get default error message for HTTP status codes.
   */
  private getDefaultErrorMessage(status?: number): string {
    const messages: Record<number, string> = {
      400: 'Invalid request. Please check your input.',
      401: 'Authentication required.',
      403: 'Permission denied.',
      404: 'Resource not found.',
      429: 'Too many requests. Please wait and try again.',
      500: 'Server error. Please try again later.',
      502: 'Service unavailable.',
      503: 'Service temporarily unavailable.'
    }

    return status && messages[status]
      ? messages[status]
      : 'Request failed. Please try again.'
  }

  /**
   * Type guard for Axios errors.
   */
  private isAxiosError(error: unknown): error is { response?: unknown; code?: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'isAxiosError' in error
    )
  }
}

/**
 * Authenticated Base Repository for requests requiring authentication
 * Extends BaseRepository and uses authenticated axios instance
 */
export abstract class AuthenticatedRepository extends BaseRepository {
  protected axiosInstance = axiosAuthInstance
}

// ─── React Hook Helpers ─────────────────────────────────────────────────────────

import { useState, useCallback } from 'react'
import { createInitialRequestState, getFieldErrors, type RequestState } from '../axios'

export interface UseApiOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: Error & { fieldErrors?: Record<string, string> }) => void
  showToasts?: boolean
}

export function createApiHook<T, Args extends unknown[] = []>(
  apiFn: (...args: Args) => Promise<T>
) {
  return function useApi(options?: UseApiOptions<T>) {
    const [state, setState] = useState<RequestState<T>>(createInitialRequestState<T>())

    const execute = useCallback(
      async (...args: Args) => {
        setState(prev => ({ ...prev, isLoading: true, error: null, fieldErrors: {} }))

        try {
          const data = await apiFn(...args)
          setState({ data, error: null, isLoading: false, fieldErrors: {} })

          if (options?.showToasts !== false) {
            toast.success('Success', 'Operation completed successfully')
          }

          options?.onSuccess?.(data)
          return data
        } catch (error) {
          const errorObj = error as Error & { fieldErrors?: Record<string, string> }
          const fieldErrors = getFieldErrors(error)
          const errorMessage = errorObj.message || 'An error occurred'

          setState({
            data: null,
            error: errorMessage,
            isLoading: false,
            fieldErrors,
          })

          if (options?.showToasts !== false) {
            toast.error('Error', errorMessage)
          }

          options?.onError?.({ ...errorObj, fieldErrors })
          throw error
        }
      },
      [apiFn, options]
    )

    return { ...state, execute }
  }
}
