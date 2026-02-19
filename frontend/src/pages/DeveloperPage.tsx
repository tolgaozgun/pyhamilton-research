import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Code2, Loader2, Play, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { useAppStore } from '@/store'
import { api } from '@/api/client'
import { extractCode, downloadFile } from '@/lib/utils'
import type { PipelineStep, LabwareMap, SimulationResult, ComparisonResult } from '@/types'
import { PipelineProgress } from '@/components/PipelineProgress'
import { CodeBlock } from '@/components/CodeBlock'
import { StatusBadge } from '@/components/StatusBadge'

interface StepResults {
  feasibility?: string
  labware_map?: LabwareMap
  generated_code?: string
  syntax_ok?: boolean
  syntax_errors?: string[]
  simulation?: SimulationResult
  comparison?: ComparisonResult
  final_script?: string
}

export default function DeveloperPage() {
  const { llmConfig } = useAppStore()
  const [goal, setGoal] = useState('')
  const [context, setContext] = useState('')
  const [expectedOutcome, setExpectedOutcome] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<PipelineStep>('feasibility')
  const [completedSteps, setCompletedSteps] = useState<PipelineStep[]>([])
  const [failedStep, setFailedStep] = useState<PipelineStep | undefined>()
  const [results, setResults] = useState<StepResults>({})
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const eventSourceRef = useRef<EventSource | null>(null)

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const resetState = () => {
    setError(null)
    setCurrentStep('feasibility')
    setCompletedSteps([])
    setFailedStep(undefined)
    setResults({})
    setExpandedSections({})
  }

  const handleRun = useCallback(() => {
    if (!goal.trim()) return

    setLoading(true)
    resetState()

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const es = api.developer.stream({
      goal: goal.trim(),
      provider_name: llmConfig.provider,
      model_name: llmConfig.model_name,
      api_key: llmConfig.api_key,
      context: context.trim() || undefined,
    })
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'step_start' && data.step) {
          setCurrentStep(data.step as PipelineStep)
        }

        if (data.type === 'step_complete' && data.step) {
          const step = data.step as PipelineStep
          setCompletedSteps((prev) => [...prev, step])

          setResults((prev) => {
            const next = { ...prev }
            switch (step) {
              case 'feasibility':
                next.feasibility = data.result || data.data?.feasibility || ''
                break
              case 'labware_map':
                next.labware_map = data.result || data.data?.labware_map
                break
              case 'code_generation':
                next.generated_code = extractCode(data.result || data.data?.generated_code || '')
                break
              case 'syntax_check':
                next.syntax_ok = data.result?.success ?? data.data?.syntax_ok ?? true
                next.syntax_errors = data.result?.errors || data.data?.syntax_errors || []
                break
              case 'simulation':
                next.simulation = data.result || data.data?.simulation
                break
              case 'outcome_comparison':
                next.comparison = data.result || data.data?.comparison
                break
              case 'results':
                next.final_script = data.result?.final_script || data.data?.final_script || next.generated_code
                break
            }
            return next
          })
        }

        if (data.type === 'error') {
          const step = (data.step as PipelineStep) || currentStep
          setFailedStep(step)
          setError(data.message || data.content || 'Pipeline failed')
          setLoading(false)
          es.close()
        }

        if (data.type === 'done' || data.type === 'complete') {
          if (data.final_script) {
            setResults((prev) => ({
              ...prev,
              final_script: extractCode(data.final_script),
            }))
          }
          setLoading(false)
          es.close()
        }
      } catch {
        // non-JSON event, skip
      }
    }

    es.onerror = () => {
      if (!completedSteps.length) {
        setError('Connection lost. Check your API key and try again.')
      }
      setLoading(false)
      es.close()
      eventSourceRef.current = null
    }
  }, [goal, context, llmConfig, currentStep, completedSteps.length])

  const feasibilityPassed =
    results.feasibility &&
    !results.feasibility.toLowerCase().includes('not feasible') &&
    !results.feasibility.toLowerCase().includes('infeasible')

  const showPipeline = loading || completedSteps.length > 0 || failedStep

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Code2 className="w-5 h-5 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Developer Mode</h1>
        </div>
        <p className="text-zinc-400 text-sm ml-12">
          Step-by-step validated pipeline. Each stage is verified before proceeding to the next.
        </p>
      </div>

      {showPipeline && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
        >
          <PipelineProgress
            currentStep={currentStep}
            completedSteps={completedSteps}
            failedStep={failedStep}
          />
        </motion.div>
      )}

      <div className="grid gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Procedure Description
          </label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe the liquid handling procedure in detail…"
            rows={5}
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none text-sm leading-relaxed font-mono"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Additional Context
              <span className="text-zinc-500 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Labware details, special constraints…"
              rows={3}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none text-sm leading-relaxed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Expected Outcome
              <span className="text-zinc-500 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={expectedOutcome}
              onChange={(e) => setExpectedOutcome(e.target.value)}
              placeholder="What the final result should look like…"
              rows={3}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none text-sm leading-relaxed"
            />
          </div>
        </div>

        <motion.button
          onClick={handleRun}
          disabled={loading || !goal.trim()}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          whileHover={{ scale: loading ? 1 : 1.01 }}
          whileTap={{ scale: loading ? 1 : 0.99 }}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running Pipeline…
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Pipeline
            </>
          )}
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-500/10 border border-red-500/30 rounded-lg p-4"
          >
            <p className="text-red-400 text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {completedSteps.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {completedSteps.includes('feasibility') && results.feasibility && (
              <ResultCard title="Feasibility Analysis">
                <div className="flex items-start gap-3">
                  <StatusBadge
                    status={feasibilityPassed ? 'success' : 'error'}
                    label={feasibilityPassed ? 'Feasible' : 'Not Feasible'}
                  />
                  <p className="text-sm text-zinc-300 leading-relaxed flex-1">
                    {results.feasibility}
                  </p>
                </div>
              </ResultCard>
            )}

            {completedSteps.includes('labware_map') && results.labware_map && (
              <ResultCard title="Labware Map">
                <div className="space-y-3">
                  {Object.keys(results.labware_map.positions).length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-800">
                            <th className="text-left py-2 px-3 text-zinc-400 font-medium">Position</th>
                            <th className="text-left py-2 px-3 text-zinc-400 font-medium">Labware</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(results.labware_map.positions).map(([pos, labware]) => (
                            <tr key={pos} className="border-b border-zinc-800/50">
                              <td className="py-2 px-3 text-emerald-400 font-mono text-xs">{pos}</td>
                              <td className="py-2 px-3 text-zinc-100">{labware}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </ResultCard>
            )}

            {completedSteps.includes('code_generation') && results.generated_code && (
              <ResultCard title="Generated Code">
                <CodeBlock code={results.generated_code} filename="generated_script.py" />
              </ResultCard>
            )}

            {completedSteps.includes('syntax_check') && (
              <ResultCard title="Syntax Check">
                <div className="space-y-2">
                  <StatusBadge
                    status={results.syntax_ok ? 'success' : 'error'}
                    label={results.syntax_ok ? 'Passed' : 'Failed'}
                  />
                  {results.syntax_errors && results.syntax_errors.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {results.syntax_errors.map((err, i) => (
                        <li key={i} className="text-sm text-red-400 font-mono bg-red-500/5 px-3 py-1.5 rounded">
                          {err}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </ResultCard>
            )}

            {completedSteps.includes('simulation') && results.simulation && (
              <ResultCard title="Simulation">
                <div className="space-y-3">
                  <StatusBadge
                    status={results.simulation.success ? 'success' : 'error'}
                    label={results.simulation.success ? 'Passed' : 'Failed'}
                  />
                  {(results.simulation.errors.length > 0 || results.simulation.warnings.length > 0) && (
                    <div className="space-y-1 mt-2">
                      {results.simulation.errors.map((e, i) => (
                        <div key={`e-${i}`} className="text-sm text-red-400 bg-red-500/5 px-3 py-1.5 rounded">
                          {e}
                        </div>
                      ))}
                      {results.simulation.warnings.map((w, i) => (
                        <div key={`w-${i}`} className="text-sm text-amber-400 bg-amber-500/5 px-3 py-1.5 rounded">
                          {w}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => toggleSection('simLogs')}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mt-2"
                  >
                    {expandedSections.simLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {expandedSections.simLogs ? 'Hide' : 'Show'} operation logs ({results.simulation.operations_log.length})
                  </button>
                  <AnimatePresence>
                    {expandedSections.simLogs && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-zinc-950 rounded-lg p-3 max-h-60 overflow-y-auto space-y-0.5">
                          {results.simulation.operations_log.map((log, i) => (
                            <div key={i} className="text-xs text-zinc-400 font-mono leading-5">
                              {log}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </ResultCard>
            )}

            {completedSteps.includes('outcome_comparison') && results.comparison && (
              <ResultCard title="Outcome Comparison">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      status={results.comparison.match ? 'success' : 'warning'}
                      label={results.comparison.match ? 'Match' : 'Mismatch'}
                    />
                    <span className="text-xs text-zinc-500">
                      Score: {results.comparison.score}/100 · Tier: {results.comparison.tier}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed">{results.comparison.explanation}</p>
                  {results.comparison.diffs.length > 0 && (
                    <ul className="space-y-1">
                      {results.comparison.diffs.map((d, i) => (
                        <li key={i} className="text-xs text-amber-400 bg-amber-500/5 px-3 py-1.5 rounded">
                          {d}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </ResultCard>
            )}

            {completedSteps.includes('results') && (
              <ResultCard title="Final Results">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      status={!failedStep ? 'success' : 'error'}
                      label={!failedStep ? 'Pipeline Passed' : 'Pipeline Failed'}
                    />
                  </div>
                  {(results.final_script || results.generated_code) && (
                    <div className="flex gap-2">
                      <motion.button
                        onClick={() =>
                          downloadFile(
                            results.final_script || results.generated_code || '',
                            'pyhamilton_script.py'
                          )
                        }
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Download className="w-4 h-4" />
                        Download Script
                      </motion.button>
                    </div>
                  )}
                </div>
              </ResultCard>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ResultCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
    >
      <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
        {title}
      </h3>
      {children}
    </motion.div>
  )
}
