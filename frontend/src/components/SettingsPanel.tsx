import { useAppStore } from '@/store'
import { PROVIDER_LABELS } from '@/types'
import type { Provider } from '@/types'

const PROVIDER_MODELS: Record<Provider, string[]> = {
  google: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
  openrouter: [],
}

const MAX_TOKENS_OPTIONS = [1024, 2048, 4096, 8192, 16384, 32768]

export function SettingsPanel() {
  const { llmConfig, setLLMConfig } = useAppStore()

  const handleProviderChange = (provider: Provider) => {
    const models = PROVIDER_MODELS[provider]
    setLLMConfig({
      provider,
      model_name: models.length > 0 ? models[0] : '',
    })
  }

  const isOpenRouter = llmConfig.provider === 'openrouter'

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-zinc-100 mb-2">Provider</label>
        <select
          value={llmConfig.provider}
          onChange={(e) => handleProviderChange(e.target.value as Provider)}
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-100 mb-2">Model</label>
        {isOpenRouter ? (
          <input
            type="text"
            value={llmConfig.model_name}
            onChange={(e) => setLLMConfig({ model_name: e.target.value })}
            placeholder="e.g., openai/gpt-4o"
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        ) : (
          <select
            value={llmConfig.model_name}
            onChange={(e) => setLLMConfig({ model_name: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {PROVIDER_MODELS[llmConfig.provider]?.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-100 mb-2">API Key</label>
        <input
          type="password"
          value={llmConfig.api_key}
          onChange={(e) => setLLMConfig({ api_key: e.target.value })}
          placeholder="Enter your API key"
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-100 mb-2">
          Temperature: {llmConfig.temperature.toFixed(1)}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={llmConfig.temperature}
          onChange={(e) => setLLMConfig({ temperature: parseFloat(e.target.value) })}
          className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-xs text-zinc-500 mt-1">
          <span>0.0</span>
          <span>1.0</span>
          <span>2.0</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-100 mb-2">Max Tokens</label>
        <select
          value={llmConfig.max_tokens}
          onChange={(e) => setLLMConfig({ max_tokens: parseInt(e.target.value, 10) })}
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {MAX_TOKENS_OPTIONS.map((tokens) => (
            <option key={tokens} value={tokens}>
              {tokens.toLocaleString()}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default SettingsPanel
