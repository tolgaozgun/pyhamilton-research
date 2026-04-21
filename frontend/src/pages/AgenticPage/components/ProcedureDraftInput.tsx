import { FlaskConical, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ProcedureDraftInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function ProcedureDraftInput({
  value,
  onChange,
  placeholder = 'Describe what the script should do, step by step...',
}: ProcedureDraftInputProps) {
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
            Define the step-by-step protocol for the automation
          </p>
        </div>
        {hasContent && (
          <span className="text-xs text-gray-400 font-mono">{lines} steps</span>
        )}
      </div>

      {/* Input area */}
      <div className="p-4">
        <div className="relative group">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={8}
            className={cn(
              'w-full px-4 py-3 bg-white border rounded-lg text-gray-900',
              'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/50',
              'resize-none text-sm leading-relaxed transition-all duration-200 font-mono',
              'border-gray-300 group-hover:border-gray-400 focus:border-gray-500'
            )}
          />
        </div>

        {/* Helper text */}
        <div className="flex items-center gap-2 mt-3 px-2">
          <Lightbulb className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <p className="text-xs text-gray-500">
            List each step clearly: aspirate, dispense, mix, incubate, etc.
          </p>
        </div>
      </div>
    </div>
  )
}
