import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────────────────

export type AIProvider = 'anthropic' | 'openai' | 'google'

export interface AIModel {
  id: string
  name: string
  provider: AIProvider
  context: number
  maxTokens: number
  supportsStreaming: boolean
  supportsVision: boolean
  inputCost?: number // per million tokens
  outputCost?: number // per million tokens
}

export interface AIProviderConfig {
  apiKey: string
  baseURL?: string // for OpenAI-compatible endpoints
  timeout?: number
}

export interface AICompletionOptions {
  model: string
  maxTokens?: number
  temperature?: number
  topP?: number
  stream?: boolean
  system?: string
}

export interface AICompletionRequest {
  prompt: string
  options: AICompletionOptions
  provider: AIProvider
  config: AIProviderConfig
}

export interface AIStreamChunk {
  content: string
  done: boolean
}

// ─── Model Catalogs ───────────────────────────────────────────────────────────────

export const ANTHROPIC_MODELS: AIModel[] = [
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    context: 200000,
    maxTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    inputCost: 3.0,
    outputCost: 15.0,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    context: 200000,
    maxTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    inputCost: 3.0,
    outputCost: 15.0,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    context: 200000,
    maxTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
    inputCost: 0.8,
    outputCost: 4.0,
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    context: 200000,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
    inputCost: 15.0,
    outputCost: 75.0,
  },
]

export const OPENAI_MODELS: AIModel[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    context: 128000,
    maxTokens: 16384,
    supportsStreaming: true,
    supportsVision: true,
    inputCost: 2.5,
    outputCost: 10.0,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    context: 128000,
    maxTokens: 16384,
    supportsStreaming: true,
    supportsVision: true,
    inputCost: 0.15,
    outputCost: 0.6,
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    context: 128000,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsVision: true,
    inputCost: 10.0,
    outputCost: 30.0,
  },
  {
    id: 'o1-mini',
    name: 'o1-mini',
    provider: 'openai',
    context: 128000,
    maxTokens: 65536,
    supportsStreaming: false,
    supportsVision: false,
    inputCost: 1.1,
    outputCost: 4.4,
  },
]

export const GOOGLE_MODELS: AIModel[] = [
  {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash (Experimental)',
    provider: 'google',
    context: 1000000,
    maxTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    context: 2800000,
    maxTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    context: 2800000,
    maxTokens: 8192,
    supportsStreaming: true,
    supportsVision: true,
  },
]

export const ALL_MODELS: AIModel[] = [
  ...ANTHROPIC_MODELS,
  ...OPENAI_MODELS,
  ...GOOGLE_MODELS,
]

// ─── AI Service Class ─────────────────────────────────────────────────────────────

export class AIService {
  // ─── Model Fetching ───────────────────────────────────────────────────────────

  /**
   * Fetch available models from a provider
   * In production, this would call the provider's API to get the current list
   */
  async fetchModels(provider: AIProvider): Promise<AIModel[]> {
    try {
      switch (provider) {
        case 'anthropic':
          return await this.fetchAnthropicModels()
        case 'openai':
          return await this.fetchOpenAIModels()
        case 'google':
          return await this.fetchGoogleModels()
        default:
          return []
      }
    } catch (error) {
      console.error(`Failed to fetch models for ${provider}:`, error)
      toast.error(`Failed to fetch ${provider} models`)
      return this.getDefaultModels(provider)
    }
  }

  private async fetchAnthropicModels(): Promise<AIModel[]> {
    // For now, return our catalog. In production, we'd call their API
    return ANTHROPIC_MODELS
  }

  private async fetchOpenAIModels(): Promise<AIModel[]> {
    return OPENAI_MODELS
  }

  private async fetchGoogleModels(): Promise<AIModel[]> {
    // Google doesn't have a public models API, return our catalog
    return GOOGLE_MODELS
  }

  private getDefaultModels(provider: AIProvider): AIModel[] {
    switch (provider) {
      case 'anthropic':
        return ANTHROPIC_MODELS
      case 'openai':
        return OPENAI_MODELS
      case 'google':
        return GOOGLE_MODELS
    }
  }

  // ─── Completions ────────────────────────────────────────────────────────────────

  /**
   * Generate a completion (non-streaming)
   */
  async complete(request: AICompletionRequest): Promise<string> {
    const { provider, config, prompt, options } = request

    switch (provider) {
      case 'anthropic':
        return this.completeAnthropic(config, prompt, options)
      case 'openai':
        return this.completeOpenAI(config, prompt, options)
      case 'google':
        return this.completeGoogle(config, prompt, options)
      default:
        throw new Error(`Unknown provider: ${provider}`)
    }
  }

  /**
   * Generate a streaming completion
   */
  async *stream(request: AICompletionRequest): AsyncGenerator<AIStreamChunk> {
    const { provider, config, prompt, options } = request

    switch (provider) {
      case 'anthropic':
        yield* this.streamAnthropic(config, prompt, options)
        break
      case 'openai':
        yield* this.streamOpenAI(config, prompt, options)
        break
      case 'google':
        yield* this.streamGoogle(config, prompt, options)
        break
      default:
        throw new Error(`Unknown provider: ${provider}`)
    }
  }

  // ─── Anthropic ────────────────────────────────────────────────────────────────────

  private async completeAnthropic(
    config: AIProviderConfig,
    prompt: string,
    options: AICompletionOptions
  ): Promise<string> {
    const client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout || 60000,
    })

    try {
      const response = await client.messages.create({
        model: options.model as Anthropic.Model,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature,
        top_p: options.topP,
        system: options.system,
        messages: [{ role: 'user', content: prompt }],
      })

      // Extract text from response
      return response.content
        .filter(block => block.type === 'text')
        .map(block => (block as { text: string }).text)
        .join('\n')
    } catch (error) {
      throw this.handleError(error, 'Anthropic')
    }
  }

  private async *streamAnthropic(
    config: AIProviderConfig,
    prompt: string,
    options: AICompletionOptions
  ): AsyncGenerator<AIStreamChunk> {
    const client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout || 60000,
    })

    try {
      const stream = await client.messages.create({
        model: options.model as Anthropic.Model,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature,
        top_p: options.topP,
        system: options.system,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      })

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield {
            content: event.delta.text,
            done: false,
          }
        }
      }

      yield { content: '', done: true }
    } catch (error) {
      throw this.handleError(error, 'Anthropic')
    }
  }

  // ─── OpenAI ────────────────────────────────────────────────────────────────────────

  private async completeOpenAI(
    config: AIProviderConfig,
    prompt: string,
    options: AICompletionOptions
  ): Promise<string> {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout || 60000,
    })

    try {
      const response = await client.chat.completions.create({
        model: options.model,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature,
        top_p: options.topP,
        messages: [
          ...(options.system ? [{ role: 'system' as const, content: options.system }] : []),
          { role: 'user' as const, content: prompt },
        ],
      })

      return response.choices[0]?.message?.content || ''
    } catch (error) {
      throw this.handleError(error, 'OpenAI')
    }
  }

  private async *streamOpenAI(
    config: AIProviderConfig,
    prompt: string,
    options: AICompletionOptions
  ): AsyncGenerator<AIStreamChunk> {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout || 60000,
    })

    try {
      const stream = await client.chat.completions.create({
        model: options.model,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature,
        top_p: options.topP,
        stream: true,
        messages: [
          ...(options.system ? [{ role: 'system' as const, content: options.system }] : []),
          { role: 'user' as const, content: prompt },
        ],
      })

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) {
          yield {
            content,
            done: false,
          }
        }
      }

      yield { content: '', done: true }
    } catch (error) {
      throw this.handleError(error, 'OpenAI')
    }
  }

  // ─── Google ────────────────────────────────────────────────────────────────────────

  private async completeGoogle(
    config: AIProviderConfig,
    prompt: string,
    options: AICompletionOptions
  ): Promise<string> {
    const genAI = new GoogleGenerativeAI(config.apiKey)
    const model = genAI.getGenerativeModel({
      model: options.model,
      generationConfig: {
        maxOutputTokens: options.maxTokens || 8192,
        temperature: options.temperature,
        topP: options.topP,
      },
    })

    try {
      const result = await model.generateContent(prompt)
      return result.response.text()
    } catch (error) {
      throw this.handleError(error, 'Google')
    }
  }

  private async *streamGoogle(
    config: AIProviderConfig,
    prompt: string,
    options: AICompletionOptions
  ): AsyncGenerator<AIStreamChunk> {
    const genAI = new GoogleGenerativeAI(config.apiKey)
    const model = genAI.getGenerativeModel({
      model: options.model,
      generationConfig: {
        maxOutputTokens: options.maxTokens || 8192,
        temperature: options.temperature,
        topP: options.topP,
      },
    })

    try {
      const result = await model.generateContentStream(prompt)

      for await (const chunk of result.stream) {
        const text = chunk.text()
        if (text) {
          yield {
            content: text,
            done: false,
          }
        }
      }

      yield { content: '', done: true }
    } catch (error) {
      throw this.handleError(error, 'Google')
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────────

  private handleError(error: unknown, provider: string): Error {
    if (error instanceof Error) {
      // Handle specific error types
      if ('status' in error) {
        const status = (error as { status?: number }).status

        switch (status) {
          case 401:
            return new Error(`Invalid API key for ${provider}`)
          case 429:
            return new Error(`Rate limit exceeded for ${provider}`)
          case 500:
            return new Error(`${provider} server error. Please try again.`)
          default:
            return error
        }
      }

      return error
    }

    return new Error(`Unknown error from ${provider}`)
  }

}

// ─── Singleton Instance ───────────────────────────────────────────────────────────

export const aiService = new AIService()
