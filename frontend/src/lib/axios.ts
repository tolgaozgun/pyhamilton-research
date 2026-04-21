import axios, {type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig} from 'axios'
import { toast } from 'sonner'

console.log('🚀🚀🚀 [AXIOS] AXIOS FILE LOADED!!! 🚀🚀🚀')

// ─── Module Augmentation ──────────────────────────────────────────────────────────

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    metadata?: {
      startTime: number
    }
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiError {
  message: string
  code?: string
  field?: string
  details?: unknown
}

export interface ApiResponse<T = unknown> {
  data: T
  message?: string
  errors?: ApiError[]
}

export interface ApiErrorResponse {
  detail?: string | { msg?: string; loc?: (string | number)[]; type?: string }[]
  message?: string
  errors?: ApiError[]
  // Backend standard response format
  success?: boolean
  data?: Record<string, string> // Field errors in data object
  details?: {
    error_type?: string
    service?: string
    retry_after_seconds?: number
    [key: string]: any
  }
}

// ─── Axios Instances ───────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// Base axios instance for non-authenticated requests
export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 120000, // 2 minutes for LLM responses
  withCredentials: true, // Send httpOnly cookies on every request
  headers: {
    'Content-Type': 'application/json',
  },
})

// Authenticated axios instance — cookies are sent automatically via withCredentials
export const axiosAuthInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,
  withCredentials: true, // Sends httpOnly access_token cookie automatically
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Request Interceptors ─────────────────────────────────────────────────────

// Shared request setup: track timing + let FormData set its own Content-Type
function setupRequest(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  config.metadata = { startTime: Date.now() }
  // When sending FormData, remove the hardcoded JSON Content-Type so axios can
  // set the correct multipart/form-data boundary automatically.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
}

// Base instance interceptor
axiosInstance.interceptors.request.use(
  setupRequest,
  (error: AxiosError) => Promise.reject(error)
)

// Auth instance interceptor — cookies are sent automatically, just track timing
axiosAuthInstance.interceptors.request.use(
  setupRequest,
  (error: AxiosError) => Promise.reject(error)
)

// ─── Response Interceptors ─────────────────────────────────────────────────────

// Base instance response interceptor
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // Calculate request duration
    const duration = Date.now() - (response.config.metadata?.startTime || Date.now())
    console.debug(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status} (${duration}ms)`)
    return response
  },
  (error: AxiosError<ApiErrorResponse>) => {
    return handleApiError(error)
  }
)

// Auth instance response interceptor - handles token refresh
axiosAuthInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // Calculate request duration
    const duration = Date.now() - (response.config.metadata?.startTime || Date.now())
    console.debug(`[API AUTH] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status} (${duration}ms)`)
    return response
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Handle 401 errors with silent token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        // POST to refresh — the refresh_token httpOnly cookie is sent automatically
        await axios.post(`${BASE_URL}/api/auth/refresh`, {}, { withCredentials: true })
        // Retry original request — the new access_token cookie is now set
        return axiosAuthInstance(originalRequest)
      } catch (refreshError) {
        // Refresh failed — show session expired warning and redirect to login
        if (window.location.pathname !== '/auth') {
          toast.warning('Session expired', {
            id: 'session-expired',
            description: 'Please log in again.',
          })
          window.location.href = '/auth'
        }
        return Promise.reject(refreshError)
      }
    }

    return handleApiError(error)
  }
)

// ─── Error Handler ─────────────────────────────────────────────────────────────

function handleApiError(error: AxiosError<ApiErrorResponse>): Promise<never> {
  // Network error (no response) - show toast since there's no proper error response
  if (!error.response) {
    const errorType = detectErrorType(error)
    const { title, description, action } = getErrorMessage(errorType, error)

    toast.error(title, {
      description,
      duration: 8000,
      action: action ? {
        label: action,
        onClick: () => {
          if (action === 'Check API key') {
            // Navigate to settings
            window.location.href = '/settings'
          }
        },
      } : undefined,
    })

    return Promise.reject({
      message: title,
      description,
      errorType,
      originalError: error,
    })
  }

  // Server responded with error - don't show toast here, let application layer handle it
  // This prevents duplicate toasts since components will handle the error
  const { status, data } = error.response

  // 401: session expired — show a single deduplicated warning and redirect
  if (status === 401 && window.location.pathname !== '/auth') {
    toast.warning('Session expired', {
      id: 'session-expired',
      description: 'Please log in again.',
    })
    window.location.href = '/auth'
    return Promise.reject({
      message: 'Session expired',
      status: 401,
      _handled: true,
    })
  }

  const { title, description } = getServerErrorMessage(status, data)

  return Promise.reject({
    message: title,
    description,
    status,
    fieldErrors: parseFieldErrors(data),
    originalError: error,
    // Add flag to indicate this was handled by the interceptor
    _handled: true,
  })
}

// ─── Error Type Detection ───────────────────────────────────────────────────────

type ErrorType =
  | 'timeout'
  | 'network_unreachable'
  | 'api_key_missing'
  | 'api_key_invalid'
  | 'rate_limited'
  | 'content_filtered'
  | 'malformed_response'
  | 'empty_response'
  | 'server_error'
  | 'unknown'

function detectErrorType(error: AxiosError): ErrorType {
  const code = error.code
  const message = error.message?.toLowerCase() || ''

  // Timeout
  if (code === 'ECONNABORTED' || message.includes('timeout')) {
    return 'timeout'
  }

  // Network unreachable
  if (code === 'ERR_NETWORK' || message.includes('network')) {
    return 'network_unreachable'
  }

  // API key issues (check if it's our own API response indicating missing key)
  if (message.includes('api key') || message.includes('authentication')) {
    return message.includes('invalid') ? 'api_key_invalid' : 'api_key_missing'
  }

  // Content filtering
  if (message.includes('filtered') || message.includes('policy') || message.includes('safety')) {
    return 'content_filtered'
  }

  // Malformed response
  if (message.includes('parse') || message.includes('json') || message.includes('format')) {
    return 'malformed_response'
  }

  // Empty response
  if (message.includes('empty') || message.includes('no data')) {
    return 'empty_response'
  }

  return 'unknown'
}

// ─── Error Message Helpers ───────────────────────────────────────────────────────

function getErrorMessage(
  errorType: ErrorType,
  error: AxiosError
): { title: string; description: string; action?: string } {
  switch (errorType) {
    case 'timeout':
      return {
        title: 'Request timed out',
        description: `The request took too long to complete. This could be due to:
• Slow network connection
• High server load
• Large request size

Try again or reduce the complexity of your request.`,
      }

    case 'network_unreachable':
      return {
        title: 'Network unreachable',
        description: `Unable to connect to the server. This could be:
• No internet connection
• Firewall blocking the request
• Server is down
• VPN or proxy issues

Check your internet connection and try again.`,
      }

    case 'api_key_missing':
      return {
        title: 'API key required',
        description: 'Please configure an AI provider API key in settings to use this feature.',
        action: 'Check API key',
      }

    case 'api_key_invalid':
      return {
        title: 'Invalid API key',
        description: 'The API key you provided is invalid or has expired. Please check your API key in settings.',
        action: 'Update API key',
      }

    case 'rate_limited':
      return {
        title: 'Rate limited',
        description: 'You have exceeded the rate limit. Please wait a moment and try again.',
      }

    case 'content_filtered':
      return {
        title: 'Content filtered',
        description: `The AI provider flagged the content as potentially harmful. This could be due to:
• Sensitive topics
• Policy violations
• Safety filters

Try rephrasing your request.`,
      }

    case 'malformed_response':
      return {
        title: 'Invalid response format',
        description: `The server returned an unexpected response. This could indicate:
• API implementation changed
• Backend configuration issue
• Data format mismatch

Please try again. If the problem persists, check for updates.`,
      }

    case 'empty_response':
      return {
        title: 'Empty response',
        description: `The AI provider returned an empty response. This could be:
• Request format issue
• Provider API change
• Temporary service issue

Please try again.`,
      }

    case 'server_error':
      return {
        title: 'Server error',
        description: `Something went wrong on the server. Please try again.`,
      }

    default:
      return {
        title: 'Request failed',
        description: error.message || 'An unexpected error occurred. Please try again.',
      }
  }
}

function getServerErrorMessage(
  status: number,
  data: ApiErrorResponse | undefined
): { title: string; description: string } {
  const errorMessage = parseErrorMessage(data)
  const errorDetails = data?.details

  switch (status) {
    case 400:
      return {
        title: 'Invalid request',
        description: `${errorMessage}

Please check your input and try again.`,
      }

    case 401:
      return {
        title: 'Authentication required',
        description: 'You need to be logged in to perform this action.',
      }

    case 403:
      return {
        title: 'Access denied',
        description: 'You do not have permission to perform this action.',
      }

    case 404:
      return {
        title: 'Not found',
        description: 'The requested resource was not found.',
      }

    case 422:
      return {
        title: 'Validation failed',
        description: `${errorMessage}

Please correct the errors and try again.`,
      }

    case 429:
      // Enhanced rate limit message with retry information
      const retryAfter = errorDetails?.retry_after_seconds
      const service = errorDetails?.service || 'API'
      let description = `${errorMessage}`

      if (retryAfter) {
        const minutes = Math.floor(retryAfter / 60)
        const seconds = retryAfter % 60
        const waitTime = minutes > 0
          ? `${minutes} minute${minutes > 1 ? 's' : ''}${seconds > 0 ? ` ${seconds} second${seconds > 1 ? 's' : ''}` : ''}`
          : `${seconds} second${seconds > 1 ? 's' : ''}`

        description = `${service} rate limit exceeded. Please wait ${waitTime} before trying again.`
      } else {
        description = `${service} rate limit exceeded. Please wait a moment before trying again.`
      }

      return {
        title: 'Rate limit exceeded',
        description,
      }

    case 500:
      return {
        title: 'Server error',
        description: 'The server encountered an unexpected error. Please try again later.',
      }

    case 502:
    case 503:
      return {
        title: 'Service unavailable',
        description: 'The service is temporarily unavailable. Please try again later.',
      }

    case 504:
      return {
        title: 'Gateway timeout',
        description: 'The server took too long to respond. Please try again.',
      }

    default:
      return {
        title: 'Error',
        description: errorMessage || 'An unexpected error occurred.',
      }
  }
}

// ─── Error Parsers ────────────────────────────────────────────────────────────

function parseErrorMessage(data: ApiErrorResponse | undefined): string {
  if (!data) return 'An unexpected error occurred.'

  // Handle backend standard response format (success: false)
  if (data.success === false && data.message) {
    return data.message
  }

  // Handle FastAPI validation error format
  if (Array.isArray(data.detail)) {
    const firstError = data.detail[0]
    if (firstError?.msg) {
      return firstError.msg
    }
  }

  // Handle string detail
  if (typeof data.detail === 'string') {
    return data.detail
  }

  // Handle message field
  if (data.message) {
    return data.message
  }

  // Handle errors array
  if (data.errors && data.errors.length > 0) {
    return data.errors[0].message || 'Validation error'
  }

  return 'An unexpected error occurred.'
}

function parseFieldErrors(data: ApiErrorResponse | undefined): string | null {
  if (!data) return null

  // Handle backend standard response format (field errors in data object)
  if (data.success === false && data.data && typeof data.data === 'object') {
    const fieldErrors: string[] = []
    for (const [field, message] of Object.entries(data.data)) {
      // Remove 'body.' prefix if present (FastAPI adds this)
      const cleanField = field.replace(/^body\./, '')
      fieldErrors.push(`${cleanField}: ${message}`)
    }
    return fieldErrors.length > 0 ? fieldErrors.join('\n') : null
  }

  // Handle FastAPI validation error format
  if (Array.isArray(data.detail)) {
    return data.detail
      .map(err => {
        const field = err.loc?.join('.')
        return field ? `${field}: ${err.msg}` : err.msg
      })
      .join('\n')
  }

  // Handle errors array with field info
  if (data.errors && data.errors.length > 0) {
    return data.errors
      .map(err => err.field ? `${err.field}: ${err.message}` : err.message)
      .join('\n')
  }

  return null
}

// ─── Utility Functions ───────────────────────────────────────────────────────────

export function getFieldErrors(error: unknown): Record<string, string> {
  const fieldErrors: Record<string, string> = {}

  if (error && typeof error === 'object' && 'fieldErrors' in error) {
    const errors = (error as { fieldErrors?: string | null })?.fieldErrors
    if (typeof errors === 'string') {
      errors.split('\n').forEach(err => {
        const [field, ...messageParts] = err.split(': ')
        if (field && messageParts.length > 0) {
          fieldErrors[field] = messageParts.join(': ')
        }
      })
    }
  }

  return fieldErrors
}

export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ('code' in error ? error.code === 'ERR_NETWORK' : false)
  )
}

export function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ('code' in error ? error.code === 'ECONNABORTED' : false)
  )
}

export function isAPIKeyError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const message = (error as { message?: string }).message || ''
    return message.toLowerCase().includes('api key') || message.toLowerCase().includes('authentication')
  }
  return false
}

// ─── Request State Types ───────────────────────────────────────────────────────

export type RequestState<T> = {
  data: T | null
  error: string | null
  isLoading: boolean
  fieldErrors: Record<string, string>
}

export function createInitialRequestState<T>(): RequestState<T> {
  return {
    data: null,
    error: null,
    isLoading: false,
    fieldErrors: {},
  }
}
