/**
 * Labware Hook
 * Custom hook for labware operations using LabwareService
 */

import { useState, useCallback } from 'react'
import { labwareService } from '../api/services/LabwareService'
import type {
  LabwareCarrier,
  LabwarePlate,
  LabwareTip,
  Labware,
  DeckConfiguration,
  ValidateDeckConfigResponse,
  GetDeckLayoutResponse
} from '../api/types/labware.types'
import { toast } from 'sonner'

export interface UseLabwareReturn {
  carriers: LabwareCarrier[]
  plates: LabwarePlate[]
  tips: LabwareTip[]
  allLabware: Labware[]
  isLoading: boolean
  error: string | null
  getCarriers: () => Promise<void>
  getPlates: () => Promise<void>
  getTips: () => Promise<void>
  getAllLabware: () => Promise<void>
  getCarrier: (code: string) => Promise<LabwareCarrier>
  getPlate: (code: string) => Promise<LabwarePlate>
  getTip: (code: string) => Promise<LabwareTip>
  validateDeckConfig: (config: DeckConfiguration) => Promise<ValidateDeckConfigResponse>
  getDeckLayout: () => Promise<GetDeckLayoutResponse>
  getCompatibleLabware: (carrierCode: string) => Promise<Labware[]>
}

export function useLabware(): UseLabwareReturn {
  const [carriers, setCarriers] = useState<LabwareCarrier[]>([])
  const [plates, setPlates] = useState<LabwarePlate[]>([])
  const [tips, setTips] = useState<LabwareTip[]>([])
  const [allLabware, setAllLabware] = useState<Labware[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getCarriers = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await labwareService.getCarriers()
      setCarriers(data)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load carriers'
      setError(errorMessage)
      toast.error('Error', errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getPlates = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await labwareService.getPlates()
      setPlates(data)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load plates'
      setError(errorMessage)
      toast.error('Error', errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getTips = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await labwareService.getTips()
      setTips(data)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load tips'
      setError(errorMessage)
      toast.error('Error', errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getAllLabware = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await labwareService.getAllLabware()
      setAllLabware(data)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load labware'
      setError(errorMessage)
      toast.error('Error', errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getCarrier = useCallback(async (code: string): Promise<LabwareCarrier> => {
    try {
      return await labwareService.getCarrier(code)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load carrier'
      setError(errorMessage)
      toast.error('Error', errorMessage)
      throw err
    }
  }, [])

  const getPlate = useCallback(async (code: string): Promise<LabwarePlate> => {
    try {
      return await labwareService.getPlate(code)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load plate'
      setError(errorMessage)
      toast.error('Error', errorMessage)
      throw err
    }
  }, [])

  const getTip = useCallback(async (code: string): Promise<LabwareTip> => {
    try {
      return await labwareService.getTip(code)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load tip'
      setError(errorMessage)
      toast.error('Error', errorMessage)
      throw err
    }
  }, [])

  const validateDeckConfig = useCallback(async (config: DeckConfiguration): Promise<ValidateDeckConfigResponse> => {
    try {
      const response = await labwareService.validateDeckConfig(config)
      if (response.valid) {
        toast.success('Valid Configuration', { description: 'Your deck configuration is valid.' })
      } else {
        toast.error('Invalid Configuration', { description: response.errors.join(', ') })
      }
      return response
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to validate deck configuration'
      setError(errorMessage)
      toast.error('Error', errorMessage)
      throw err
    }
  }, [])

  const getDeckLayout = useCallback(async (): Promise<GetDeckLayoutResponse> => {
    try {
      return await labwareService.getDeckLayout()
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get deck layout'
      setError(errorMessage)
      toast.error('Error', errorMessage)
      throw err
    }
  }, [])

  const getCompatibleLabware = useCallback(async (carrierCode: string): Promise<Labware[]> => {
    try {
      return await labwareService.getCompatibleLabware(carrierCode)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to get compatible labware'
      setError(errorMessage)
      toast.error('Error', errorMessage)
      throw err
    }
  }, [])

  return {
    carriers,
    plates,
    tips,
    allLabware,
    isLoading,
    error,
    getCarriers,
    getPlates,
    getTips,
    getAllLabware,
    getCarrier,
    getPlate,
    getTip,
    validateDeckConfig,
    getDeckLayout,
    getCompatibleLabware
  }
}