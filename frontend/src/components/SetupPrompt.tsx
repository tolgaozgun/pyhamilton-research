import { NavLink } from 'react-router-dom'
import { AlertTriangle, Settings, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SetupPromptProps {
  variant?: 'banner' | 'card'
  message?: string
}

export function SetupPrompt({ variant = 'banner', message }: SetupPromptProps) {
  const default_message = message || 'Configure an AI provider API key to continue'

  if (variant === 'card') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-orange-400" />
        </div>
        <h3 className="text-xl font-semibold text-zinc-100 mb-2">Setup Required</h3>
        <p className="text-sm text-zinc-400 text-center mb-6 max-w-md">
          {default_message}
        </p>
        <NavLink
          to="/settings"
          className={cn(
            'inline-flex items-center gap-2 px-6 py-3 rounded-xl',
            'bg-purple-600 hover:bg-purple-500 text-white',
            'text-sm font-medium transition-all',
            'shadow-lg shadow-purple-500/20'
          )}
        >
          <Settings className="w-4 h-4" />
          Go to Settings
          <ChevronRight className="w-4 h-4" />
        </NavLink>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl mb-6">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-orange-500/30 bg-orange-500/10">
        <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-orange-200 font-medium">Setup Required</p>
          <p className="text-xs text-orange-300/80 mt-0.5">{default_message}</p>
        </div>
        <NavLink
          to="/settings"
          className={cn(
            'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
            'bg-orange-500/20 hover:bg-orange-500/30 text-orange-200',
            'text-xs font-medium transition-all'
          )}
        >
          <Settings className="w-3.5 h-3.5" />
          Configure
          <ChevronRight className="w-3.5 h-3.5" />
        </NavLink>
      </div>
    </div>
  )
}
