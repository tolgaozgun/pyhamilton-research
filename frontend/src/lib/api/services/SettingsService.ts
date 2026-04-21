/**
 * Settings Service
 * Handles all settings-related API calls
 */

import { AuthenticatedRepository } from '../repository'
import type {
  GetSettingsResponse,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
  RefreshModelsRequest,
  RefreshModelsResponse,
  ActiveProviderResponse
} from '../types/settings.types'

export class SettingsService extends AuthenticatedRepository {
  private readonly baseUrl = '/api/settings'

  /**
   * Get all user settings
   */
  async getSettings(): Promise<GetSettingsResponse> {
    return this.get<GetSettingsResponse>(this.baseUrl)
  }

  /**
   * Get settings for specific provider
   */
  async getProviderSettings(provider: string): Promise<Partial<GetSettingsResponse>> {
    return this.get<Partial<GetSettingsResponse>>(`${this.baseUrl}/${provider}`)
  }

  /**
   * Update user settings for a provider
   */
  async updateSettings(request: UpdateSettingsRequest): Promise<UpdateSettingsResponse> {
    return this.put<UpdateSettingsResponse>(
      `${this.baseUrl}/${request.provider}`,
      {
        api_key: request.api_key,
        selected_model: request.selected_model,
        preferences: request.preferences
      }
    )
  }

  /**
   * Refresh available models for a provider
   */
  async refreshModels(request: RefreshModelsRequest): Promise<RefreshModelsResponse> {
    return this.post<RefreshModelsResponse>(
      `${this.baseUrl}/${request.provider}/refresh-models`,
      {}
    )
  }

  /**
   * Get active provider information
   */
  async getActiveProvider(): Promise<ActiveProviderResponse> {
    return this.get<ActiveProviderResponse>(`${this.baseUrl}/active/provider`)
  }

  /**
   * Get all providers settings as a raw map (provider → settings)
   */
  async getAllProvidersSettings(): Promise<Record<string, any>> {
    return this.get<Record<string, any>>(this.baseUrl)
  }

  /**
   * Set active provider
   */
  async setActiveProvider(provider: string): Promise<{ success: boolean }> {
    return this.post<{ success: boolean }>(`${this.baseUrl}/active-provider`, { provider })
  }

  /**
   * Delete settings for a provider
   */
  async deleteProviderSettings(provider: string): Promise<void> {
    return this.delete<void>(`${this.baseUrl}/${provider}`)
  }

  /**
   * Validate API key for a provider
   */
  async validateApiKey(provider: string, apiKey: string): Promise<{ valid: boolean; message?: string }> {
    return this.post<{ valid: boolean; message?: string }>(
      `${this.baseUrl}/${provider}/validate`,
      { api_key: apiKey }
    )
  }

  /**
   * Save provider models list (POST /api/settings/{provider}/models)
   */
  async saveProviderModels(provider: string, models: any[]): Promise<void> {
    return this.post<void>(`${this.baseUrl}/${provider}/models`, { models })
  }
}

// Export singleton instance
export const settingsService = new SettingsService()