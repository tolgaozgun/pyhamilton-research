/**
 * Settings Manager Hook
 * Provides the full settings page data and actions for SettingsPage.
 * Uses settingsService (authenticated) for all settings operations.
 */

import { useState, useCallback, useEffect } from 'react'
import { settingsService } from '../api/services/SettingsService'

export interface ProviderSettings {
  api_key: string | null
  selected_model: string | null
  models_list: any[] | null
  models_fetched_at: string | null
  preferences: {
    temperature?: number
    max_tokens?: number
  }
}

export interface AllSettings {
  anthropic: ProviderSettings
  openai: ProviderSettings
  google: ProviderSettings
}

const DEFAULT_SETTINGS: AllSettings = {
  anthropic: {
    api_key: null,
    selected_model: null,
    models_list: null,
    models_fetched_at: null,
    preferences: { temperature: 0.7, max_tokens: 4096 },
  },
  openai: {
    api_key: null,
    selected_model: null,
    models_list: null,
    models_fetched_at: null,
    preferences: { temperature: 0.7, max_tokens: 4096 },
  },
  google: {
    api_key: null,
    selected_model: null,
    models_list: null,
    models_fetched_at: null,
    preferences: { temperature: 0.7, max_tokens: 4096 },
  },
}

export interface UseSettingsManagerReturn {
  settings: AllSettings
  isLoading: boolean
  fetchSettings: () => Promise<void>
  updateProviderSettings: (provider: keyof AllSettings, updates: Partial<ProviderSettings>) => Promise<void>
  saveProviderModels: (provider: keyof AllSettings, models: any[]) => Promise<void>
}

export function useSettingsManager(): UseSettingsManagerReturn {
  const [settings, setSettings] = useState<AllSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)

  const fetchSettings = useCallback(async () => {
    setIsLoading(true)
    try {
      const data: Record<string, any> = await settingsService.getAllProvidersSettings()

      setSettings({
        anthropic: { ...DEFAULT_SETTINGS.anthropic, ...data.anthropic, models_list: data.anthropic?.models_list || null },
        openai: { ...DEFAULT_SETTINGS.openai, ...data.openai, models_list: data.openai?.models_list || null },
        google: { ...DEFAULT_SETTINGS.google, ...data.google, models_list: data.google?.models_list || null },
      })
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateProviderSettings = useCallback(async (
    provider: keyof AllSettings,
    updates: Partial<ProviderSettings>
  ) => {
    const currentSettings = settings[provider]
    const newSettings = { ...currentSettings, ...updates }

    // Optimistic update
    setSettings(prev => ({ ...prev, [provider]: newSettings }))

    try {
      await settingsService.updateSettings({
        provider: provider as any,
        api_key: newSettings.api_key ?? undefined,
        selected_model: newSettings.selected_model ?? undefined,
        preferences: newSettings.preferences,
      })
    } catch (error) {
      // Revert on error
      setSettings(prev => ({ ...prev, [provider]: currentSettings }))
      throw error
    }
  }, [settings])

  const saveProviderModels = useCallback(async (
    provider: keyof AllSettings,
    models: any[]
  ) => {
    await settingsService.saveProviderModels(provider as string, models)
    setSettings(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        models_list: models,
        models_fetched_at: new Date().toISOString(),
      },
    }))
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  return { settings, isLoading, fetchSettings, updateProviderSettings, saveProviderModels }
}
