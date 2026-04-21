/**
 * Toast notification system using Sonner for displaying API messages and errors.
 */
import { toast as sonnerToast } from 'sonner'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

/**
 * Toast notification helper functions using Sonner.
 */
export const toast = {
  success: (title: string, message?: string) => {
    if (message) {
      sonnerToast.success(title, {
        description: message,
      })
    } else {
      sonnerToast.success(title)
    }
  },

  error: (title: string, message?: string) => {
    if (message) {
      sonnerToast.error(title, {
        description: message,
        duration: 6000, // Errors stay longer
      })
    } else {
      sonnerToast.error(title, {
        duration: 6000,
      })
    }
  },

  warning: (title: string, message?: string) => {
    if (message) {
      sonnerToast.warning(title, {
        description: message,
      })
    } else {
      sonnerToast.warning(title)
    }
  },

  info: (title: string, message?: string) => {
    if (message) {
      sonnerToast.info(title, {
        description: message,
      })
    } else {
      sonnerToast.info(title)
    }
  },

  withAction: (
    type: ToastType,
    title: string,
    actionLabel: string,
    actionFn: () => void,
    message?: string
  ) => {
    const toastFn = type === 'success' ? sonnerToast.success :
                      type === 'error' ? sonnerToast.error :
                      type === 'warning' ? sonnerToast.warning :
                      sonnerToast.info

    toastFn(title, {
      description: message,
      action: {
        label: actionLabel,
        onClick: actionFn,
      },
    })
  },

  promise: <T,>(
    promise: Promise<T>,
    {
      loading,
      success,
      error
    }: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: unknown) => string)
    }
  ) => {
    return sonnerToast.promise(promise, {
      loading,
      success: (data) => {
        return typeof success === 'function' ? success(data) : success
      },
      error: (err) => {
        return typeof error === 'function' ? error(err) : error
      },
    })
  },
}

/**
 * Handle API result and show appropriate toast.
 */
export function handleApiToast<T>(
  result: { success: boolean; data?: T; message?: string; error?: any },
  options?: {
    successTitle?: string
    errorTitle?: string
    showErrorDetails?: boolean
    onSuccess?: (data: T) => void
    onError?: (error: any) => void
  }
): void {
  const {
    successTitle = 'Success',
    errorTitle = 'Error',
    showErrorDetails = true,
    onSuccess,
    onError,
  } = options || {}

  if (result.success) {
    const message = result.message || 'Operation completed successfully'
    toast.success(successTitle, message)

    if (onSuccess && result.data !== undefined) {
      onSuccess(result.data)
    }
  } else {
    const errorMessage = result.error?.message || 'An error occurred'
    const details = result.error?.details

    if (showErrorDetails && details && typeof details === 'object') {
      // Format details for display
      const detailsString = Object.entries(details)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join(', ')

      toast.error(errorTitle, `${errorMessage} (${detailsString})`)
    } else {
      toast.error(errorTitle, errorMessage)
    }

    if (onError && result.error) {
      onError(result.error)
    }
  }
}

/**
 * Handle loading states with toast promises.
 */
export function handleApiPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((error: unknown) => string)
  }
) {
  return toast.promise(promise, messages)
}
