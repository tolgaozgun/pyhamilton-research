/**
 * Settings types
 * Type definitions for settings-related API contracts
 */

// ============================================================================
// AI Provider Types
// ============================================================================

export type AIProvider = 'anthropic' | 'openai' | 'google' | 'custom'

export interface AIProviderConfig {
  api_key: string
  selected_model?: string
  models_list?: Record<string, string[]>
  models_fetched_at?: string
}

export interface UserSettings {
  id: number
  user_id: number
  provider: AIProvider
  api_key: string | null
  selected_model: string | null
  models_list: Record<string, string[]> | null
  models_fetched_at: string | null
  preferences: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface UserSettingsUpdate {
  api_key?: string
  selected_model?: string
  preferences?: Record<string, unknown>
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface GetSettingsResponse {
  provider: AIProvider
  model_name: string | null
  has_api_key: boolean
  selected_model: string | null
  models_list: Record<string, string[]> | null
  preferences: Record<string, unknown>
}

export interface UpdateSettingsRequest {
  provider: AIProvider
  api_key?: string
  selected_model?: string
  preferences?: Record<string, unknown>
}

export interface UpdateSettingsResponse {
  success: boolean
  message: string
}

export interface RefreshModelsRequest {
  provider: AIProvider
}

export interface RefreshModelsResponse {
  provider: AIProvider
  models_list: Record<string, string[]>
  models_fetched_at: string
}

export interface ActiveProviderResponse {
  provider: AIProvider
  model_name: string | null
  has_api_key: boolean
  preferences: Record<string, unknown>
}

// ============================================================================
// LLM Config Types
// ============================================================================

export interface LLMConfig {
  provider: AIProvider
  model: string
  api_key?: string
  temperature?: number
  max_tokens?: number
  top_p?: number
  top_k?: number
  timeout?: number
  max_retries?: number
}