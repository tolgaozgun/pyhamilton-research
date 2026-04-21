import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface VerificationCardProps {
  title: string
  passed: boolean
  output: string
  loading?: boolean
}

export function VerificationCard({ title, passed, output, loading = false }: VerificationCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-3 transition-all duration-200',
        passed
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : loading
            ? 'bg-zinc-900 border-zinc-800'
            : 'bg-red-500/5 border-red-500/20'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {title}
        </span>
        <div className="flex items-center gap-1.5">
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse" />
              <span className="text-xs text-zinc-500">Running...</span>
            </div>
          ) : (
            <>
              {passed ? (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400">Passed</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-medium text-red-400">Failed</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Output */}
      <div className="relative">
        <div
          className={cn(
            'rounded-lg p-3 text-[11px] font-mono leading-5 max-h-32 overflow-y-auto',
            passed
              ? 'bg-emerald-950/30 text-emerald-100/60'
              : loading
                ? 'bg-zinc-950 text-zinc-500'
                : 'bg-red-950/30 text-red-100/60'
          )}
        >
          <pre className="whitespace-pre-wrap">{output || 'No output.'}</pre>
        </div>
      </div>
    </div>
  )
}
