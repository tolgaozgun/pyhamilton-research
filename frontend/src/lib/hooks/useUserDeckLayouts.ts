import { useState, useCallback } from 'react'
import { apiRepository } from '@/lib/api/repositories'
import type { UserDeckLayout, DeckConfig, DeckLayoutValidationResult } from '@/types'

export interface UseUserDeckLayoutsReturn {
  layouts: UserDeckLayout[]
  isLoading: boolean
  isSaving: boolean
  isValidating: boolean
  isImporting: boolean
  fetchLayouts: () => Promise<void>
  createLayout: (name: string, configuration: DeckConfig, description?: string) => Promise<UserDeckLayout | null>
  updateLayout: (id: number, payload: Partial<{ name: string; description: string; configuration: DeckConfig }>) => Promise<UserDeckLayout | null>
  deleteLayout: (id: number) => Promise<void>
  importJson: (name: string, file: File, description?: string) => Promise<UserDeckLayout | null>
  validateLayout: (id: number) => Promise<DeckLayoutValidationResult | null>
}

export function useUserDeckLayouts(): UseUserDeckLayoutsReturn {
  const [layouts, setLayouts] = useState<UserDeckLayout[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const fetchLayouts = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await apiRepository.deckLayouts.list()
      setLayouts(data ?? [])
    } catch {
      // error toast handled by repository
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createLayout = useCallback(async (
    name: string,
    configuration: DeckConfig,
    description?: string,
  ): Promise<UserDeckLayout | null> => {
    setIsSaving(true)
    try {
      const layout = await apiRepository.deckLayouts.create({ name, description, configuration })
      setLayouts((prev) => [layout, ...prev])
      return layout
    } catch {
      return null
    } finally {
      setIsSaving(false)
    }
  }, [])

  const updateLayout = useCallback(async (
    id: number,
    payload: Partial<{ name: string; description: string; configuration: DeckConfig }>,
  ): Promise<UserDeckLayout | null> => {
    setIsSaving(true)
    try {
      const updated = await apiRepository.deckLayouts.update(id, payload)
      setLayouts((prev) => prev.map((l) => (l.id === id ? updated : l)))
      return updated
    } catch {
      return null
    } finally {
      setIsSaving(false)
    }
  }, [])

  const deleteLayout = useCallback(async (id: number): Promise<void> => {
    try {
      await apiRepository.deckLayouts.remove(id)
      setLayouts((prev) => prev.filter((l) => l.id !== id))
    } catch {
      // error toast handled by repository
    }
  }, [])

  const importJson = useCallback(async (
    name: string,
    file: File,
    description?: string,
  ): Promise<UserDeckLayout | null> => {
    setIsImporting(true)
    try {
      const layout = await apiRepository.deckLayouts.importJson(name, file, description)
      setLayouts((prev) => [layout, ...prev])
      return layout
    } catch {
      return null
    } finally {
      setIsImporting(false)
    }
  }, [])

  const validateLayout = useCallback(async (id: number): Promise<DeckLayoutValidationResult | null> => {
    setIsValidating(true)
    try {
      const result = await apiRepository.deckLayouts.validate(id)
      // Update the validation status in the local list
      setLayouts((prev) =>
        prev.map((l) =>
          l.id === id
            ? { ...l, validation_status: result.valid ? 'valid' : 'invalid', validation_feedback: result.feedback }
            : l
        )
      )
      return result
    } catch {
      return null
    } finally {
      setIsValidating(false)
    }
  }, [])

  return {
    layouts,
    isLoading,
    isSaving,
    isValidating,
    isImporting,
    fetchLayouts,
    createLayout,
    updateLayout,
    deleteLayout,
    importJson,
    validateLayout,
  }
}
