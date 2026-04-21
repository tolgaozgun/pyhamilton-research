/**
 * Settings Hook
 * Custom hook for settings operations using SettingsService
 */

import { useState, useCallback } from 'react'
import { settingsService } from '../api/services/SettingsService'
import type {
  GetSettingsResponse,
  UpdateSettingsRequest,
  RefreshModelsResponse,
  ActiveProviderResponse
} from '../api/types/settings.types'
import { toast } from 'sonner'

export interface UseSettingsReturn {
  settings: GetSettingsResponse | null
  activeProvider: ActiveProviderResponse | null
  isLoading: boolean
  error: string | null
  getSettings: () => Promise<void>
  getActiveProvider: () => Promise<void>
  updateSettings: (request: UpdateSettingsRequest) => Promise<void>
  refreshModels: (provider: string) => Promise<RefreshModelsResponse>
  validateApiKey: (provider: string, apiKey: string) => Promise<boolean>
  setActiveProvider: (provider: string) => Promise<void>
  deleteProviderSettings: (provider: string) => Promise<void>
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<GetSettingsResponse | null>(null)
  const [activeProvider, setActiveProviderState] = useState<ActiveProviderResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await settingsService.getSettings()
      setSettings(data)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load settings'
      setError(errorMessage)
      toast.error('Error', errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getActiveProvider = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await settingsService.getActiveProvider()
      setActiveProviderState(data)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load active provider'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateSettings = useCallback(async (request: UpdateSettingsRequest) => {
    setIsLoading(true)
    setError(null)

    try {
      await settingsService.updateSettings(request)
      toast.success('Settings updated', { description: 'Your settings have been saved successfully.' })
      await getSettings() // Refresh settings
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to update settings'
      setError(errorMessage)
      toast.error('Error', errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [getSettings])

  const refreshModels = useCallback(async (provider: string): Promise<RefreshModelsResponse> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await settingsService.refreshModels({ provider: provider as any })
      toast.success('Models refreshed', { description: `Successfully fetched available models for ${provider}.` })
      return response
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to refresh models'
      setError(errorMessage)
      toast.error('Error', errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const validateApiKey = useCallback(async (provider: string, apiKey: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await settingsService.validateApiKey(provider, apiKey)
      if (response.valid) {
        toast.success('API Key Valid', { description: `Your ${provider} API key is valid.` })
      } else {
        toast.error('Invalid API Key', { description: response.message || 'Please check your API key and try again.' })
      }
      return response.valid
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to validate API key'
      setError(errorMessage)
      toast.error('Error', errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const setActiveProvider = useCallback(async (provider: string) => {
    setIsLoading(true)
    setError(null)

    try {
      await settingsService.setActiveProvider(provider)
      toast.success('Provider updated', { description: `${provider} is now your active AI provider.` })
      await getSettings() // Refresh settings
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to set active provider'
      setError(errorMessage)
      toast.error('Error', errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [getSettings])

  const deleteProviderSettings = useCallback(async (provider: string) => {
    setIsLoading(true)
    setError(null)

    try {
      await settingsService.deleteProviderSettings(provider)
      toast.success('Settings deleted', { description: `Settings for ${provider} have been deleted.` })
      await getSettings() // Refresh settings
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete settings'
      setError(errorMessage)
      toast.error('Error', errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [getSettings])

  return {
    settings,
    activeProvider,
    isLoading,
    error,
    getSettings,
    getActiveProvider,
    updateSettings,
    refreshModels,
    validateApiKey,
    setActiveProvider,
    deleteProviderSettings
  }
}