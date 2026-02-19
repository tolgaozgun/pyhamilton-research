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

// Deck layout types

export interface LabwareItem {
  type: 'tip_rack' | 'plate' | 'reservoir'
  subtype: string
  name: string
  contents?: string
}

export interface CarrierPlacement {
  carrier_type: string
  start_rail: number
  slots: (LabwareItem | null)[]
}

export interface AspirationSettingsData {
  volume_ul: number
  flow_rate_ul_per_s: number
  mix_cycles: number
  mix_volume_ul: number
  liquid_class: string
  tip_type: string
  pre_wet: boolean
  touch_off: boolean
}

export interface DeckConfig {
  carriers: CarrierPlacement[]
  aspiration_settings: AspirationSettingsData
  total_rails: number
}

export const CARRIER_CATALOG: Record<
  string,
  {
    name: string
    width_rails: number
    slots: number
    accepts: string[]
    color: string
    description: string
  }
> = {
  TIP_CAR_480_A00: {
    name: 'Tip Carrier (5)',
    width_rails: 6,
    slots: 5,
    accepts: ['tip_rack'],
    color: 'blue',
    description: '5x 96-tip racks',
  },
  TIP_CAR_288_C00: {
    name: 'Tip Carrier (3)',
    width_rails: 4,
    slots: 3,
    accepts: ['tip_rack'],
    color: 'blue',
    description: '3x 96-tip racks',
  },
  PLT_CAR_L5AC_A00: {
    name: 'Plate Carrier (5)',
    width_rails: 6,
    slots: 5,
    accepts: ['plate'],
    color: 'purple',
    description: '5 ANSI/SLAS plates',
  },
  PLT_CAR_P3AC: {
    name: 'Plate Carrier (3P)',
    width_rails: 6,
    slots: 3,
    accepts: ['plate'],
    color: 'purple',
    description: '3 plates (portrait)',
  },
  RGT_CAR_3R_A00: {
    name: 'Reagent Carrier',
    width_rails: 6,
    slots: 3,
    accepts: ['reservoir'],
    color: 'amber',
    description: '3 reagent troughs',
  },
}

export const TIP_CATALOG: Record<string, string> = {
  '10uL': '10µL Tips (96)',
  '50uL': '50µL Tips (96)',
  '300uL': '300µL Tips (96)',
  '1000uL': '1000µL Tips (96)',
  '5mL': '5mL Tips (24)',
}

export const PLATE_CATALOG: Record<string, string> = {
  '96_well': '96-Well Plate',
  '96_deep_well': '96 Deep Well',
  '384_well': '384-Well Plate',
  pcr_plate: 'PCR Plate',
}

export const RESERVOIR_CATALOG: Record<string, string> = {
  trough_300ml: '300mL Trough',
}

export const DEFAULT_ASPIRATION: AspirationSettingsData = {
  volume_ul: 100,
  flow_rate_ul_per_s: 100,
  mix_cycles: 0,
  mix_volume_ul: 0,
  liquid_class: 'Water',
  tip_type: '300uL',
  pre_wet: false,
  touch_off: true,
}
