/**
 * Labware Service
 * Handles all labware-related API calls
 */

import { AuthenticatedRepository } from '../repository'
import type {
  LabwareCarrier,
  LabwarePlate,
  LabwareTip,
  Labware,
  DeckConfiguration,
  ValidateDeckConfigResponse,
  GetDeckLayoutResponse
} from '../types/labware.types'

export class LabwareService extends AuthenticatedRepository {
  private readonly baseUrl = '/api/labware'

  /**
   * Get all available carriers
   */
  async getCarriers(): Promise<LabwareCarrier[]> {
    return this.get<LabwareCarrier[]>(`${this.baseUrl}/carriers`)
  }

  /**
   * Get carrier by code
   */
  async getCarrier(code: string): Promise<LabwareCarrier> {
    return this.get<LabwareCarrier>(`${this.baseUrl}/carriers/${code}`)
  }

  /**
   * Get all available plates
   */
  async getPlates(): Promise<LabwarePlate[]> {
    return this.get<LabwarePlate[]>(`${this.baseUrl}/plates`)
  }

  /**
   * Get plate by code
   */
  async getPlate(code: string): Promise<LabwarePlate> {
    return this.get<LabwarePlate>(`${this.baseUrl}/plates/${code}`)
  }

  /**
   * Get all available tips
   */
  async getTips(): Promise<LabwareTip[]> {
    return this.get<LabwareTip[]>(`${this.baseUrl}/tips`)
  }

  /**
   * Get tip by code
   */
  async getTip(code: string): Promise<LabwareTip> {
    return this.get<LabwareTip>(`${this.baseUrl}/tips/${code}`)
  }

  /**
   * Get all labware
   */
  async getAllLabware(): Promise<Labware[]> {
    return this.get<Labware[]>(`${this.baseUrl}/all`)
  }

  /**
   * Validate deck configuration
   */
  async validateDeckConfig(config: DeckConfiguration): Promise<ValidateDeckConfigResponse> {
    return this.post<ValidateDeckConfigResponse>(`${this.baseUrl}/validate`, config)
  }

  /**
   * Get deck layout visualization
   */
  async getDeckLayout(): Promise<GetDeckLayoutResponse> {
    return this.get<GetDeckLayoutResponse>(`${this.baseUrl}/deck-layout`)
  }

  /**
   * Get compatible labware for a carrier
   */
  async getCompatibleLabware(carrierCode: string): Promise<Labware[]> {
    return this.get<Labware[]>(`${this.baseUrl}/carriers/${carrierCode}/compatible`)
  }
}

// Export singleton instance
export const labwareService = new LabwareService()

// ─── Labware Item Service (public CRUD — no auth required) ────────────────────
import { BaseRepository } from '../repository'

export interface LabwareItem {
  id: number
  name: string
  type: string
  subtype: string | null
  description: string
  wells: number | null
  volume: number | null
  height: number | null
  color: string
  icon: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export class LabwareItemService extends BaseRepository {
  private readonly baseUrl = '/api/labware'

  async getAll(): Promise<LabwareItem[]> {
    const result = await this.get<{ data: LabwareItem[] } | LabwareItem[]>(this.baseUrl)
    return Array.isArray(result) ? result : (result as any).data || []
  }

  async create(data: Partial<LabwareItem>): Promise<LabwareItem> {
    return this.post<LabwareItem>(this.baseUrl, data)
  }

  async update(id: number, data: Partial<LabwareItem>): Promise<LabwareItem> {
    return this.put<LabwareItem>(`${this.baseUrl}/${id}`, data)
  }

  async remove(id: number): Promise<void> {
    return this.delete<void>(`${this.baseUrl}/${id}`)
  }

  async seed(): Promise<void> {
    return this.post<void>(`${this.baseUrl}/seed`, {})
  }
}

export const labwareItemService = new LabwareItemService()