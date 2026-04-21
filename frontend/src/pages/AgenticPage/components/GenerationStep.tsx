import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Loader2, Play, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgenticGenerationResponse, AgenticVerificationResponse } from '@/types'
import { VerificationCard } from './VerificationCard'

export interface GenerationStepProps {
  generateLoading: boolean
  retryLoading: boolean
  generation: AgenticGenerationResponse | null
  verification: AgenticVerificationResponse | null
  error: string | null
  onGenerate: () => void
  onRetry: () => void
  onFinishAsIs: () => void
}

export function GenerationStep({
  generateLoading,
  retryLoading,
  generation,
  verification,
  error,
  onGenerate,
  onRetry,
  onFinishAsIs,
}: GenerationStepProps) {
  const hasResults = generation && verification

  return (
    <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-2xl p-6 space-y-5 shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-zinc-100">AI Generation</h2>
          <p className="text-sm text-zinc-500">
            Generates the script and tests, then verifies with syntax check, interpreter, and pytest.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generateLoading || retryLoading}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium',
            'transition-all duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
            generateLoading || retryLoading
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
          )}
        >
          {generateLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Generate bundle
            </>
          )}
        </button>
      </div>

      {/* Error display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border border-red-500/30 bg-red-500/10 p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-300">Generation failed</p>
                <p className="text-xs text-red-200/70 mt-1">{error}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Verification results */}
      <AnimatePresence>
        {hasResults && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Verification cards grid */}
            <div className="grid gap-4 md:grid-cols-3">
              <VerificationCard
                title="Syntax"
                passed={verification.syntax.passed}
                output={verification.syntax.stderr || 'No syntax errors.'}
              />
              <VerificationCard
                title="Interpreter"
                passed={verification.interpreter.passed}
                output={
                  verification.interpreter.stdout ||
                  verification.interpreter.stderr ||
                  'No output.'
                }
              />
              <VerificationCard
                title="Pytest"
                passed={verification.pytest.passed}
                output={
                  verification.pytest.stdout ||
                  verification.pytest.stderr ||
                  'No test output.'
                }
              />
            </div>

            {/* Failed verification actions */}
            {!verification.passed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-5 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-300">Verification failed</p>
                    <p className="text-xs text-amber-200/60 mt-0.5">
                      The script has issues that need to be fixed before export.
                    </p>
                  </div>
                </div>

                {/* Feedback */}
                <div className="bg-amber-950/30 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <pre className="text-xs text-amber-100/70 whitespace-pre-wrap leading-5 font-mono">
                    {verification.feedback}
                  </pre>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onRetry}
                    disabled={retryLoading}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg px-4 py-2.5',
                      'bg-amber-500 text-zinc-950 font-semibold text-sm',
                      'hover:bg-amber-400 transition-colors',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {retryLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Fixing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Try again
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onFinishAsIs}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg px-4 py-2.5',
                      'border border-zinc-700 text-zinc-400 text-sm',
                      'hover:bg-zinc-800 hover:text-zinc-200',
                      'transition-colors',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50'
                    )}
                  >
                    Finish as is
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
