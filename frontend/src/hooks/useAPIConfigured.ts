import { useEffect, useState } from 'react'
import { settingsService } from '@/lib/api/services/SettingsService'

interface APIConfigStatus {
  isConfigured: boolean
  configuredProvider: string | null
  selectedModel: string | null
  isLoading: boolean
  refetch: () => void
}

export function useAPIConfigured(): APIConfigStatus {
  const [status, setStatus] = useState<APIConfigStatus>({
    isConfigured: false,
    configuredProvider: null,
    selectedModel: null,
    isLoading: true,
    refetch: () => fetchConfig(),
  })

  const fetchConfig = async () => {
    try {
      const data: Record<string, any> = await settingsService.getAllProvidersSettings()

      for (const provider of ['google', 'anthropic', 'openai']) {
        if (data[provider]?.api_key) {
          setStatus({
            isConfigured: true,
            configuredProvider: provider,
            selectedModel: data[provider]?.selected_model || null,
            isLoading: false,
            refetch: () => fetchConfig(),
          })
          return
        }
      }

      setStatus({
        isConfigured: false,
        configuredProvider: null,
        selectedModel: null,
        isLoading: false,
        refetch: () => fetchConfig(),
      })
    } catch (error) {
      console.error('Failed to fetch API config:', error)
      setStatus({
        isConfigured: false,
        configuredProvider: null,
        selectedModel: null,
        isLoading: false,
        refetch: () => fetchConfig(),
      })
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  return status
}
