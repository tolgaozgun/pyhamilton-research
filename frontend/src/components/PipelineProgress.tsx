import { motion } from 'framer-motion'
import type { PipelineStep } from '@/types'
import { PIPELINE_STEPS } from '@/types'
import { cn } from '@/lib/utils'

export interface PipelineProgressProps {
  currentStep: PipelineStep
  failedStep?: PipelineStep
  completedSteps: PipelineStep[]
}

export function PipelineProgress({ currentStep, failedStep, completedSteps }: PipelineProgressProps) {
  const getStepStatus = (step: PipelineStep) => {
    if (failedStep === step) return 'failed'
    if (completedSteps.includes(step)) return 'completed'
    if (currentStep === step) return 'active'
    return 'pending'
  }

  const getStepColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-500 border-blue-400'
      case 'completed':
        return 'bg-emerald-500 border-emerald-400'
      case 'failed':
        return 'bg-red-500 border-red-400'
      default:
        return 'bg-zinc-700 border-zinc-600'
    }
  }

  const getConnectorColor = (index: number) => {
    const currentIndex = PIPELINE_STEPS.findIndex((s) => s.key === currentStep)
    const failedIndex = failedStep ? PIPELINE_STEPS.findIndex((s) => s.key === failedStep) : -1
    
    if (index < currentIndex) {
      return 'bg-emerald-500'
    }
    if (index === currentIndex && failedIndex === index) {
      return 'bg-red-500'
    }
    return 'bg-zinc-700'
  }

  return (
    <div className="flex items-center gap-2 py-4">
      {PIPELINE_STEPS.map((step, index) => {
        const status = getStepStatus(step.key)
        const isActive = status === 'active'
        const isCompleted = status === 'completed'
        const isFailed = status === 'failed'

        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className="relative">
                <motion.div
                  className={cn(
                    'w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-medium transition-colors',
                    getStepColor(status),
                    isActive && 'ring-2 ring-blue-500/50'
                  )}
                  animate={
                    isActive
                      ? {
                          scale: [1, 1.1, 1],
                          boxShadow: [
                            '0 0 0 0 rgba(59, 130, 246, 0)',
                            '0 0 0 4px rgba(59, 130, 246, 0.3)',
                            '0 0 0 0 rgba(59, 130, 246, 0)',
                          ],
                        }
                      : {}
                  }
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  {isCompleted && (
                    <motion.svg
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-5 h-5 text-zinc-950"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </motion.svg>
                  )}
                  {isFailed && (
                    <motion.svg
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-5 h-5 text-zinc-950"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </motion.svg>
                  )}
                  {!isCompleted && !isFailed && (
                    <span className="text-zinc-100">{index + 1}</span>
                  )}
                </motion.div>
              </div>
              <span
                className={cn(
                  'mt-2 text-xs text-center',
                  isActive ? 'text-blue-400 font-medium' : 'text-zinc-500'
                )}
              >
                {step.label}
              </span>
            </div>
            {index < PIPELINE_STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 relative">
                <div className={cn('h-full transition-colors', getConnectorColor(index))} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default PipelineProgress
