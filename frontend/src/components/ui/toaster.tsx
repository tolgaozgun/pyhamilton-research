import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      expand={false}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'toast',
          title: 'toast-title',
          description: 'toast-description',
          actionButton: 'toast-action-button',
          cancelButton: 'toast-cancel-button',
          closeButton: 'toast-close-button',
          success: 'toast-success',
          error: 'toast-error',
          warning: 'toast-warning',
          info: 'toast-info',
        },
      }}
    />
  )
}
