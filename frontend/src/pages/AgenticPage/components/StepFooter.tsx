import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, Loader2, RefreshCw, ShieldCheck, XCircle, Info, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgenticPhase } from '@/types'

export type ValidationState = 'idle' | 'validating' | 'passed' | 'failed'

export interface ValidationResult {
  valid: boolean
  feedback: string
}

export interface StepFooterProps {
  phase: AgenticPhase
  validationState: ValidationState
  feedback: string | null
  validationPrompt?: string // The static prompt that will be sent
  promptDescription?: string // Description of what will be validated
  canValidate: boolean
  isValidateRequired?: boolean // If true, shows prompt preview before validation
  hasNext: boolean
  requirement?: string
  onValidate: () => void
  onNext: () => void
}

export function StepFooter({
  phase: _phase,
  validationState,
  feedback,
  validationPrompt,
  promptDescription,
  canValidate,
  isValidateRequired = false,
  hasNext,
  requirement,
  onValidate,
  onNext,
}: StepFooterProps) {
  const passed = validationState === 'passed'
  const failed = validationState === 'failed'
  const validating = validationState === 'validating'

  // What to show in the help text area
  const helpText = passed
    ? 'This step is validated and complete.'
    : failed
      ? 'Validation failed. Review the feedback above.'
      : requirement && !canValidate
        ? requirement
        : isValidateRequired && validationPrompt
          ? promptDescription || 'Review the validation prompt below, then validate.'
          : 'Ready to validate this step.'

  return (
    <div className="space-y-4">
      {/* Validation Prompt Preview (shown when step is idle and prompt exists) */}
      <AnimatePresence>
        {isValidateRequired && validationPrompt && !passed && !failed && !validating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-gray-300 bg-gray-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Info className="w-4 h-4 shrink-0" />
                <span className="font-semibold">Validation Check</span>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3 max-h-48 overflow-y-auto">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">
                  {validationPrompt}
                </pre>
              </div>
              <p className="text-xs text-gray-500">
                This prompt will be used to validate the current state of this step.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback banner */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                'rounded-xl border p-4',
                passed
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-red-50 border-red-200'
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn('mt-0.5 shrink-0', passed ? 'text-emerald-600' : 'text-red-600')}>
                  {passed ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-semibold mb-1',
                      passed ? 'text-emerald-800' : 'text-red-800'
                    )}
                  >
                    {passed ? 'Validation passed' : 'Validation failed'}
                  </p>
                  <p
                    className={cn('text-xs leading-relaxed whitespace-pre-wrap', passed ? 'text-emerald-700' : 'text-red-700')}
                  >
                    {feedback}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {(requirement && !canValidate && !passed && !failed) ? (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 border border-amber-200">
              <AlertCircle className="w-3 h-3 text-amber-600" />
            </span>
          ) : (validationPrompt && canValidate && !passed && !failed) ? (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 border border-gray-300">
              <Info className="w-3 h-3 text-gray-600" />
            </span>
          ) : null}
          <p className={cn(
            "text-xs",
            !canValidate && !passed && !failed ? "text-amber-700" :
            validationPrompt && canValidate && !passed && !failed ? "text-gray-600" :
            "text-gray-500"
          )}>
            {helpText}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Re-validate button */}
          {passed && (
            <motion.button
              type="button"
              onClick={onValidate}
              disabled={validating}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg',
                'border border-gray-300 text-xs text-gray-600',
                'hover:text-gray-800 hover:bg-gray-50',
                'transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Re-validate
            </motion.button>
          )}

          {/* Primary action */}
          {passed && hasNext ? (
            <motion.button
              type="button"
              onClick={onNext}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-2.5 rounded-lg',
                'bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold',
                'shadow-sm',
                'transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500/50'
              )}
            >
              Next step
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          ) : (
            <button
              type="button"
              onClick={onValidate}
              disabled={!canValidate || validating}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold',
                'transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50',
                !canValidate
                  ? 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
                  : validating
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : failed
                      ? 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-50'
                      : 'bg-gray-700 hover:bg-gray-600 text-white shadow-sm'
              )}
            >
              {validating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Validating...
                </>
              ) : failed ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Try again
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Validate step
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
