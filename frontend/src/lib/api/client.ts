/**
 * Simplified API client with consistent error handling.
 */
import { axiosInstance } from '@/lib/axios'
import type { ApiResponse } from './types'

/**
 * Simple API client that handles standardized responses.
 */
class ApiClient {
  private baseURL = '/api'

  /**
   * Make an API request with standardized response handling.
   */
  private async request<T>(
    endpoint: string,
    config: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
      body?: unknown
      queryParams?: Record<string, string | number | boolean>
      headers?: Record<string, string>
      timeout?: number
    } = {}
  ): Promise<T> {
    const {
      method = 'GET',
      body,
      queryParams,
      headers = {},
      timeout = 30000
    } = config

    try {
      const response = await axiosInstance.request<ApiResponse<T>>({
        method,
        url: `${this.baseURL}${endpoint}`,
        data: body,
        params: queryParams,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        timeout,
      })

      const apiResponse = response.data

      // Handle standardized API response format
      if (apiResponse.success) {
        return apiResponse.data as T
      } else {
        // Extract error details
        const errorMessage = apiResponse.message || 'Request failed'
        const error = new Error(errorMessage) as Error & { details?: unknown; status?: number }
        error.details = apiResponse.details
        error.status = response.status
        throw error
      }
    } catch (error) {
      // If the error was already handled by the axios interceptor, re-throw as-is
      if (error && typeof error === 'object' && '_handled' in error) {
        throw error
      }
      // Otherwise, wrap and re-throw
      throw error
    }
  }

  /**
   * Extended request method for use by auth client.
   * Provides more direct access to request parameters.
   */
  async requestDirect<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
    body?: unknown,
    queryParams?: Record<string, string | number | boolean>,
    headers?: Record<string, string>,
    timeout?: number
  ): Promise<T> {
    return this.request<T>(endpoint, { method, body, queryParams, headers, timeout })
  }

  /**
   * GET request helper.
   */
  async get<T>(endpoint: string, queryParams?: Record<string, string | number | boolean>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', queryParams })
  }

  /**
   * POST request helper.
   */
  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body })
  }

  /**
   * PUT request helper.
   */
  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body })
  }

  /**
   * DELETE request helper.
   */
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  /**
   * PATCH request helper.
   */
  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body })
  }
}

// Export singleton instance
export const apiClient = new ApiClient()
