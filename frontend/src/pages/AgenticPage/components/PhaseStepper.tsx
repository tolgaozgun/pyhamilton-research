import { CheckCircle2, Lock, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgenticPhase } from '@/types'

export interface PhaseStepperProps {
  currentPhase: AgenticPhase
  validationState: Record<AgenticPhase, 'idle' | 'validating' | 'passed' | 'failed'>
  isUnlocked: (phase: AgenticPhase) => boolean
  onPhaseSelect: (phase: AgenticPhase) => void
}

const PHASE_ORDER: AgenticPhase[] = ['deck_layout', 'procedure', 'generation']

const PHASE_META: Record<
  AgenticPhase,
  { label: string; description: string; icon: LucideIcon }
> = {
  deck_layout: {
    label: 'Deck layout',
    description: 'Configure and validate the deck before anything else.',
    icon: Lock,
  },
  procedure: {
    label: 'Procedure',
    description: 'Define and validate what the script should do.',
    icon: Lock,
  },
  generation: {
    label: 'Generation',
    description: 'Generate, verify, and export script + tests.',
    icon: Lock,
  },
}

function PhaseStep({
  phase,
  index,
  isCurrent,
  isPassed,
  isUnlocked,
  onSelect,
  showConnector,
}: {
  phase: AgenticPhase
  index: number
  isCurrent: boolean
  isPassed: boolean
  isUnlocked: boolean
  onSelect: () => void
  showConnector: boolean
}) {
  const locked = !isUnlocked && !isPassed

  return (
    <div className="flex items-center flex-1 last:flex-none">
      <button
        type="button"
        disabled={locked}
        onClick={onSelect}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all duration-200 w-full',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50',
          isCurrent
            ? 'border-gray-400 bg-gray-50 shadow-sm'
            : isPassed
              ? 'border-emerald-200 bg-emerald-50 cursor-pointer hover:bg-emerald-100'
              : locked
                ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60'
                : 'border-gray-200 bg-white text-gray-500 cursor-pointer hover:bg-gray-50'
        )}
      >
        <span
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0 transition-all',
            isPassed
              ? 'bg-emerald-600 text-white'
              : isCurrent
                ? 'bg-gray-700 text-white'
                : 'bg-gray-200 text-gray-500'
          )}
        >
          {isPassed ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : locked ? (
            <Lock className="w-3.5 h-3.5" />
          ) : (
            index + 1
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'text-sm font-semibold leading-tight truncate',
              isCurrent ? 'text-gray-900' : isPassed ? 'text-gray-700' : 'text-gray-500'
            )}
          >
            {PHASE_META[phase].label}
          </div>
          {isCurrent && (
            <div className="text-xs text-gray-500 leading-tight mt-0.5 truncate">
              {PHASE_META[phase].description}
            </div>
          )}
        </div>
      </button>
      {showConnector && (
        <div
          className={cn(
            'h-px flex-1 mx-2 transition-colors duration-300',
            isPassed ? 'bg-emerald-300' : 'bg-gray-200'
          )}
        />
      )}
    </div>
  )
}

export function PhaseStepper({
  currentPhase,
  validationState,
  isUnlocked,
  onPhaseSelect,
}: PhaseStepperProps) {
  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-center gap-0 min-w-max">
        {PHASE_ORDER.map((phase, index) => (
          <PhaseStep
            key={phase}
            phase={phase}
            index={index}
            isCurrent={phase === currentPhase}
            isPassed={validationState[phase] === 'passed'}
            isUnlocked={isUnlocked(phase)}
            onSelect={() => onPhaseSelect(phase)}
            showConnector={index < PHASE_ORDER.length - 1}
          />
        ))}
      </div>
    </div>
  )
}
