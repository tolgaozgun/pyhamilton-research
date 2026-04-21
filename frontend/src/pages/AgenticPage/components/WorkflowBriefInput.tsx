import { FileText, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WorkflowBriefInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function WorkflowBriefInput({
  value,
  onChange,
  placeholder = 'Describe the overall assay or automation goal...',
}: WorkflowBriefInputProps) {
  const charCount = value.length
  const hasContent = value.trim().length > 0

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
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-semibold text-gray-900">
            Workflow Brief
          </label>
          <p className="text-xs text-gray-500 mt-0.5">
            Describe what you want to automate in detail
          </p>
        </div>
        {hasContent && (
          <span className="text-xs text-gray-400 font-mono">{charCount} chars</span>
        )}
      </div>

      {/* Input area */}
      <div className="p-4">
        <div className="relative group">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={5}
            className={cn(
              'w-full px-4 py-3 bg-white border rounded-lg text-gray-900',
              'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/50',
              'resize-none text-sm leading-relaxed transition-all duration-200',
              'border-gray-300 group-hover:border-gray-400 focus:border-gray-500'
            )}
          />
        </div>

        {/* Helper text */}
        <div className="flex items-center gap-2 mt-3 px-2">
          <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <p className="text-xs text-gray-500">
            Include details like volumes, labware types, mixing steps, and any constraints
          </p>
        </div>
      </div>
    </div>
  )
}
