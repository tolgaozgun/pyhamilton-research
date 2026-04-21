import { useState, useCallback } from 'react'
import { aiService, type AIProvider, type AIModel } from '@/lib/ai/service'

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface UseAIModelsOptions {
  provider: AIProvider
  enabled?: boolean
}

// ─── Models Hook ───────────────────────────────────────────────────────────────────

export function useAIModels(options: UseAIModelsOptions) {
  const [state, setState] = useState<{
    models: AIModel[]
    isLoading: boolean
    error: string | null
  }>({
    models: [],
    isLoading: false,
    error: null,
  })

  const fetchModels = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const models = await aiService.fetchModels(options.provider)
      setState({ models, isLoading: false, error: null })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch models'
      setState({ models: [], isLoading: false, error: errorMessage })
    }
  }, [options.provider])

  // Auto-fetch on mount if enabled
  useState(() => {
    if (options.enabled !== false) {
      fetchModels()
    }
  })

  return {
    ...state,
    refetch: fetchModels,
  }
}

// ─── All Models Hook (multiple providers) ────────────────────────────────────────────

export function useAllAIModels() {
  const [state, setState] = useState<{
    models: Record<AIProvider, AIModel[]>
    isLoading: boolean
    error: string | null
  }>({
    models: {
      anthropic: [],
      openai: [],
      google: [],
    },
    isLoading: false,
    error: null,
  })

  const fetchAllModels = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const providers: AIProvider[] = ['anthropic', 'openai', 'google']
      const models: Record<AIProvider, AIModel[]> = {
        anthropic: [],
        openai: [],
        google: [],
      }

      await Promise.all(
        providers.map(async (provider) => {
          try {
            models[provider] = await aiService.fetchModels(provider)
          } catch {
            models[provider] = []
          }
        })
      )

      setState({ models, isLoading: false, error: null })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch models'
      setState({ models: { anthropic: [], openai: [], google: [] }, isLoading: false, error: errorMessage })
    }
  }, [])

  return {
    ...state,
    refetch: fetchAllModels,
    getAllModels: () => {
      return Object.entries(state.models).flatMap(([provider, models]) =>
        models.map(m => ({ ...m, provider: provider as AIProvider }))
      )
    },
  }
}
