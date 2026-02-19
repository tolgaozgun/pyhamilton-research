import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Loader2, Play, BarChart3 } from 'lucide-react'
import { useAppStore } from '@/store'
import { api } from '@/api/client'
import { extractCode } from '@/lib/utils'
import type { PipelineStep, AggregateMetrics } from '@/types'
import { PipelineProgress } from '@/components/PipelineProgress'
import { CodeBlock } from '@/components/CodeBlock'
import { StatusBadge } from '@/components/StatusBadge'
import { EventLog } from '@/components/EventLog'
import type { EventLogEvent } from '@/components/EventLog'
import { MetricsGrid } from '@/components/MetricsGrid'

export default function AgenticPage() {
  const { llmConfig } = useAppStore()
  const [goal, setGoal] = useState('')
  const [context, setContext] = useState('')
  const [maxRetries, setMaxRetries] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<EventLogEvent[]>([])
  const [finalScript, setFinalScript] = useState('')
  const [finalSuccess, setFinalSuccess] = useState<boolean | null>(null)
  const [currentStep, setCurrentStep] = useState<PipelineStep>('feasibility')
  const [completedSteps, setCompletedSteps] = useState<PipelineStep[]>([])
  const [failedStep, setFailedStep] = useState<PipelineStep | undefined>()
  const [showMetrics, setShowMetrics] = useState(false)
  const [metrics, setMetrics] = useState<AggregateMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  const resetState = () => {
    setError(null)
    setEvents([])
    setFinalScript('')
    setFinalSuccess(null)
    setCurrentStep('feasibility')
    setCompletedSteps([])
    setFailedStep(undefined)
    setShowMetrics(false)
    setMetrics(null)
  }

  const pushEvent = (evt: EventLogEvent) => {
    setEvents((prev) => [...prev, evt])
  }

  const handleRun = useCallback(() => {
    if (!goal.trim()) return

    setLoading(true)
    resetState()

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const es = api.agentic.stream({
      goal: goal.trim(),
      provider_name: llmConfig.provider,
      model_name: llmConfig.model_name,
      api_key: llmConfig.api_key,
      context: context.trim() || undefined,
      max_retries: String(maxRetries),
    })
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const now = new Date().toLocaleTimeString()

        if (data.type === 'step_start' && data.step) {
          setCurrentStep(data.step as PipelineStep)
          pushEvent({
            type: 'step',
            title: `Starting: ${data.step}`,
            timestamp: now,
          })
        }

        if (data.type === 'step_complete' && data.step) {
          setCompletedSteps((prev) =>
            prev.includes(data.step as PipelineStep)
              ? prev
              : [...prev, data.step as PipelineStep]
          )
          pushEvent({
            type: 'success',
            title: `Completed: ${data.step}`,
            content: typeof data.result === 'string' ? data.result.slice(0, 200) : undefined,
            timestamp: now,
          })
        }

        if (data.type === 'retry') {
          pushEvent({
            type: 'retry',
            title: `Retry ${data.attempt || ''}`,
            content: data.reason || data.message || 'Retrying failed step…',
            timestamp: now,
          })
          if (data.step) {
            setCompletedSteps((prev) => prev.filter((s) => s !== data.step))
            setFailedStep(undefined)
          }
        }

        if (data.type === 'error') {
          const step = data.step as PipelineStep | undefined
          if (step) setFailedStep(step)
          pushEvent({
            type: 'error',
            title: `Error${step ? `: ${step}` : ''}`,
            content: data.message || data.content || 'Unknown error',
            timestamp: now,
          })
        }

        if (data.type === 'done' || data.type === 'complete') {
          const script = data.final_script || data.script || ''
          if (script) setFinalScript(extractCode(script))
          setFinalSuccess(data.success ?? !failedStep)
          pushEvent({
            type: data.success !== false ? 'complete' : 'failed',
            title: data.success !== false ? 'Pipeline Complete' : 'Pipeline Failed',
            content: data.message,
            timestamp: now,
          })
          setLoading(false)
          es.close()
        }
      } catch {
        // non-JSON event
      }
    }

    es.onerror = () => {
      if (!events.length) {
        setError('Connection lost. Check your API key and try again.')
      }
      setLoading(false)
      es.close()
      eventSourceRef.current = null
    }
  }, [goal, context, maxRetries, llmConfig, failedStep, events.length])

  const handleShowMetrics = useCallback(async () => {
    if (showMetrics) {
      setShowMetrics(false)
      return
    }
    setMetricsLoading(true)
    try {
      const data = await api.config.getMetrics()
      setMetrics(data)
      setShowMetrics(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics')
    } finally {
      setMetricsLoading(false)
    }
  }, [showMetrics])

  const flatMetrics: Record<string, string | number> = metrics
    ? {
        total_runs: metrics.total_runs,
        first_pass_successes: metrics.first_pass_successes,
        final_successes: metrics.final_successes,
        total_retries: metrics.total_retries,
        total_syntax_errors: metrics.total_syntax_errors,
        total_hallucinations: metrics.total_hallucinations,
        ...Object.fromEntries(
          Object.entries(metrics.error_categories).map(([k, v]) => [`err: ${k}`, v])
        ),
      }
    : {}

  const showPipeline = loading || completedSteps.length > 0 || failedStep

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Bot className="w-5 h-5 text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Agentic Mode</h1>
        </div>
        <p className="text-zinc-400 text-sm ml-12">
          Autonomous pipeline with automatic retries. The agent will fix errors and re-run failed steps.
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
            Max Retries: <span className="text-emerald-400">{maxRetries}</span>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={maxRetries}
            onChange={(e) => setMaxRetries(Number(e.target.value))}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>

        <div className="flex gap-3">
          <motion.button
            onClick={handleRun}
            disabled={loading || !goal.trim()}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            whileHover={{ scale: loading ? 1 : 1.01 }}
            whileTap={{ scale: loading ? 1 : 0.99 }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running Agent…
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Agent
              </>
            )}
          </motion.button>

          <motion.button
            onClick={handleShowMetrics}
            disabled={metricsLoading}
            className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 font-medium rounded-lg transition-colors flex items-center gap-2 border border-zinc-700"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {metricsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <BarChart3 className="w-4 h-4" />
            )}
            Metrics
          </motion.button>
        </div>
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
        {showMetrics && metrics && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
                Aggregate Metrics
              </h3>
              <MetricsGrid metrics={flatMetrics} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {events.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
            Event Log
          </h3>
          <div className="h-72">
            <EventLog events={events} />
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {finalSuccess !== null && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <StatusBadge
                  status={finalSuccess ? 'success' : 'error'}
                  label={finalSuccess ? 'Agent Succeeded' : 'Agent Failed'}
                />
              </div>
              {finalScript && (
                <CodeBlock code={finalScript} filename="pyhamilton_script.py" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
