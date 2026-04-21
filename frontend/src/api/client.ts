// Re-export repository and types for backward compatibility
export { apiRepository as api } from '@/lib/api/repositories'

// Re-export types
export type {
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
} from '@/types'
