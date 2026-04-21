/**
 * Labware types
 * Type definitions for labware-related API contracts
 */

// ============================================================================
// Labware Types
// ============================================================================

export interface LabwareCarrier {
  code: string
  name: string
  num_slots: number
  width_rails: number
  category: string
  accepts: string[]
}

export interface LabwarePlate {
  code: string
  name: string
  num_wells: number
  well_volume_ul: number
  height: number
  category: string
  well_shape: string
}

export interface LabwareTip {
  code: string
  name: string
  num_tips: number
  volume_ul: number
  category: string
  tip_type: string
}

export interface Labware {
  code: string
  name: string
  type: 'carrier' | 'plate' | 'tip'
  category: string
  specifications: Record<string, unknown>
}

// ============================================================================
// Deck Configuration Types
// ============================================================================

export interface DeckSlot {
  slot_id: number
  labware_code: string | null
  position: { x: number; y: number }
}

export interface DeckConfiguration {
  carriers: Array<{
    carrier_code: string
    position: number
    rails: number
    labware: Array<{
      slot: number
      labware_code: string
    }>
  }>
  tips: Array<{
    carrier_code: string
    slot: number
    tip_code: string
  }>
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface GetCarriersResponse {
  carriers: LabwareCarrier[]
}

export interface GetPlatesResponse {
  plates: LabwarePlate[]
}

export interface GetTipsResponse {
  tips: LabwareTip[]
}

export interface GetLabwareResponse {
  labware: Labware[]
}

export interface ValidateDeckConfigResponse {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface GetDeckLayoutResponse {
  slots: DeckSlot[]
  dimensions: { width: number; depth: number }
}