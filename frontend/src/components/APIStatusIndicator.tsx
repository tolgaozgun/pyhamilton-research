import { NavLink } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAPIConfigured } from '@/hooks/useAPIConfigured'

const PROVIDER_NAMES: Record<string, string> = {
  anthropic: 'Claude',
  openai: 'GPT',
  google: 'Gemini',
}

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: 'text-gray-700',
  openai: 'text-gray-700',
  google: 'text-gray-700',
}

export function APIStatusIndicator() {
  const { isConfigured, configuredProvider, selectedModel, isLoading } = useAPIConfigured()

  if (isLoading) {
    return (
      <div className="px-3 py-2">
        <div className="h-8 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="px-3 py-2">
      {!isConfigured ? (
        /* Not configured - warning state */
        <NavLink
          to="/settings"
          className={() =>
            cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all',
              'bg-amber-50 border border-amber-200 text-amber-800',
              'hover:bg-amber-100'
            )
          }
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">Setup API key</span>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        </NavLink>
      ) : (
        /* Configured - show provider and model */
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
            'bg-gray-100 border border-gray-200',
            'hover:bg-gray-200 transition-all group cursor-pointer'
          )}
          onClick={() => window.location.href = '/settings'}
          title="Click to change settings"
        >
          <CheckCircle2 className={cn('w-4 h-4 shrink-0', PROVIDER_COLORS[configuredProvider || 'google'])} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={cn('font-medium text-gray-900', PROVIDER_COLORS[configuredProvider || 'google'])}>
                {configuredProvider ? PROVIDER_NAMES[configuredProvider] : 'AI'}
              </span>
              {selectedModel && (
                <span className="text-gray-500 truncate max-w-[100px]" title={selectedModel}>
                  • {selectedModel.split('-').slice(0, 2).join('-')}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500">API configured</div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400 group-hover:text-gray-600" />
        </div>
      )}
    </div>
  )
}
