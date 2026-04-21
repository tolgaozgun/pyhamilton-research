/**
 * Agentic Hook
 * Wraps all agentic API calls with loading state management.
 * Pages must only call this hook — never import AgenticApi directly.
 */

import { useState, useCallback } from 'react'
import { AgenticApi } from '../api/agentic'
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

export interface UseAgenticReturn {
  chatLoading: boolean
  validateLoading: boolean
  generateLoading: boolean
  verifyLoading: boolean
  fixLoading: boolean
  chat: (payload: {
    phase: AgenticPhase
    goal: string
    conversation: AgenticChatMessage[]
    llmConfig: LLMConfig
    deckConfig?: DeckConfig
    procedureContext?: string
    vectorStoreId?: string
  }) => Promise<AgenticChatResponse>
  validatePhase: (payload: {
    phase: AgenticPhase
    goal: string
    llmConfig: LLMConfig
    deckConfig?: DeckConfig
    procedureContext?: string
    vectorStoreId?: string
  }) => Promise<AgenticValidateResponse>
  generate: (payload: {
    goal: string
    llmConfig: LLMConfig
    deckConfig?: DeckConfig
    procedureContext?: string
    vectorStoreId?: string
  }) => Promise<AgenticGenerationResponse>
  verify: (payload: {
    script: string
    tests: string
  }) => Promise<AgenticVerificationResponse>
  fix: (payload: {
    goal: string
    llmConfig: LLMConfig
    script: string
    tests: string
    verificationFeedback: string
    deckConfig?: DeckConfig
    procedureContext?: string
    vectorStoreId?: string
  }) => Promise<AgenticGenerationResponse>
}

const agenticApi = new AgenticApi()

export function useAgentic(): UseAgenticReturn {
  const [chatLoading, setChatLoading] = useState(false)
  const [validateLoading, setValidateLoading] = useState(false)
  const [generateLoading, setGenerateLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [fixLoading, setFixLoading] = useState(false)

  const chat = useCallback(async (payload: Parameters<UseAgenticReturn['chat']>[0]) => {
    setChatLoading(true)
    try {
      return await agenticApi.chat(payload)
    } finally {
      setChatLoading(false)
    }
  }, [])

  const validatePhase = useCallback(async (payload: Parameters<UseAgenticReturn['validatePhase']>[0]) => {
    setValidateLoading(true)
    try {
      return await agenticApi.validatePhase(payload)
    } finally {
      setValidateLoading(false)
    }
  }, [])

  const generate = useCallback(async (payload: Parameters<UseAgenticReturn['generate']>[0]) => {
    setGenerateLoading(true)
    try {
      return await agenticApi.generate(payload)
    } finally {
      setGenerateLoading(false)
    }
  }, [])

  const verify = useCallback(async (payload: Parameters<UseAgenticReturn['verify']>[0]) => {
    setVerifyLoading(true)
    try {
      return await agenticApi.verify(payload)
    } finally {
      setVerifyLoading(false)
    }
  }, [])

  const fix = useCallback(async (payload: Parameters<UseAgenticReturn['fix']>[0]) => {
    setFixLoading(true)
    try {
      return await agenticApi.fix(payload)
    } finally {
      setFixLoading(false)
    }
  }, [])

  return {
    chatLoading,
    validateLoading,
    generateLoading,
    verifyLoading,
    fixLoading,
    chat,
    validatePhase,
    generate,
    verify,
    fix,
  }
}
