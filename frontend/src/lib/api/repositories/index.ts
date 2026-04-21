import { BaseRepository, AuthenticatedRepository } from '../repository'
import type {
  LLMConfig,
  UserInput,
  PipelineState,
  ProviderInfo,
  LabwareInfo,
  AggregateMetrics,
  SimulationResult,
  AgenticChatMessage,
  AgenticChatResponse,
  AgenticGenerationResponse,
  AgenticVerificationResponse,
  AgenticValidateResponse,
  AgenticPhase,
  DeckConfig,
  RAGFile,
  VectorStore,
  VectorStoreFile,
  RAGSearchResult,
  UserDeckLayout,
  DeckLayoutValidationResult,
} from '@/types'

// ─── Deck Repository ─────────────────────────────────────────────────────────────

export class DeckRepository extends BaseRepository {
  async validate(deckConfig: DeckConfig) {
    return this.post<{ valid: boolean; errors: string[] }>('/api/deck/validate', deckConfig)
  }
}

// ─── Config Repository ───────────────────────────────────────────────────────────

export class ConfigRepository extends BaseRepository {
  async getProviders(): Promise<ProviderInfo> {
    return this.get<ProviderInfo>('/api/config/providers')
  }

  async getLabware(): Promise<{ labware: LabwareInfo[] }> {
    return this.get<{ labware: LabwareInfo[] }>('/api/config/labware')
  }

  async getMetrics(): Promise<AggregateMetrics> {
    return this.get<AggregateMetrics>('/api/metrics')
  }
}

// ─── Simple Mode Repository ───────────────────────────────────────────────────────

export class SimpleRepository extends BaseRepository {
  async generate(userInput: UserInput, llmConfig: LLMConfig): Promise<{ script: string }> {
    return this.post<{ script: string }>('/api/simple/generate', {
      user_input: userInput,
      llm_config: llmConfig,
    })
  }

}

// ─── Developer Mode Repository ───────────────────────────────────────────────────

export class DeveloperRepository extends BaseRepository {
  async run(userInput: UserInput, llmConfig: LLMConfig): Promise<PipelineState> {
    return this.post<PipelineState>('/api/developer/run', {
      user_input: userInput,
      llm_config: llmConfig,
    })
  }
}

// ─── Agentic Mode Repository ─────────────────────────────────────────────────────

export class AgenticRepository extends BaseRepository {
  async validatePhase(payload: {
    phase: AgenticPhase
    goal: string
    llmConfig: LLMConfig
    deckConfig?: Record<string, unknown>
    procedureContext?: string
  }): Promise<AgenticValidateResponse> {
    return this.post<AgenticValidateResponse>('/api/agentic/validate', {
      phase: payload.phase,
      goal: payload.goal,
      llm_config: payload.llmConfig,
      deck_config: payload.deckConfig,
      procedure_context: payload.procedureContext,
    })
  }

  async chat(payload: {
    phase: AgenticPhase
    goal: string
    conversation: AgenticChatMessage[]
    llmConfig: LLMConfig
    deckConfig?: Record<string, unknown>
    procedureContext?: string
  }): Promise<AgenticChatResponse> {
    return this.post<AgenticChatResponse>('/api/agentic/chat', {
      phase: payload.phase,
      goal: payload.goal,
      conversation: payload.conversation,
      llm_config: payload.llmConfig,
      deck_config: payload.deckConfig,
      procedure_context: payload.procedureContext,
    })
  }

  async generate(payload: {
    goal: string
    llmConfig: LLMConfig
    deckConfig?: Record<string, unknown>
    procedureContext?: string
  }): Promise<AgenticGenerationResponse> {
    return this.post<AgenticGenerationResponse>('/api/agentic/generate', {
      goal: payload.goal,
      llm_config: payload.llmConfig,
      deck_config: payload.deckConfig,
      procedure_context: payload.procedureContext,
    })
  }

  async verify(payload: { script: string; tests: string }): Promise<AgenticVerificationResponse> {
    return this.post<AgenticVerificationResponse>('/api/agentic/verify', payload)
  }

  async fix(payload: {
    goal: string
    llmConfig: LLMConfig
    script: string
    tests: string
    feedback: string
    deckConfig?: Record<string, unknown>
    procedureContext?: string
  }): Promise<AgenticGenerationResponse> {
    return this.post<AgenticGenerationResponse>('/api/agentic/fix', {
      goal: payload.goal,
      llm_config: payload.llmConfig,
      script: payload.script,
      tests: payload.tests,
      verification_feedback: payload.feedback,
      deck_config: payload.deckConfig,
      procedure_context: payload.procedureContext,
    })
  }

}

// ─── Simulation Repository ───────────────────────────────────────────────────────

export class SimulationRepository extends BaseRepository {
  async run(payload: { code: string; goal?: string; name?: string }) {
    return this.post<{
      id: string
      status: string
      success?: boolean
      result?: SimulationResult
      error?: string
    }>('/api/simulation/run', payload)
  }

  async listRuns() {
    return this.get<{
      runs: Array<{
        id: string
        name?: string
        goal?: string
        status: string
        created_at: string
        success?: boolean
        error?: string
      }>
    }>('/api/simulation/runs')
  }

  async getRun(runId: string) {
    return this.get<{
      id: string
      name?: string
      goal?: string
      status: string
      created_at: string
      success?: boolean
      error?: string
      result?: SimulationResult
      code_snippet?: string
    }>(`/api/simulation/runs/${runId}`)
  }
}

// ─── Health Repository ───────────────────────────────────────────────────────────

export class HealthRepository extends BaseRepository {
  async checkHealth(): Promise<{ status: string }> {
    return this.get<{ status: string }>('/api/health')
  }
}

// ─── Labware Repository ───────────────────────────────────────────────────────────

export interface CarrierTypeResponse {
  id: number
  name: string
  code: string
  category: string
  width_rails: number
  num_slots: number
  accepts: string[]
  description: string | null
  properties: Record<string, unknown> | null
  is_active: boolean
}

export interface LabwareTypeResponse {
  id: number
  name: string
  code: string
  category: string
  description: string | null
  properties: Record<string, unknown> | null
  is_active: boolean
}

export interface DeckPresetResponse {
  id: number
  name: string
  description: string | null
  category: string | null
  configuration: Record<string, unknown>
  is_active: boolean
  is_default: boolean
}

export class LabwareRepository extends BaseRepository {
  async getCarriers(category?: string, isActive = true): Promise<CarrierTypeResponse[]> {
    const params = new URLSearchParams()
    if (category) params.append('category', category)
    if (isActive !== undefined) params.append('is_active', String(isActive))
    const query = params.toString() ? `?${params.toString()}` : ''
    return this.get<CarrierTypeResponse[]>(`/api/labware/carriers${query}`)
  }

  async getCarrier(id: number): Promise<CarrierTypeResponse> {
    return this.get<CarrierTypeResponse>(`/api/labware/carriers/${id}`)
  }

  async getLabwareTypes(category?: string, isActive = true): Promise<LabwareTypeResponse[]> {
    const params = new URLSearchParams()
    if (category) params.append('category', category)
    if (isActive !== undefined) params.append('is_active', String(isActive))
    const query = params.toString() ? `?${params.toString()}` : ''
    return this.get<LabwareTypeResponse[]>(`/api/labware/labware-types${query}`)
  }

  async getLabwareType(id: number): Promise<LabwareTypeResponse> {
    return this.get<LabwareTypeResponse>(`/api/labware/labware-types/${id}`)
  }

  async getDeckPresets(category?: string, isActive = true): Promise<DeckPresetResponse[]> {
    const params = new URLSearchParams()
    if (category) params.append('category', category)
    if (isActive !== undefined) params.append('is_active', String(isActive))
    const query = params.toString() ? `?${params.toString()}` : ''
    return this.get<DeckPresetResponse[]>(`/api/labware/presets${query}`)
  }

  async getDeckPreset(id: number): Promise<DeckPresetResponse> {
    return this.get<DeckPresetResponse>(`/api/labware/presets/${id}`)
  }
}

// ─── RAG Repository ───────────────────────────────────────────────────────────

export class RAGRepository extends BaseRepository {
  // Files
  async listFiles(): Promise<{ files: RAGFile[] }> {
    return this.get<{ files: RAGFile[] }>('/api/rag/files')
  }

  async uploadFile(file: File): Promise<RAGFile> {
    const formData = new FormData()
    formData.append('file', file)
    return this.post<RAGFile>('/api/rag/files', formData)
  }

  async getFile(fileId: string): Promise<RAGFile> {
    return this.get<RAGFile>(`/api/rag/files/${fileId}`)
  }

  async deleteFile(fileId: string): Promise<{ deleted: boolean }> {
    return this.delete<{ deleted: boolean }>(`/api/rag/files/${fileId}`)
  }

  // Vector Stores
  async listVectorStores(): Promise<{ vector_stores: VectorStore[] }> {
    return this.get<{ vector_stores: VectorStore[] }>('/api/rag/vector-stores')
  }

  async createVectorStore(payload: {
    name: string
    fileIds?: string[]
    expiresAfterDays?: number
  }): Promise<VectorStore> {
    return this.post<VectorStore>('/api/rag/vector-stores', {
      name: payload.name,
      file_ids: payload.fileIds ?? [],
      expires_after_days: payload.expiresAfterDays,
    })
  }

  async getVectorStore(id: string): Promise<VectorStore> {
    return this.get<VectorStore>(`/api/rag/vector-stores/${id}`)
  }

  async deleteVectorStore(id: string): Promise<{ deleted: boolean }> {
    return this.delete<{ deleted: boolean }>(`/api/rag/vector-stores/${id}`)
  }

  async listVectorStoreFiles(vectorStoreId: string): Promise<{ files: VectorStoreFile[] }> {
    return this.get<{ files: VectorStoreFile[] }>(`/api/rag/vector-stores/${vectorStoreId}/files`)
  }

  async addFileToVectorStore(vectorStoreId: string, fileId: string): Promise<VectorStoreFile> {
    return this.post<VectorStoreFile>(`/api/rag/vector-stores/${vectorStoreId}/files`, {
      file_id: fileId,
    })
  }

  async removeFileFromVectorStore(
    vectorStoreId: string,
    fileId: string
  ): Promise<{ deleted: boolean }> {
    return this.delete<{ deleted: boolean }>(
      `/api/rag/vector-stores/${vectorStoreId}/files/${fileId}`
    )
  }

  async searchVectorStore(
    vectorStoreId: string,
    query: string,
    maxResults = 5
  ): Promise<{ results: RAGSearchResult[] }> {
    return this.post<{ results: RAGSearchResult[] }>(
      `/api/rag/vector-stores/${vectorStoreId}/search`,
      { query, max_results: maxResults }
    )
  }
}

// ─── Deck Layout Repository ───────────────────────────────────────────────────

export class DeckLayoutRepository extends AuthenticatedRepository {
  async list(): Promise<UserDeckLayout[]> {
    return this.get<UserDeckLayout[]>('/api/deck-layouts')
  }

  async getById(id: number): Promise<UserDeckLayout> {
    return this.get<UserDeckLayout>(`/api/deck-layouts/${id}`)
  }

  async create(payload: { name: string; description?: string; configuration: DeckConfig }): Promise<UserDeckLayout> {
    return this.post<UserDeckLayout>('/api/deck-layouts', payload)
  }

  async update(id: number, payload: Partial<{ name: string; description: string; configuration: DeckConfig }>): Promise<UserDeckLayout> {
    return this.put<UserDeckLayout>(`/api/deck-layouts/${id}`, payload)
  }

  async remove(id: number): Promise<void> {
    await this.delete(`/api/deck-layouts/${id}`)
  }

  async importJson(name: string, file: File, description?: string): Promise<UserDeckLayout> {
    const formData = new FormData()
    formData.append('file', file)
    const params = new URLSearchParams({ name })
    if (description) params.append('description', description)
    return this.post<UserDeckLayout>(`/api/deck-layouts/import/json?${params.toString()}`, formData)
  }

  async validate(id: number): Promise<DeckLayoutValidationResult> {
    return this.post<DeckLayoutValidationResult>(`/api/deck-layouts/${id}/validate`, {})
  }
}

// ─── API Facade ───────────────────────────────────────────────────────────────────

export class ApiRepository {
  readonly deck = new DeckRepository()
  readonly config = new ConfigRepository()
  readonly simple = new SimpleRepository()
  readonly developer = new DeveloperRepository()
  readonly agentic = new AgenticRepository()
  readonly simulation = new SimulationRepository()
  readonly health = new HealthRepository()
  readonly labware = new LabwareRepository()
  readonly rag = new RAGRepository()
  readonly deckLayouts = new DeckLayoutRepository()
}

// Singleton instance
export const apiRepository = new ApiRepository()
