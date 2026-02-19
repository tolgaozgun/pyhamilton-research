import type { LLMConfig, UserInput, PipelineState, ProviderInfo, LabwareInfo, AggregateMetrics } from '@/types'

const BASE = ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const api = {
  config: {
    getProviders: () => request<ProviderInfo>('/api/config/providers'),
    getLabware: () => request<{ labware: LabwareInfo[] }>('/api/config/labware'),
    getMetrics: () => request<AggregateMetrics>('/api/metrics'),
  },

  simple: {
    generate: (userInput: UserInput, llmConfig: LLMConfig) =>
      request<{ script: string }>('/api/simple/generate', {
        method: 'POST',
        body: JSON.stringify({ user_input: userInput, llm_config: llmConfig }),
      }),

    stream: async function* (userInput: UserInput, llmConfig: LLMConfig) {
      const res = await fetch(`${BASE}/api/simple/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_input: userInput, llm_config: llmConfig }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `Stream request failed: ${res.status}`)
      }
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              yield JSON.parse(line.slice(6))
            } catch { /* skip malformed */ }
          }
        }
      }
    },
  },

  developer: {
    run: (userInput: UserInput, llmConfig: LLMConfig) =>
      request<PipelineState>('/api/developer/run', {
        method: 'POST',
        body: JSON.stringify({ user_input: userInput, llm_config: llmConfig }),
      }),

    stream: (params: { goal: string; provider_name: string; model_name: string; api_key: string; context?: string }) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string>
      )
      return new EventSource(`${BASE}/api/developer/stream?${qs}`)
    },
  },

  agentic: {
    run: (userInput: UserInput, llmConfig: LLMConfig) =>
      request<Record<string, unknown>>('/api/agentic/run', {
        method: 'POST',
        body: JSON.stringify({ user_input: userInput, llm_config: llmConfig }),
      }),

    stream: (params: {
      goal: string; provider_name: string; model_name: string; api_key: string;
      context?: string; max_retries?: string
    }) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string>
      )
      return new EventSource(`${BASE}/api/agentic/stream?${qs}`)
    },
  },

  health: () => request<{ status: string }>('/api/health'),
}
