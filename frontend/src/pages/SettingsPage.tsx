import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings as SettingsIcon,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  RefreshCw,
  Sparkles,
  Globe,
  Lock,
  Unlock,
  ChevronDown,
  Info
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { axiosInstance } from '@/lib/axios'
import { aiService, type AIProvider, type AIModel, ANTHROPIC_MODELS, OPENAI_MODELS, GOOGLE_MODELS } from '@/lib/ai/service'
import { useSettingsManager, type AllSettings, type ProviderSettings } from '@/lib/hooks/useSettingsManager'

const PROVIDER_INFO: Record<
  AIProvider,
  { name: string; icon: any; description: string; defaultModels: AIModel[] }
> = {
  anthropic: {
    name: 'Anthropic Claude',
    icon: Sparkles,
    description: 'Advanced reasoning and vision',
    defaultModels: ANTHROPIC_MODELS,
  },
  openai: {
    name: 'OpenAI',
    icon: Globe,
    description: 'GPT-4 and more',
    defaultModels: OPENAI_MODELS,
  },
  google: {
    name: 'Google Gemini',
    icon: RefreshCw,
    description: 'Gemini 2.0 and 1.5 Pro',
    defaultModels: GOOGLE_MODELS,
  },
}

const MODEL_LIMITS: Record<string, { maxTokens: number; context: number }> = {
  'claude-sonnet-4-20250514': { maxTokens: 8192, context: 200000 },
  'claude-3-5-sonnet-20241022': { maxTokens: 8192, context: 200000 },
  'claude-3-haiku-20240307': { maxTokens: 4096, context: 200000 },
  'gpt-4o': { maxTokens: 4096, context: 128000 },
  'gpt-4o-mini': { maxTokens: 16384, context: 128000 },
  'gemini-2.0-flash': { maxTokens: 8192, context: 1000000 },
  'gemini-1.5-flash': { maxTokens: 8192, context: 1000000 },
  'gemini-1.5-pro': { maxTokens: 8192, context: 2000000 },
}

const DEFAULT_SETTINGS: AllSettings = {
  anthropic: {
    api_key: null,
    selected_model: null,
    models_list: null,
    models_fetched_at: null,
    preferences: { temperature: 0.7, max_tokens: 4096 },
  },
  openai: {
    api_key: null,
    selected_model: null,
    models_list: null,
    models_fetched_at: null,
    preferences: { temperature: 0.7, max_tokens: 4096 },
  },
  google: {
    api_key: null,
    selected_model: null,
    models_list: null,
    models_fetched_at: null,
    preferences: { temperature: 0.7, max_tokens: 4096 },
  },
}

function ProviderCard({ provider, settings, onUpdate, isRefreshing, onRefresh }: {
  provider: AIProvider
  settings: ProviderSettings
  onUpdate: (provider: AIProvider, updates: Partial<ProviderSettings>) => void
  isRefreshing: boolean
  onRefresh: (provider: AIProvider) => Promise<void>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editKey, setEditKey] = useState('')
  const [expanded, setExpanded] = useState(false)

  const info = PROVIDER_INFO[provider]
  const isConfigured = !!settings.api_key
  const models = isConfigured && !settings.models_list ? info.defaultModels : (settings.models_list || [])
  const selectedModel = settings.selected_model

  const handleSaveKey = () => {
    if (editKey.trim()) {
      onUpdate(provider, { api_key: editKey.trim() })
      setIsEditing(false)
      setEditKey('')
      toast.success(`${info.name} API key saved`)
    }
  }

  const handleRemoveKey = () => {
    onUpdate(provider, { api_key: null })
    toast.success(`${info.name} API key removed`)
  }

  const handleSelectModel = (modelId: string) => {
    onUpdate(provider, { selected_model: modelId })
    toast.success(`Selected ${modelId}`)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-gray-200 bg-white p-5 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gray-100">
            <info.icon className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{info.name}</h3>
              {isConfigured && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  Configured
                </span>
              )}
            </div>
            <p className="text-sm mt-0.5 text-gray-500">{info.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onRefresh(provider)}
            disabled={isRefreshing || !isConfigured}
            className="p-2 rounded-lg transition-all hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh models"
          >
            <RefreshCw className={cn('w-4 h-4 text-gray-400', isRefreshing && 'animate-spin')} />
          </button>

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-lg transition-all hover:bg-gray-100"
          >
            <ChevronDown
              className={cn('w-4 h-4 text-gray-400 transition-transform', expanded && 'rotate-180')}
            />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-4 space-y-4"
          >
            {/* API Key Section */}
            {isEditing ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">API Key</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={editKey}
                    onChange={(e) => setEditKey(e.target.value)}
                    placeholder={`Enter ${info.name} API key`}
                    className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-gray-400/50"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    disabled={!editKey.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-3">
                  {isConfigured ? (
                    <>
                      <Lock className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500">
                        ••••••••{settings.api_key?.slice(-4)}
                      </span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-400">No API key configured</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isConfigured && (
                    <button
                      type="button"
                      onClick={handleRemoveKey}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                      isConfigured
                        ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        : 'bg-gray-900 hover:bg-gray-800 text-white'
                    )}
                  >
                    {isConfigured ? 'Update' : 'Add'} Key
                  </button>
                </div>
              </div>
            )}

            {/* Models Section */}
            {isConfigured && models.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Selected Model
                  </label>
                  {settings.models_fetched_at && (
                    <span className="text-xs text-gray-400">
                      Updated {new Date(settings.models_fetched_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {models.map((model) => {
                    const isSelected = selectedModel === model.id
                    const limits = MODEL_LIMITS[model.id]

                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => handleSelectModel(model.id)}
                        className={cn(
                          'p-3 rounded-lg border text-left transition-all',
                          'hover:scale-[1.01] hover:shadow-sm',
                          isSelected
                            ? 'bg-gray-100 border-gray-300'
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'text-sm font-medium truncate',
                                isSelected ? 'text-gray-900' : 'text-gray-700'
                              )}>
                                {model.name}
                              </span>
                              {isSelected && (
                                <Sparkles className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                              )}
                            </div>
                            {limits && (
                              <div className="flex flex-wrap gap-2 mt-1.5">
                                <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                                  {limits.context / 1000}k context
                                </span>
                                <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                                  Max {limits.maxTokens} output
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Preferences */}
            {isConfigured && (
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700">Generation Preferences</h4>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-gray-600">Temperature</label>
                    <span className="text-sm text-gray-700">{settings.preferences?.temperature?.toFixed(1) || 0.7}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.preferences?.temperature || 0.7}
                    onChange={(e) => onUpdate(provider, {
                      preferences: { ...settings.preferences, temperature: parseFloat(e.target.value) }
                    })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-700"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Precise</span>
                    <span>Balanced</span>
                    <span>Creative</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">Max Output Tokens</label>
                  <select
                    value={settings.preferences?.max_tokens || 4096}
                    onChange={(e) => onUpdate(provider, {
                      preferences: { ...settings.preferences, max_tokens: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400/50"
                  >
                    <option value={1024}>1,024 tokens</option>
                    <option value={2048}>2,048 tokens</option>
                    <option value={4096}>4,096 tokens</option>
                    <option value={8192}>8,192 tokens</option>
                    <option value={16384}>16,384 tokens</option>
                  </select>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function SettingsPage() {
  const { settings, isLoading, fetchSettings, updateProviderSettings, saveProviderModels } = useSettingsManager()
  const [refreshingProvider, setRefreshingProvider] = useState<AIProvider | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')

  const updateSettings = useCallback(async (provider: AIProvider, updates: Partial<ProviderSettings>) => {
    try {
      await updateProviderSettings(provider, updates)
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save settings')
    }
  }, [updateProviderSettings])

  const refreshModels = useCallback(async (provider: AIProvider) => {
    const providerSettings = settings[provider]
    if (!providerSettings.api_key) {
      toast.error('Please configure an API key first')
      return
    }

    setRefreshingProvider(provider)

    try {
      const models = await aiService.fetchModels(provider)
      await saveProviderModels(provider, models)
      toast.success(`Updated ${provider} models`)
    } catch (error) {
      console.error('Failed to refresh models:', error)
      toast.error('Failed to fetch models. Please check your API key.')
    } finally {
      setRefreshingProvider(null)
    }
  }, [settings, saveProviderModels])

  const testConnection = useCallback(async () => {
    setConnectionStatus('idle')
    setStatusMessage('')

    try {
      await axiosInstance.get('/api/health')
      setConnectionStatus('ok')
      setStatusMessage('Connected successfully')
    } catch (error) {
      setConnectionStatus('error')
      setStatusMessage('Connection failed')
    }
  }, [])

  useEffect(() => {
    const autoFetchModels = async () => {
      for (const provider of ['anthropic', 'openai', 'google'] as AIProvider[]) {
        const providerSettings = settings[provider]
        if (providerSettings.api_key && !providerSettings.models_list) {
          try {
            const models = await aiService.fetchModels(provider)
            await saveProviderModels(provider, models)
          } catch (error) {
            console.error(`Failed to auto-fetch models for ${provider}:`, error)
          }
        }
      }
    }

    if (!isLoading) {
      autoFetchModels()
    }
  }, [isLoading])

  const configuredCount = Object.values(settings).filter(s => s.api_key).length
  const totalModels = Object.values(settings).reduce((sum, s) => {
    const provider = Object.keys(settings).find(key => settings[key as AIProvider] === s) as AIProvider
    if (s.api_key && !s.models_list && provider) {
      return sum + PROVIDER_INFO[provider].defaultModels.length
    }
    return sum + (s.models_list?.length || 0)
  }, 0)

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gray-100 rounded-xl">
            <SettingsIcon className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Configure AI providers and preferences
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={testConnection}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all flex items-center gap-2"
        >
          <Globe className="w-4 h-4" />
          Test Connection
        </button>
      </div>

      {/* Status Banner */}
      {connectionStatus !== 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50"
        >
          {connectionStatus === 'ok' ? (
            <CheckCircle2 className="w-5 h-5 text-gray-600 shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-gray-500 shrink-0" />
          )}
          <span className="text-sm text-gray-700">
            {statusMessage}
          </span>
        </motion.div>
      )}

      {/* Summary */}
      <div className={cn(
        'rounded-xl p-4 border text-sm',
        configuredCount > 0
          ? 'bg-gray-50 border-gray-200 text-gray-700'
          : 'bg-gray-50 border-gray-200 text-gray-500'
      )}>
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-gray-400" />
          {configuredCount > 0
            ? `${configuredCount} provider${configuredCount !== 1 ? 's' : ''} configured • ${totalModels} models available`
            : 'Configure at least one AI provider to get started'
          }
        </div>
      </div>

      {/* Provider Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {(['anthropic', 'openai', 'google'] as AIProvider[]).map((provider) => (
            <ProviderCard
              key={provider}
              provider={provider}
              settings={settings[provider]}
              onUpdate={updateSettings}
              isRefreshing={refreshingProvider === provider}
              onRefresh={refreshModels}
            />
          ))}
        </div>
      )}

      {/* Help Text */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
          <div className="text-sm text-gray-500 space-y-1">
            <p>API keys are stored securely in the database and encrypted at rest.</p>
            <p>Models are fetched directly from each provider's API to ensure you have access to the latest available models.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
