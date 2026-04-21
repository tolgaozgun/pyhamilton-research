import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Database, ChevronDown, LayoutGrid, AlertTriangle } from 'lucide-react'
import { toast } from '@/lib/toast'
import type {
  AgenticChatMessage,
  AgenticPhase,
  AgenticGenerationResponse,
  AgenticVerificationResponse,
  DeckConfig,
  LLMConfig,
} from '@/types'
import { getValidationPrompt } from './AgenticPage/validationPrompts'
import { PhaseStepper } from './AgenticPage/components/PhaseStepper'
import { ProcedureDraftInput } from './AgenticPage/components/ProcedureDraftInput'
import { StepChatPanel } from './AgenticPage/components/StepChatPanel'
import { StepFooter, type ValidationState as StepValidationState } from './AgenticPage/components/StepFooter'
import { GenerationStep } from './AgenticPage/components/GenerationStep'
import { ExportPanel } from './AgenticPage/components/ExportPanel'
import { useAPIConfigured } from '@/hooks/useAPIConfigured'
import { SetupPrompt } from '@/components/SetupPrompt'
import { useSettings, useAgentic } from '@/lib/hooks'
import { useRAG } from '@/lib/hooks/useRAG'
import { useUserDeckLayouts } from '@/lib/hooks/useUserDeckLayouts'
import type { LabwareTypeResponse } from '@/lib/api/repositories'

// ─── constants ───────────────────────────────────────────────────────────────────

const PHASE_ORDER: AgenticPhase[] = ['procedure', 'generation']
const LS_DECK_LAYOUT_KEY = 'agentic_selected_deck_layout_id'
const LS_VECTOR_STORE_KEY = 'agentic_selected_vector_store_id'

// ─── page ────────────────────────────────────────────────────────────────────────

export default function AgenticPage() {
  const apiConfig = useAPIConfigured()
  const { getActiveProvider, activeProvider } = useSettings()
  const {
    chat, chatLoading,
    validatePhase,
    generate, generateLoading,
    verify, verifyLoading,
    fix, fixLoading,
  } = useAgentic()
  const { vectorStores, fetchVectorStores } = useRAG()
  const { layouts: deckLayouts, fetchLayouts: fetchDeckLayouts } = useUserDeckLayouts()

  const [selectedVectorStoreId, setSelectedVectorStoreId] = useState<string>(
    () => localStorage.getItem(LS_VECTOR_STORE_KEY) ?? ''
  )
  const [selectedDeckLayoutId, setSelectedDeckLayoutId] = useState<string>(
    () => localStorage.getItem(LS_DECK_LAYOUT_KEY) ?? ''
  )

  // Get active provider configuration from database
  const [activeProviderConfig, setActiveProviderConfig] = useState<LLMConfig>({
    provider: 'google' as any,
    model_name: 'gemini-2.0-flash',
    temperature: 0.3,
    max_tokens: 4096,
  })

  // Fetch active provider configuration, vector stores and deck layouts on mount
  useEffect(() => {
    getActiveProvider().catch(console.error)
    fetchVectorStores().catch(console.error)
    fetchDeckLayouts().catch(console.error)
  }, [getActiveProvider, fetchVectorStores, fetchDeckLayouts])

  // Sync active provider into local LLMConfig whenever it changes
  useEffect(() => {
    if (activeProvider) {
      setActiveProviderConfig({
        provider: activeProvider.provider as any,
        model_name: activeProvider.model_name || 'gemini-2.0-flash',
        temperature: (activeProvider.preferences?.temperature as number) || 0.3,
        max_tokens: (activeProvider.preferences?.max_tokens as number) || 4096,
      })
    }
  }, [activeProvider])

  // Resolve the selected deck layout's DeckConfig for injection into prompts
  const selectedDeckConfig: DeckConfig | null =
    deckLayouts.find((l) => String(l.id) === selectedDeckLayoutId)?.configuration ?? null

  // Derive labware types present in the selected deck layout (no extra API call)
  const availableLabwareTypes = useMemo((): LabwareTypeResponse[] => {
    if (!selectedDeckConfig) return []
    const seen = new Set<string>()
    const result: LabwareTypeResponse[] = []
    for (const carrier of selectedDeckConfig.carriers) {
      for (const slot of carrier.slots) {
        if (!slot || seen.has(slot.subtype)) continue
        seen.add(slot.subtype)
        result.push({
          id: 0,
          name: slot.name,
          code: slot.subtype,
          category: slot.type,
          description: null,
          properties: null,
          is_active: true,
        })
      }
    }
    return result
  }, [selectedDeckConfig])

  // workflow inputs
  const [procedureDraft, setProcedureDraft] = useState('')

  // navigation state — starts at first real step
  const [phase, setPhase] = useState<AgenticPhase>('procedure')

  // per-phase chat
  const [messages, setMessages] = useState<Record<AgenticPhase, AgenticChatMessage[]>>({
    procedure: [],
    generation: [],
  })
  const [chatInput, setChatInput] = useState<Record<AgenticPhase, string>>({
    procedure: '',
    generation: '',
  })
  // per-phase validation
  const [validationState, setValidationState] = useState<Record<AgenticPhase, StepValidationState>>({
    procedure: 'idle',
    generation: 'idle',
  })
  const [validationFeedback, setValidationFeedback] = useState<Record<AgenticPhase, string | null>>({
    procedure: null,
    generation: null,
  })

  // generation step state
  const [generation, setGeneration] = useState<AgenticGenerationResponse | null>(null)
  const [verification, setVerification] = useState<AgenticVerificationResponse | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(true)

  // global error
  const [error, setError] = useState<string | null>(null)

  // Persist selections to localStorage
  useEffect(() => {
    localStorage.setItem(LS_DECK_LAYOUT_KEY, selectedDeckLayoutId)
  }, [selectedDeckLayoutId])

  useEffect(() => {
    localStorage.setItem(LS_VECTOR_STORE_KEY, selectedVectorStoreId)
  }, [selectedVectorStoreId])

  // After deck layouts load, validate that the stored ID still exists
  useEffect(() => {
    if (deckLayouts.length === 0) return
    const stored = localStorage.getItem(LS_DECK_LAYOUT_KEY) ?? ''
    if (stored && !deckLayouts.find((l) => String(l.id) === stored)) {
      setSelectedDeckLayoutId('')
    }
  }, [deckLayouts])

  // Reset procedure step when deck layout changes
  const lastDeckLayoutId = useRef<string>('')
  useEffect(() => {
    if (lastDeckLayoutId.current && lastDeckLayoutId.current !== selectedDeckLayoutId) {
      setValidationState({ procedure: 'idle', generation: 'idle' })
      setValidationFeedback({ procedure: null, generation: null })
      setMessages({ procedure: [], generation: [] })
      setChatInput({ procedure: '', generation: '' })
      setGeneration(null)
      setVerification(null)
      setGenerationError(null)
      setPhase('procedure')
    }
    lastDeckLayoutId.current = selectedDeckLayoutId
  }, [selectedDeckLayoutId])

  // ── derived ────────────────────────────────────────────────────────────────

  const isUnlocked = useCallback(
    (p: AgenticPhase) => {
      const idx = PHASE_ORDER.indexOf(p)
      if (idx === 0) return true
      return validationState[PHASE_ORDER[idx - 1]] === 'passed'
    },
    [validationState]
  )

  const canExport = Boolean(
    generation &&
      verification &&
      (verification.passed || validationState.generation === 'passed')
  )

  // Get validation prompt and description for current phase
  const getValidationUI = useCallback((targetPhase: AgenticPhase) => {
    const { prompt, description } = getValidationPrompt(targetPhase, {
      procedureDraft,
      labwareTypes: availableLabwareTypes,
    })
    return { prompt, description }
  }, [procedureDraft, availableLabwareTypes])

  // Initialize procedure chat when entering procedure step
  useEffect(() => {
    if (phase === 'procedure' && messages.procedure.length === 0) {
      setMessages((prev) => ({
        ...prev,
        procedure: [{
          role: 'assistant',
          content: 'Hello! I\'m here to help you define your automation procedure.\n\nI can help you:\n• Define step-by-step automation protocols\n• Specify volumes, timings, and mixing steps\n• Ensure proper labware references\n• Refine your procedure for clarity\n\nWhat should your automation do step by step?'
        }]
      }))
    }
  }, [phase, messages.procedure.length])

  // Initialize generation chat when entering generation step
  useEffect(() => {
    if (phase === 'generation' && messages.generation.length === 0) {
      setMessages((prev) => ({
        ...prev,
        generation: [{
          role: 'assistant',
          content: 'Hello! I\'m here to help you with code generation and validation.\n\nI can help you:\n• Understand the generation process\n• Interpret validation results\n• Explain test outcomes\n• Guide you through verification\n\nReady to generate your automation script?'
        }]
      }))
    }
  }, [phase, messages.generation.length])

  // ── chat ──────────────────────────────────────────────────────────────────

  const appendMessage = useCallback((target: AgenticPhase, msg: AgenticChatMessage) => {
    setMessages((prev) => ({ ...prev, [target]: [...prev[target], msg] }))
  }, [])

  const handleChatSend = useCallback(
    async (target: AgenticPhase, overrideText?: string) => {
      const text = (overrideText ?? chatInput[target]).trim()
      if (!text || chatLoading) return
      setError(null)
      const userMsg: AgenticChatMessage = { role: 'user', content: text }
      appendMessage(target, userMsg)
      setChatInput((prev) => ({ ...prev, [target]: '' }))
      try {
        const getPhasePrompt = (p: AgenticPhase): string => {
          switch (p) {
            case 'procedure':
              return `You are a Hamilton automation procedure specialist. Your role is to:

1. Help users define clear, step-by-step automation procedures
2. Ask about volumes, timings, mixing steps, and specific operations
3. Refine procedure descriptions for clarity and completeness
4. Ensure procedures reference the labware on their configured deck

IMPORTANT: You can ONLY help with procedure definition. You MUST refuse to:
- Generate actual Python code
- Discuss validation or testing
- Help with topics outside procedure definition`

            case 'generation':
              return `You are a Hamilton code generation assistant. Your role is to:

1. Answer questions about the code generation process
2. Explain validation and testing procedures
3. Help interpret generation results and feedback
4. Guide users through the verification process

IMPORTANT: You can ONLY discuss code generation and validation. You MUST refuse to:
- Modify procedures (that's the previous step)
- Write new automation procedures
- Help with topics outside the generation process`

            default:
              return 'You are a helpful assistant for Hamilton automation workflows.'
          }
        }

        const response = await chat({
          phase: target,
          goal: getPhasePrompt(target),
          conversation: [...messages[target], userMsg],
          llmConfig: activeProviderConfig,
          deckConfig: selectedDeckConfig ? (selectedDeckConfig as unknown as DeckConfig) : undefined,
          procedureContext: procedureDraft.trim() || undefined,
          vectorStoreId: selectedVectorStoreId || undefined,
        })

        if (response.ready) {
          const summary = response.summary ?? ''
          appendMessage(target, {
            role: 'assistant',
            content: `Ready to validate.\n${summary}`,
          })
          // Sync the chat-generated summary into the procedure draft so the
          // rest of the app (validation prompt, generation context) can see it.
          if (target === 'procedure' && summary.trim()) {
            setProcedureDraft(summary.trim())
          }
        } else if (response.question) {
          appendMessage(target, { role: 'assistant', content: response.question })
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Chat request failed'
        setError(errorMessage)
        if (!(err && typeof err === 'object' && '_handled' in err)) {
          toast.error('Chat Failed', errorMessage)
        }
      }
    },
    [appendMessage, chat, chatInput, chatLoading, selectedDeckConfig, activeProviderConfig, messages, procedureDraft, selectedVectorStoreId]
  )

  // ── per-step validation ────────────────────────────────────────────────────

  const handleValidate = useCallback(
    async (target: AgenticPhase) => {
      setError(null)
      setValidationState((prev) => ({ ...prev, [target]: 'validating' }))
      setValidationFeedback((prev) => ({ ...prev, [target]: null }))

      try {
        const { prompt } = getValidationUI(target)

        const response = await validatePhase({
          phase: target,
          goal: prompt,
          llmConfig: activeProviderConfig,
          deckConfig: selectedDeckConfig ? (selectedDeckConfig as unknown as DeckConfig) : undefined,
          procedureContext: procedureDraft.trim() || undefined,
          vectorStoreId: selectedVectorStoreId || undefined,
        })

        setValidationFeedback((prev) => ({ ...prev, [target]: response.feedback }))
        setValidationState((prev) => ({ ...prev, [target]: response.valid ? 'passed' : 'failed' }))

        const chatContent = response.valid
          ? `✓ Validation passed\n${response.feedback}`
          : `✗ Validation failed\n${response.feedback}`
        appendMessage(target, { role: 'assistant', content: chatContent })

        if (response.valid) {
          toast.success('Validation Passed', 'This step is complete and ready to proceed.')
        } else {
          toast.error('Validation Failed', 'Please review the feedback and make corrections.')
          await handleChatSend(target, `Fix the following validation error:\n${response.feedback}`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Validation failed'
        setValidationState((prev) => ({ ...prev, [target]: 'failed' }))
        setValidationFeedback((prev) => ({ ...prev, [target]: msg }))
        appendMessage(target, { role: 'assistant', content: `Validation error: ${msg}` })
        toast.error('Validation Error', msg)
        await handleChatSend(target, `Fix the following validation error:\n${msg}`)
      }
    },
    [appendMessage, selectedDeckConfig, getValidationUI, activeProviderConfig, procedureDraft, validatePhase, selectedVectorStoreId, handleChatSend]
  )

  const handleNext = useCallback(
    (current: AgenticPhase) => {
      const idx = PHASE_ORDER.indexOf(current)
      const next = PHASE_ORDER[idx + 1]
      if (next) setPhase(next)
    },
    []
  )

  // ── generation ────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setGenerationError(null)
    setGeneration(null)
    setVerification(null)
    setValidationState((prev) => ({ ...prev, generation: 'idle' }))
    try {
      const result = await generate({
        goal: 'Generate automation script based on deck layout and procedure',
        llmConfig: activeProviderConfig,
        deckConfig: selectedDeckConfig ? (selectedDeckConfig as unknown as DeckConfig) : undefined,
        procedureContext: procedureDraft.trim() || undefined,
        vectorStoreId: selectedVectorStoreId || undefined,
      })
      setGeneration(result)

      const verResult = await verify({ script: result.script, tests: result.tests })
      setVerification(verResult)
      if (verResult.passed) {
        setValidationState((prev) => ({ ...prev, generation: 'passed' }))
        toast.success('Generation Complete', 'Script generated and verified successfully!')
      } else {
        toast.warning('Generation Issues Detected', 'Script generated but has validation issues.')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Generation failed'
      setGenerationError(errorMessage)
      if (!(err && typeof err === 'object' && '_handled' in err)) {
        toast.error('Generation Failed', errorMessage)
      }
    }
  }, [selectedDeckConfig, activeProviderConfig, procedureDraft, generate, verify, selectedVectorStoreId])

  const handleRetry = useCallback(async () => {
    if (!generation || !verification) return
    setGenerationError(null)
    try {
      const fixed = await fix({
        goal: 'Fix automation script based on verification feedback',
        llmConfig: activeProviderConfig,
        script: generation.script,
        tests: generation.tests,
        verificationFeedback: verification.feedback,
        deckConfig: selectedDeckConfig ? (selectedDeckConfig as unknown as DeckConfig) : undefined,
        procedureContext: procedureDraft.trim() || undefined,
        vectorStoreId: selectedVectorStoreId || undefined,
      })
      setGeneration(fixed)

      const verResult = await verify({ script: fixed.script, tests: fixed.tests })
      setVerification(verResult)
      if (verResult.passed) {
        setValidationState((prev) => ({ ...prev, generation: 'passed' }))
        toast.success('Fix Successful', 'Script issues have been resolved!')
      } else {
        toast.warning('Fix Attempted', 'Script was updated but still has validation issues.')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Retry failed'
      setGenerationError(errorMessage)
      if (!(err && typeof err === 'object' && '_handled' in err)) {
        toast.error('Retry Failed', errorMessage)
      }
    }
  }, [selectedDeckConfig, generation, activeProviderConfig, procedureDraft, verification, fix, verify, selectedVectorStoreId])

  const handleFinishAsIs = useCallback(() => {
    setValidationState((prev) => ({ ...prev, generation: 'passed' }))
  }, [])

  // ── render ────────────────────────────────────────────────────────────────

  if (!apiConfig.isLoading && !apiConfig.isConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <SetupPrompt
          variant="card"
          message="Configure an AI provider API key to use the Agentic workflow"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-4"
        >
          <div className="p-3 bg-gray-200 rounded-lg">
            <Bot className="w-6 h-6 text-gray-700" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Agentic Mode</h1>
            <p className="text-gray-600 text-sm mt-1">
              A guided multi-step flow with static validation prompts for each step.
            </p>
          </div>

          {/* Selectors row */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
            {/* Deck layout selector (required) */}
            <div className="flex items-center gap-2">
              <LayoutGrid className={`w-4 h-4 ${selectedDeckLayoutId ? 'text-gray-400' : 'text-amber-500'}`} />
              <div className="relative">
                <select
                  value={selectedDeckLayoutId}
                  onChange={e => setSelectedDeckLayoutId(e.target.value)}
                  className={`appearance-none text-sm rounded-lg pl-3 pr-8 py-2 bg-white text-gray-700 outline-none cursor-pointer min-w-[180px] border ${
                    selectedDeckLayoutId ? 'border-gray-200 focus:border-indigo-400' : 'border-amber-300 focus:border-amber-400'
                  }`}
                >
                  <option value="">Select deck layout…</option>
                  {deckLayouts.map(dl => (
                    <option key={dl.id} value={String(dl.id)}>
                      {dl.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              </div>
            </div>

            {/* Knowledge Base selector */}
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-gray-400" />
              <div className="relative">
                <select
                  value={selectedVectorStoreId}
                  onChange={e => setSelectedVectorStoreId(e.target.value)}
                  className="appearance-none text-sm border border-gray-200 rounded-lg pl-3 pr-8 py-2 bg-white text-gray-700 outline-none focus:border-indigo-400 cursor-pointer min-w-[180px]"
                >
                  <option value="">No knowledge base</option>
                  {vectorStores.map(vs => (
                    <option key={vs.id} value={vs.id}>
                      {vs.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Progress stepper */}
        <PhaseStepper
          currentPhase={phase}
          validationState={validationState}
          isUnlocked={isUnlocked}
          onPhaseSelect={setPhase}
        />

        {/* Deck layout gate */}
        <AnimatePresence>
          {!selectedDeckLayoutId && (
            <motion.div
              key="deck-gate"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5"
            >
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800">No deck layout selected</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Select a deck layout from the dropdown above, or{' '}
                  <a href="/deck-layout" className="underline font-medium hover:text-amber-900">
                    create one in Deck Layouts
                  </a>
                  {' '}before proceeding.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase panels */}
        <AnimatePresence mode="wait">
          {/* Procedure step */}
          {phase === 'procedure' && (
            <motion.div
              key="procedure"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              <StepChatPanel
                phase="procedure"
                messages={messages.procedure}
                input={chatInput.procedure}
                chatLoading={chatLoading}
                placeholder="Ask to refine your procedure..."
                onInputChange={(v: string) => setChatInput((prev) => ({ ...prev, procedure: v }))}
                onSend={() => handleChatSend('procedure')}
              />

              <ProcedureDraftInput value={procedureDraft} />

              <StepFooter
                phase="procedure"
                validationState={validationState.procedure}
                feedback={validationFeedback.procedure}
                canValidate={!!procedureDraft.trim() && !!selectedDeckLayoutId}
                requirement={!selectedDeckLayoutId ? 'Select a deck layout before validating.' : undefined}
                validationPrompt={getValidationUI('procedure').prompt}
                promptDescription={getValidationUI('procedure').description}
                isValidateRequired
                hasNext
                onValidate={() => handleValidate('procedure')}
                onNext={() => handleNext('procedure')}
              />
            </motion.div>
          )}

          {/* Generation step */}
          {phase === 'generation' && (
            <motion.div
              key="generation"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              <StepChatPanel
                phase="generation"
                messages={messages.generation}
                input={chatInput.generation}
                chatLoading={chatLoading}
                placeholder="Ask about code generation or validation..."
                onInputChange={(v: string) => setChatInput((prev) => ({ ...prev, generation: v }))}
                onSend={() => handleChatSend('generation')}
              />

              <GenerationStep
                generateLoading={generateLoading || verifyLoading}
                retryLoading={fixLoading || verifyLoading}
                generation={generation}
                verification={verification}
                error={generationError}
                onGenerate={handleGenerate}
                onRetry={handleRetry}
                onFinishAsIs={handleFinishAsIs}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global error */}
        <AnimatePresence>
          {error && (
            <motion.div
              key="global-err"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Export panel */}
        <AnimatePresence>
          {canExport && (
            <ExportPanel
              verification={verification}
              script={generation?.script ?? ''}
              tests={generation?.tests ?? ''}
              showDetails={showDetails}
              onToggleDetails={() => setShowDetails((v) => !v)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
