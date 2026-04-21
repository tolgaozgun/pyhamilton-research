/**
 * Labware Items Hook
 * CRUD operations for the LabwarePage, backed by LabwareType.
 */

import { useState, useCallback } from 'react'
import { labwareItemService, type LabwareItem } from '../api/services/LabwareService'

export interface UseLabwareItemsReturn {
  labware: LabwareItem[]
  isLoading: boolean
  fetchLabware: () => Promise<void>
  createLabware: (data: Partial<LabwareItem>) => Promise<void>
  updateLabware: (id: number, data: Partial<LabwareItem>) => Promise<void>
  deleteLabware: (id: number) => Promise<void>
}

export function useLabwareItems(): UseLabwareItemsReturn {
  const [labware, setLabware] = useState<LabwareItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchLabware = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await labwareItemService.getAll()
      setLabware(data)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createLabware = useCallback(async (data: Partial<LabwareItem>) => {
    await labwareItemService.create(data)
    await fetchLabware()
  }, [fetchLabware])

  const updateLabware = useCallback(async (id: number, data: Partial<LabwareItem>) => {
    await labwareItemService.update(id, data)
    await fetchLabware()
  }, [fetchLabware])

  const deleteLabware = useCallback(async (id: number) => {
    await labwareItemService.remove(id)
    await fetchLabware()
  }, [fetchLabware])

  return { labware, isLoading, fetchLabware, createLabware, updateLabware, deleteLabware }
}
