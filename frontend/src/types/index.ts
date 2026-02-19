export type Mode = 'simple' | 'developer' | 'agentic'

export type Provider = 'google' | 'openai' | 'anthropic' | 'openrouter'

export type PipelineStep = 
  | 'feasibility' 
  | 'labware_map' 
  | 'code_generation' 
  | 'syntax_check' 
  | 'simulation' 
  | 'outcome_comparison'
  | 'results'

export interface LLMConfig {
  provider: Provider
  model_name: string
  api_key: string
  temperature: number
  max_tokens: number
}

export interface UserInput {
  goal: string
  mode: Mode
  context?: string
  image_b64?: string
  max_retries?: number
}

export interface LabwareMap {
  positions: Record<string, string>
  tips: string[]
  plates: string[]
  reservoirs: string[]
  raw_text: string
}

export interface SimulationResult {
  success: boolean
  tip_usage: Record<string, number>
  volumes_moved: Record<string, number>
  errors: string[]
  warnings: string[]
  operations_log: string[]
}

export interface ComparisonResult {
  match: boolean
  tier: string
  score: number
  explanation: string
  diffs: string[]
}

export interface PipelineState {
  step: PipelineStep
  user_input: UserInput
  llm_config: LLMConfig
  feasibility?: string
  labware_map?: LabwareMap
  generated_code?: string
  syntax_ok: boolean
  syntax_errors: string[]
  simulation?: SimulationResult
  comparison?: ComparisonResult
  final_script?: string
  retry_count: number
  max_retries: number
  events: Array<Record<string, unknown>>
  error?: string
}

export interface ProviderInfo {
  providers: Record<string, string[]>
}

export interface LabwareInfo {
  id: string
  name: string
  type: string
}

export interface AggregateMetrics {
  total_runs: number
  first_pass_successes: number
  final_successes: number
  total_retries: number
  total_syntax_errors: number
  total_hallucinations: number
  error_categories: Record<string, number>
}

export const PIPELINE_STEPS: { key: PipelineStep; label: string }[] = [
  { key: 'feasibility', label: 'Feasibility' },
  { key: 'labware_map', label: 'Labware Map' },
  { key: 'code_generation', label: 'Code Gen' },
  { key: 'syntax_check', label: 'Syntax' },
  { key: 'simulation', label: 'Simulation' },
  { key: 'outcome_comparison', label: 'Comparison' },
  { key: 'results', label: 'Results' },
]

export const PROVIDER_LABELS: Record<Provider, string> = {
  google: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
}

export const MODE_INFO: Record<Mode, { label: string; description: string; icon: string }> = {
  simple: {
    label: 'Simple',
    description: 'Prompt in, script out. No validation.',
    icon: 'Zap',
  },
  developer: {
    label: 'Developer', 
    description: 'Step-by-step validated pipeline.',
    icon: 'Code2',
  },
  agentic: {
    label: 'Agentic',
    description: 'Autonomous pipeline with auto-retry.',
    icon: 'Bot',
  },
}
