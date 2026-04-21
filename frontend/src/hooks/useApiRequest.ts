import { useState, useCallback, useRef } from 'react'
import { apiRepository } from '@/lib/api/repositories'
import { getFieldErrors, isNetworkError, isTimeoutError, type RequestState, createInitialRequestState } from '@/lib/axios'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface UseApiRequestOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: ApiRequestError) => void
  showToast?: boolean
  successMessage?: string
}

export interface ApiRequestError extends Error {
  fieldErrors: Record<string, string>
  isNetworkError: boolean
  isTimeoutError: boolean
  status?: number
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useApiRequest<T = unknown>() {
  const [state, setState] = useState<RequestState<T>>(() => createInitialRequestState<T>())
  const abortControllerRef = useRef<AbortController | null>(null)

  const execute = useCallback(
    async <R = T>(
      apiCall: (repo: typeof apiRepository) => Promise<R>,
      options?: UseApiRequestOptions<R>
    ): Promise<R | null> => {
      // Cancel previous request if exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController()

      setState(prev => ({ ...prev, isLoading: true, error: null, fieldErrors: {} }))

      try {
        const data = await apiCall(apiRepository)

        setState({
          data: data as unknown as T,
          error: null,
          isLoading: false,
          fieldErrors: {},
        })

        // Show success toast if enabled
        if (options?.showToast && options?.successMessage) {
          toast.success(options.successMessage)
        }

        options?.onSuccess?.(data)
        return data
      } catch (error) {
        const errorObj = error as Error
        const fieldErrors = getFieldErrors(error)
        const errorMessage = errorObj.message || 'An error occurred'
        const networkError = isNetworkError(error)
        const timeoutError = isTimeoutError(error)
        const status = (error as { status?: number })?.status
        const wasHandled = error && typeof error === 'object' && '_handled' in error

        const apiError: ApiRequestError = {
          ...errorObj,
          message: errorMessage,
          fieldErrors,
          isNetworkError: networkError,
          isTimeoutError: timeoutError,
          status,
        }

        setState({
          data: null,
          error: errorMessage,
          isLoading: false,
          fieldErrors,
        })

        // Show error toast only if enabled and error wasn't already handled by axios interceptor
        if (options?.showToast && !networkError && !timeoutError && !wasHandled) {
          toast.error(errorMessage)
        }

        options?.onError?.(apiError)
        return null
      }
    },
    []
  )

  const reset = useCallback(() => {
    setState(createInitialRequestState<T>())
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useState(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  })

  return {
    ...state,
    execute,
    reset,
  }
}

// ─── Mutation Hook (for write operations) ───────────────────────────────────────

export function useApiMutation<TData = unknown, TError = Error, TVariables = unknown>() {
  const [state, setState] = useState<{
    data: TData | null
    error: TError | null
    isLoading: boolean
    fieldErrors: Record<string, string>
  }>({
    data: null,
    error: null,
    isLoading: false,
    fieldErrors: {},
  })

  const mutate = useCallback(
    async (
      mutationFn: (variables: TVariables) => Promise<TData>,
      variables: TVariables,
      options?: UseApiRequestOptions<TData>
    ): Promise<TData | null> => {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      try {
        const data = await mutationFn(variables)
        setState({ data, error: null, isLoading: false, fieldErrors: {} })

        if (options?.showToast && options?.successMessage) {
          toast.success(options.successMessage)
        }

        options?.onSuccess?.(data)
        return data
      } catch (error) {
        const errorObj = error as unknown as TError & { fieldErrors?: Record<string, string> }
        const fieldErrors = (error as { fieldErrors?: Record<string, string> }).fieldErrors || {}
        const errorMessage = (error as Error)?.message || 'An error occurred'

        setState({
          data: null,
          error: errorObj as TError,
          isLoading: false,
          fieldErrors,
        })

        if (options?.showToast) {
          toast.error(errorMessage)
        }

        options?.onError?.(error as ApiRequestError)
        return null
      }
    },
    []
  )

  return {
    ...state,
    mutate,
    reset: () => setState({ data: null, error: null, isLoading: false, fieldErrors: {} }),
  }
}

// ─── Query Hook (for read operations with caching) ───────────────────────────────

const queryCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export function useApiQuery<T = unknown>(
  key: string,
  queryFn: (repo: typeof apiRepository) => Promise<T>,
  options?: {
    enabled?: boolean
    staleTime?: number
    onSuccess?: (data: T) => void
  }
) {
  const [state, setState] = useState<RequestState<T>>(() => {
    // Check cache
    const cached = queryCache.get(key)
    if (cached && Date.now() - cached.timestamp < (options?.staleTime || CACHE_DURATION)) {
      return {
        data: cached.data as T,
        error: null,
        isLoading: false,
        fieldErrors: {},
      }
    }
    return createInitialRequestState<T>()
  })

  const fetch = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }))

    try {
      const data = await queryFn(apiRepository)

      // Update cache
      queryCache.set(key, { data, timestamp: Date.now() })

      setState({
        data,
        error: null,
        isLoading: false,
        fieldErrors: {},
      })

      options?.onSuccess?.(data)
    } catch (error) {
      const errorObj = error as Error
      const fieldErrors = getFieldErrors(error)
      setState({
        data: null,
        error: errorObj.message || 'An error occurred',
        isLoading: false,
        fieldErrors,
      })
    }
  }, [key, queryFn, options])

  // Invalidate cache
  const invalidate = useCallback(() => {
    queryCache.delete(key)
  }, [key])

  // Auto-fetch on mount if enabled
  useState(() => {
    if (options?.enabled !== false) {
      fetch()
    }
  })

  return {
    ...state,
    refetch: fetch,
    invalidate,
  }
}
