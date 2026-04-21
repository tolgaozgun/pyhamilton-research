import { FlaskConical, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ProcedureDraftInputProps {
  value: string
}

export function ProcedureDraftInput({ value }: ProcedureDraftInputProps) {
  const hasContent = value.trim().length > 0
  const lines = value.split('\n').filter(Boolean).length

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 bg-gray-50/50">
        <div
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
            hasContent ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400'
          )}
        >
          <FlaskConical className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-semibold text-gray-900">
            Procedure Draft
          </label>
          <p className="text-xs text-gray-500 mt-0.5">
            Generated from your conversation with the AI assistant
          </p>
        </div>
        {hasContent && (
          <span className="text-xs text-gray-400 font-mono">{lines} step{lines !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {hasContent ? (
          <div className={cn(
            'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg',
            'text-sm leading-relaxed text-gray-800 font-mono whitespace-pre-wrap',
            'min-h-[120px] max-h-64 overflow-y-auto'
          )}>
            {value}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
            <MessageSquare className="w-8 h-8 text-gray-300" />
            <div>
              <p className="text-sm font-medium text-gray-500">No procedure defined yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Chat with the AI above until it indicates it's ready — your procedure will appear here automatically.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
