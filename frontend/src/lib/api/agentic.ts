/**
 * Agentic API repository using the enhanced error handling system.
 */
import { AuthenticatedRepository } from './repository'
import type {
  AgenticPhase,
  AgenticChatMessage,
  AgenticChatResponse,
  AgenticGenerationResponse,
  AgenticVerificationResponse,
  AgenticValidateResponse,
  LLMConfig,
  DeckConfig,
} from '@/types'

export class AgenticApi extends AuthenticatedRepository {
  /**
   * Validate a phase in the agentic workflow.
   */
  async validatePhase(payload: {
    phase: AgenticPhase
    goal: string
    llmConfig: LLMConfig
    deckConfig?: DeckConfig
    procedureContext?: string
    vectorStoreId?: string
  }): Promise<AgenticValidateResponse> {
    return this.post<AgenticValidateResponse>('/api/agentic/validate', {
      phase: payload.phase,
      goal: payload.goal,
      llm_config: payload.llmConfig,
      deck_config: payload.deckConfig,
      procedure_context: payload.procedureContext,
      vector_store_id: payload.vectorStoreId,
    })
  }

  /**
   * Chat with the AI assistant for a specific phase.
   */
  async chat(payload: {
    phase: AgenticPhase
    goal: string
    conversation: AgenticChatMessage[]
    llmConfig: LLMConfig
    deckConfig?: DeckConfig
    procedureContext?: string
    vectorStoreId?: string
  }): Promise<AgenticChatResponse> {
    return this.post<AgenticChatResponse>('/api/agentic/chat', {
      phase: payload.phase,
      goal: payload.goal,
      conversation: payload.conversation,
      llm_config: payload.llmConfig,
      deck_config: payload.deckConfig,
      procedure_context: payload.procedureContext,
      vector_store_id: payload.vectorStoreId,
    })
  }

  /**
   * Generate automation script.
   */
  async generate(payload: {
    goal: string
    llmConfig: LLMConfig
    deckConfig?: DeckConfig
    procedureContext?: string
    vectorStoreId?: string
  }): Promise<AgenticGenerationResponse> {
    return this.post<AgenticGenerationResponse>('/api/agentic/generate', {
      goal: payload.goal,
      llm_config: payload.llmConfig,
      deck_config: payload.deckConfig,
      procedure_context: payload.procedureContext,
      vector_store_id: payload.vectorStoreId,
    })
  }

  /**
   * Verify generated script.
   */
  async verify(payload: {
    script: string
    tests: string
  }): Promise<AgenticVerificationResponse> {
    return this.post<AgenticVerificationResponse>('/api/agentic/verify', payload)
  }

  /**
   * Fix script based on verification feedback.
   */
  async fix(payload: {
    goal: string
    llmConfig: LLMConfig
    script: string
    tests: string
    verificationFeedback: string
    deckConfig?: DeckConfig
    procedureContext?: string
    vectorStoreId?: string
  }): Promise<AgenticGenerationResponse> {
    return this.post<AgenticGenerationResponse>('/api/agentic/fix', {
      goal: payload.goal,
      llm_config: payload.llmConfig,
      script: payload.script,
      tests: payload.tests,
      verification_feedback: payload.verificationFeedback,
      deck_config: payload.deckConfig,
      procedure_context: payload.procedureContext,
      vector_store_id: payload.vectorStoreId,
    })
  }
}
