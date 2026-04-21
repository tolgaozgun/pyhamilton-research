import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PlayCircle,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  Loader2,
  Zap,
  FileCode,
  Activity,
  TrendingUp,
  ChevronRight,
  ChevronDown,
  X,
  Info,
  Flame,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { axiosInstance } from '@/lib/axios'
import { useAPIConfigured } from '@/hooks/useAPIConfigured'
import { SetupPrompt } from '@/components/SetupPrompt'

// ─── Types ───────────────────────────────────────────────────────────────────────

interface ScenarioConfig {
  name: string
  goal: string
  deck_config?: Record<string, unknown>
  max_retries?: number
}

interface ScenarioMetrics {
  scenario_id: number
  scenario_name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  duration_seconds: number
  success: boolean
  error?: string
  token_usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  retry_count: number
  syntax_passed: boolean
  interpreter_passed: boolean
  pytest_passed: boolean
  generated_script?: string
}

interface ParallelRunMetrics {
  run_id: string
  name: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  total_scenarios: number
  completed_scenarios: number
  successful_scenarios: number
  failed_scenarios: number
  duration_seconds: number
  average_duration: number
  total_tokens_used: number
  scenarios: ScenarioMetrics[]
  created_at: string
  started_at?: string
  completed_at?: string
}

interface MetricsSummary {
  total_runs: number
  completed_runs: number
  total_scenarios: number
  successful_scenarios: number
  failed_scenarios: number
  success_rate: number
  average_duration: number
  total_tokens_used: number
  average_tokens_per_scenario: number
}

// ─── Constants ────────────────────────────────────────────────────────────────────

const DEFAULT_SCENARIOS: ScenarioConfig[] = [
  {
    name: 'Simple Transfer',
    goal: 'Transfer 100uL from plate A1 to plate B1 using 300uL tips',
  },
  {
    name: 'Serial Dilution',
    goal: 'Create a 1:10 serial dilution across 8 wells in a 96-well plate',
  },
  {
    name: 'Plate Replication',
    goal: 'Replicate plate layout from source 96-well plate to destination plate',
  },
]

const PROVIDER_OPTIONS = [
  { value: 'anthropic', label: 'Anthropic Claude' },
  { value: 'openai', label: 'OpenAI GPT' },
  { value: 'google', label: 'Google Gemini' },
]

// ─── Components ────────────────────────────────────────────────────────────────────

function ScenarioCard({ scenario, index, onRemove, onUpdate }: {
  scenario: ScenarioConfig
  index: number
  onRemove: (index: number) => void
  onUpdate: (index: number, scenario: ScenarioConfig) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <input
            type="text"
            value={scenario.name}
            onChange={(e) => onUpdate(index, { ...scenario, name: e.target.value })}
            placeholder="Scenario name"
            className="bg-transparent text-zinc-100 font-medium text-sm focus:outline-none"
          />
          <p className="text-zinc-500 text-xs mt-1">{scenario.goal.substring(0, 60)}...</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            {expanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
          </button>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4 text-zinc-400 hover:text-red-400" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-zinc-800"
          >
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Automation Goal
            </label>
            <textarea
              value={scenario.goal}
              onChange={(e) => onUpdate(index, { ...scenario, goal: e.target.value })}
              placeholder="Describe the automation goal..."
              rows={3}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500/50 resize-none"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function RunCard({ run, onCancel }: {
  run: ParallelRunMetrics
  onCancel: (runId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const progress = run.total_scenarios > 0 ? (run.completed_scenarios / run.total_scenarios) * 100 : 0

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-zinc-200'
      case 'running': return 'text-zinc-300'
      case 'failed': return 'text-zinc-400'
      case 'cancelled': return 'text-zinc-500'
      default: return 'text-zinc-400'
    }
  }

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-zinc-800/50 border-zinc-700'
      case 'running': return 'bg-zinc-800/30 border-zinc-700/50'
      case 'failed': return 'bg-zinc-900/50 border-zinc-800'
      case 'cancelled': return 'bg-zinc-900/30 border-zinc-800/50'
      default: return 'bg-zinc-800 border-zinc-700'
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 transition-all',
        getStatusBg(run.status)
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-zinc-100">{run.name}</h3>
            <span className={cn('text-xs px-2 py-0.5 rounded-full', getStatusColor(run.status))}>
              {run.status}
            </span>
          </div>

          <div className="flex items-center gap-4 mt-2 text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <FileCode className="w-3 h-3" />
              {run.completed_scenarios}/{run.total_scenarios} scenarios
            </span>
            {run.status === 'completed' && (
              <>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-zinc-400" />
                  {run.successful_scenarios} successful
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {run.duration_seconds.toFixed(1)}s
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {(run.total_tokens_used / 1000).toFixed(0)}k tokens
                </span>
              </>
            )}
          </div>

          {/* Progress bar */}
          {run.status === 'running' && (
            <div className="mt-3">
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-zinc-500 rounded-full"
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">{progress.toFixed(0)}% complete</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {run.status === 'running' && (
            <button
              type="button"
              onClick={() => onCancel(run.run_id)}
              className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
              title="Cancel run"
            >
              <X className="w-4 h-4 text-zinc-400 hover:text-red-400" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            {expanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-zinc-700/50"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {run.scenarios.map((scenario) => (
                <div
                  key={scenario.scenario_id}
                  className={cn(
                    'p-2 rounded-lg border text-xs',
                    scenario.status === 'completed' && scenario.success
                      ? 'bg-zinc-800/50 border-zinc-700'
                      : scenario.status === 'completed' && !scenario.success
                      ? 'bg-zinc-900/50 border-zinc-800'
                      : scenario.status === 'running'
                      ? 'bg-zinc-800/30 border-zinc-700/50'
                      : 'bg-zinc-800/50 border-zinc-800'
                  )}
                >
                  <div className="font-medium text-zinc-300 truncate">{scenario.scenario_name}</div>
                  <div className="text-zinc-500 mt-0.5">{scenario.status}</div>
                  {scenario.duration_seconds > 0 && (
                    <div className="text-zinc-600 mt-0.5">{scenario.duration_seconds.toFixed(1)}s</div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function MetricsCard({ summary }: { summary: MetricsSummary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-zinc-500 text-xs">Total Runs</span>
          <Activity className="w-4 h-4 text-zinc-600" />
        </div>
        <p className="text-2xl font-bold text-zinc-100">{summary.total_runs}</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-zinc-500 text-xs">Success Rate</span>
          <TrendingUp className="w-4 h-4 text-zinc-500" />
        </div>
        <p className="text-2xl font-bold text-zinc-100">
          {(summary.success_rate * 100).toFixed(0)}%
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-zinc-500 text-xs">Avg Duration</span>
          <Clock className="w-4 h-4 text-zinc-500" />
        </div>
        <p className="text-2xl font-bold text-zinc-100">
          {summary.average_duration.toFixed(1)}s
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-zinc-500 text-xs">Total Tokens</span>
          <Zap className="w-4 h-4 text-zinc-500" />
        </div>
        <p className="text-2xl font-bold text-zinc-100">
          {(summary.total_tokens_used / 1000).toFixed(0)}k
        </p>
      </div>
    </div>
  )
}

function NewSimulationForm({ onSubmit, onCancel }: {
  onSubmit: (name: string, scenarios: ScenarioConfig[], parallelism: number, provider: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('Simulation Run')
  const [scenarios, setScenarios] = useState<ScenarioConfig[]>([...DEFAULT_SCENARIOS])
  const [parallelism, setParallelism] = useState(3)
  const [provider, setProvider] = useState('anthropic')

  const addScenario = () => {
    setScenarios([...scenarios, {
      name: `Scenario ${scenarios.length + 1}`,
      goal: '',
    }])
  }

  const updateScenario = (index: number, scenario: ScenarioConfig) => {
    const updated = [...scenarios]
    updated[index] = scenario
    setScenarios(updated)
  }

  const removeScenario = (index: number) => {
    setScenarios(scenarios.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (scenarios.length === 0) {
      toast.error('Add at least one scenario')
      return
    }
    onSubmit(name, scenarios, parallelism, provider)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Run Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Simulation"
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            AI Provider
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
          >
            {PROVIDER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Parallelism: {parallelism} concurrent runs
        </label>
        <input
          type="range"
          min="1"
          max="5"
          value={parallelism}
          onChange={(e) => setParallelism(parseInt(e.target.value))}
          className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-500"
        />
        <div className="flex justify-between text-xs text-zinc-600 mt-1">
          <span>1</span>
          <span>3</span>
          <span>5</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-zinc-300">
            Scenarios ({scenarios.length})
          </label>
          <button
            type="button"
            onClick={addScenario}
            className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add Scenario
          </button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {scenarios.map((scenario, index) => (
            <ScenarioCard
              key={index}
              scenario={scenario}
              index={index}
              onRemove={removeScenario}
              onUpdate={updateScenario}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          className={cn(
            'flex-1 px-4 py-2 rounded-lg text-sm font-medium',
            'bg-zinc-800 hover:bg-zinc-700 text-white',
            'flex items-center justify-center gap-2'
          )}
        >
          <PlayCircle className="w-4 h-4" />
          Start Simulation
        </button>
      </div>
    </form>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────────

export default function SimulationPage() {
  const apiConfig = useAPIConfigured()
  const [runs, setRuns] = useState<ParallelRunMetrics[]>([])
  const [summary, setSummary] = useState<MetricsSummary>({
    total_runs: 0,
    completed_runs: 0,
    total_scenarios: 0,
    successful_scenarios: 0,
    failed_scenarios: 0,
    success_rate: 0,
    average_duration: 0,
    total_tokens_used: 0,
    average_tokens_per_scenario: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)

  const fetchRuns = useCallback(async () => {
    try {
      const [runsResponse, summaryResponse] = await Promise.all([
        axiosInstance.get<ParallelRunMetrics[]>('/api/simulation/parallel'),
        axiosInstance.get<MetricsSummary>('/api/simulation/metrics/summary'),
      ])

      setRuns(runsResponse.data)
      setSummary(summaryResponse.data)
    } catch (error) {
      console.error('Failed to fetch simulation data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const startSimulation = async (
    name: string,
    scenarios: ScenarioConfig[],
    parallelism: number,
    provider: string
  ) => {
    try {
      const response = await axiosInstance.post('/api/simulation/parallel/start', {
        name,
        config: {
          scenarios,
          parallelism,
          llm_provider: provider,
          max_retries: 2,
          tags: [],
        },
      })

      toast.success(`Started simulation with ${scenarios.length} scenarios`)
      setShowNewForm(false)
      fetchRuns()

      // Poll for updates while running
      const pollInterval = setInterval(async () => {
        const runResponse = await axiosInstance.get(`/api/simulation/parallel/${response.data.run_id}`)
        const run = runResponse.data

        if (run.status !== 'running') {
          clearInterval(pollInterval)
          fetchRuns()
        } else {
          // Update the specific run in the list
          setRuns(prev => prev.map(r =>
            r.run_id === run.run_id ? run : r
          ))
        }
      }, 2000)
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Failed to start simulation'
      toast.error(message)
    }
  }

  const cancelRun = async (runId: string) => {
    try {
      await axiosInstance.delete(`/api/simulation/parallel/${runId}`)
      toast.success('Simulation cancelled')
      fetchRuns()
    } catch (error) {
      toast.error('Failed to cancel simulation')
    }
  }

  const seedDemoData = async () => {
    try {
      const response = await axiosInstance.post('/api/simulation/seed')
      toast.success(`Loaded demo data: ${response.data.total_scenarios} scenarios across ${response.data.runs_count} runs`)
      fetchRuns()
    } catch (error) {
      toast.error('Failed to load demo data')
    }
  }

  useEffect(() => {
    fetchRuns()
    // Poll every 5 seconds for updates
    const interval = setInterval(fetchRuns, 5000)
    return () => clearInterval(interval)
  }, [fetchRuns])

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Setup prompt if API not configured */}
      {!apiConfig.isLoading && !apiConfig.isConfigured && (
        <SetupPrompt
          variant="banner"
          message="Configure an AI provider API key to run simulations"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-800 rounded-xl">
            <Flame className="w-5 h-5 text-zinc-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Parallel Simulation</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Run multiple agentic workflows in parallel with metrics tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={seedDemoData}
            disabled={!apiConfig.isConfigured}
            className={cn(
              'px-3 py-2 rounded-lg text-xs font-medium border transition-all',
              apiConfig.isConfigured
                ? 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                : 'border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
            )}
            title={!apiConfig.isConfigured ? 'Configure API key first' : 'Load demo data'}
          >
            Load Demo Data
          </button>
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            disabled={!apiConfig.isConfigured}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all',
              apiConfig.isConfigured
                ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
            )}
            title={!apiConfig.isConfigured ? 'Configure API key first' : 'Create new simulation'}
          >
            <Plus className="w-4 h-4" />
            New Simulation
          </button>
        </div>
      </div>

      {/* Metrics Summary */}
      <MetricsCard summary={summary} />

      {/* New Simulation Form Modal */}
      <AnimatePresence>
        {showNewForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewForm(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-2xl my-8"
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                  <h3 className="text-lg font-semibold text-zinc-100">New Simulation</h3>
                  <button
                    type="button"
                    onClick={() => setShowNewForm(false)}
                    className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>

                <div className="p-6">
                  <NewSimulationForm
                    onSubmit={startSimulation}
                    onCancel={() => setShowNewForm(false)}
                  />
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Runs List */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-100 mb-3">Simulation Runs</h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
          </div>
        ) : runs.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {runs.map((run) => (
                <RunCard
                  key={run.run_id}
                  run={run}
                  onCancel={cancelRun}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-xl">
            <Flame className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
            <h3 className="text-zinc-300 font-medium mb-1">No simulations yet</h3>
            <p className="text-sm text-zinc-500 mb-4">Create your first parallel simulation run</p>
            <button
              type="button"
              onClick={() => setShowNewForm(true)}
              disabled={!apiConfig.isConfigured}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                apiConfig.isConfigured
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
              )}
              title={!apiConfig.isConfigured ? 'Configure API key first' : 'Create simulation'}
            >
              <Plus className="w-4 h-4" />
              Create Simulation
            </button>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
          <div className="text-sm text-zinc-500 space-y-1">
            <p>Parallel simulation runs multiple agentic workflows simultaneously, tracking metrics like execution time, token usage, and success rates.</p>
            <p>Each scenario follows the same process as the Agentic workflow: validation, generation, and verification.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
