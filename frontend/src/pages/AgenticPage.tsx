import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, Database, ChevronDown } from 'lucide-react'
import { toast } from '@/lib/toast'
import type {
  AgenticChatMessage,
  AgenticPhase,
  AgenticGenerationResponse,
  AgenticVerificationResponse,
  DeckConfig,
  LLMConfig,
} from '@/types'
import { HamiltonDeckBuilder } from '@/components/deck/HamiltonDeckBuilder'
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
import { apiRepository, type CarrierTypeResponse, type LabwareTypeResponse } from '@/lib/api/repositories'

// ─── constants ───────────────────────────────────────────────────────────────────

const PHASE_ORDER: AgenticPhase[] = ['deck_layout', 'procedure', 'generation']

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

  const [selectedVectorStoreId, setSelectedVectorStoreId] = useState<string>('')
  const [availableCarriers, setAvailableCarriers] = useState<CarrierTypeResponse[]>([])
  const [availableLabwareTypes, setAvailableLabwareTypes] = useState<LabwareTypeResponse[]>([])

  // Get active provider configuration from database
  const [activeProviderConfig, setActiveProviderConfig] = useState<LLMConfig>({
    provider: 'google' as any,
    model_name: 'gemini-2.0-flash',
    temperature: 0.3,
    max_tokens: 4096,
  })

  // Fetch active provider configuration, vector stores, and labware on mount
  useEffect(() => {
    getActiveProvider().catch(console.error)
    fetchVectorStores().catch(console.error)
    apiRepository.labware.getCarriers().then(setAvailableCarriers).catch(console.error)
    apiRepository.labware.getLabwareTypes().then(setAvailableLabwareTypes).catch(console.error)
  }, [getActiveProvider, fetchVectorStores])

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

  // workflow inputs
  const [procedureDraft, setProcedureDraft] = useState('')
  const [deckConfig, setDeckConfig] = useState<DeckConfig | null>(null)

  // navigation state
  const [phase, setPhase] = useState<AgenticPhase>('deck_layout')

  // per-phase chat with specific initial messages for each step
  const [messages, setMessages] = useState<Record<AgenticPhase, AgenticChatMessage[]>>({
    deck_layout: [{ role: 'assistant', content: 'Hello! I\'m here to help you configure your Hamilton deck layout.\n\nTo get started, please tell me about:\n• What type of assay or workflow are you planning?\n• What labware do you need (tip racks, plates, reservoirs)?\n• Any specific carrier requirements?\n\nI can help you design the deck layout, but I won\'t generate procedures or code - that\'s for the next steps.' }],
    procedure: [],
    generation: [],
  })
  const [chatInput, setChatInput] = useState<Record<AgenticPhase, string>>({
    deck_layout: '',
    procedure: '',
    generation: '',
  })
  // per-phase validation
  const [validationState, setValidationState] = useState<Record<AgenticPhase, StepValidationState>>({
    deck_layout: 'idle',
    procedure: 'idle',
    generation: 'idle',
  })
  const [validationFeedback, setValidationFeedback] = useState<Record<AgenticPhase, string | null>>({
    deck_layout: null,
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

  // deck change tracking
  const lastDeckSignature = useRef<string | null>(null)

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
      deckConfig,
      procedureDraft,
      carriers: availableCarriers,
      labwareTypes: availableLabwareTypes,
    })
    return { prompt, description }
  }, [deckConfig, procedureDraft, availableCarriers, availableLabwareTypes])

  // ── deck change guard ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!deckConfig) return
    const sig = JSON.stringify(deckConfig)
    if (lastDeckSignature.current && lastDeckSignature.current !== sig) {
      setValidationState({ deck_layout: 'idle', procedure: 'idle', generation: 'idle' })
      setValidationFeedback({ deck_layout: null, procedure: null, generation: null })
      setMessages((prev) => ({ ...prev, deck_layout: [{ role: 'assistant', content: 'Hello! I\'m here to help you configure your Hamilton deck layout.\n\nTo get started, please tell me about:\n• What type of assay or workflow are you planning?\n• What labware do you need (tip racks, plates, reservoirs)?\n• Any specific carrier requirements?\n\nI can help you design the deck layout, but I won\'t generate procedures or code - that\'s for the next steps.' }], procedure: [], generation: [] }))
      setChatInput((prev) => ({ ...prev, deck_layout: '', procedure: '', generation: '' }))
      setGeneration(null)
      setVerification(null)
      setGenerationError(null)
      setPhase('deck_layout')
    }
    lastDeckSignature.current = sig
  }, [deckConfig])

  // Initialize procedure chat when entering procedure step
  useEffect(() => {
    if (phase === 'procedure' && messages.procedure.length === 0) {
      setMessages((prev) => ({
        ...prev,
        procedure: [{
          role: 'assistant',
          content: 'Hello! I\'m here to help you define your automation procedure.\n\nBased on your deck layout, I can help you:\n• Define step-by-step automation protocols\n• Specify volumes, timings, and mixing steps\n• Ensure proper labware references\n• Refine your procedure for clarity\n\nI can only help with procedure definition. I won\'t modify your deck layout or generate code - those are separate steps.\n\nWhat should your automation do step by step?'
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
          content: 'Hello! I\'m here to help you with code generation and validation.\n\nI can help you:\n• Understand the generation process\n• Interpret validation results\n• Explain test outcomes\n• Guide you through verification\n\nI can only discuss code generation and validation. I won\'t modify your deck layout or procedure - those are completed in previous steps.\n\nReady to generate your automation script?'
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
        // Create phase-specific system prompts
        const getPhasePrompt = (phase: AgenticPhase): string => {
          switch (phase) {
            case 'deck_layout':
              return `You are a Hamilton deck layout specialist. Your role is to:

1. Ask users about their assay workflow and labware requirements
2. Help design deck layouts with appropriate carriers and labware
3. Answer questions about Hamilton deck configuration
4. Suggest optimal carrier placement and labware selection

CRITICAL - MULTIPLE CARRIERS:
A Hamilton STAR deck holds MULTIPLE carriers simultaneously. Almost every real protocol requires at least 2–3 carriers. Always recommend the full set of carriers the user needs:
- Tips always go on a dedicated tip carrier
- Plates always go on a dedicated plate carrier
- Reservoirs always go on a dedicated reagent carrier
Never try to fit everything onto a single carrier. The deck has 55 rails; carriers are typically 4–6 rails wide, so there is plenty of room.

CRITICAL - CARRIER COMPATIBILITY RULES (strictly enforce these):
Each carrier type only accepts specific labware. Never mix incompatible labware into a carrier:

- TIP_CAR_480_A00 (Tip Carrier, 5 slots): accepts ONLY tip racks. NO plates, NO reservoirs.
- TIP_CAR_288_C00 (Tip Carrier, 3 slots): accepts ONLY tip racks. NO plates, NO reservoirs.
- PLT_CAR_L5AC_A00 (Plate Carrier, 5 slots): accepts ONLY plates and deep-well plates. NO tips, NO reservoirs.
- PLT_CAR_P3AC (Plate Carrier, 3 slots portrait): accepts ONLY plates. NO tips, NO reservoirs.
- RGT_CAR_3R_A00 (Reagent Carrier, 3 slots): accepts ONLY reservoirs/reagent troughs. NO tips, NO plates.

Example of a CORRECT deck for a typical transfer protocol:
- Carrier 1 (rails 1–6):  TIP_CAR_480_A00 → tip racks only
- Carrier 2 (rails 7–12): PLT_CAR_L5AC_A00 → source plate, destination plate
- Carrier 3 (rails 13–18): RGT_CAR_3R_A00 → reagent reservoir

Always suggest separate carriers for each labware category the user needs.

IMPORTANT: You can ONLY help with deck layout configuration. You MUST refuse to:
- Generate automation procedures or scripts
- Provide programming code
- Discuss validation or testing
- Help with topics outside deck configuration

If the user asks for anything outside deck layout, politely redirect them to focus on deck configuration first.`

            case 'procedure':
              return `You are a Hamilton automation procedure specialist. Your role is to:

1. Help users define clear, step-by-step automation procedures
2. Ask about volumes, timings, mixing steps, and specific operations
3. Refine procedure descriptions for clarity and completeness
4. Ensure procedures reference the labware on their configured deck

IMPORTANT: You can ONLY help with procedure definition. You MUST refuse to:
- Modify deck layouts (that's the previous step)
- Generate actual Python code
- Discuss validation or testing
- Help with topics outside procedure definition

If the user asks for anything outside procedure definition, politely redirect them.`

            case 'generation':
              return `You are a Hamilton code generation assistant. Your role is to:

1. Answer questions about the code generation process
2. Explain validation and testing procedures
3. Help interpret generation results and feedback
4. Guide users through the verification process

IMPORTANT: You can ONLY discuss code generation and validation. You MUST refuse to:
- Modify deck layouts or procedures (those are previous steps)
- Write new automation procedures
- Help with topics outside the generation process

If the user asks for anything outside code generation, politely redirect them.`

            default:
              return 'You are a helpful assistant for Hamilton automation workflows.'
          }
        }

        console.log('🔧 DEBUG - Sending request with config:', {
          provider: activeProviderConfig.provider,
          model_name: activeProviderConfig.model_name,
          temperature: activeProviderConfig.temperature,
          max_tokens: activeProviderConfig.max_tokens,
        })

        console.log('📡 DEBUG - Full request payload:', {
          phase: target,
          goal: getPhasePrompt(target),
          conversation: [...messages[target], userMsg],
          llmConfig: activeProviderConfig,
          deckConfig: deckConfig,
          procedureContext: procedureDraft.trim() || undefined,
        })

        const response = await chat({
          phase: target,
          goal: getPhasePrompt(target),
          conversation: [...messages[target], userMsg],
          llmConfig: activeProviderConfig,
          deckConfig: deckConfig ? (deckConfig as unknown as DeckConfig) : undefined,
          procedureContext: procedureDraft.trim() || undefined,
          vectorStoreId: selectedVectorStoreId || undefined,
        })

        console.log('✅ DEBUG - Raw API response received:', response)
        console.log('📊 DEBUG - Response structure:', {
          ready: response.ready,
          hasQuestion: !!response.question,
          hasSummary: !!response.summary,
          summary: response.summary,
          question: response.question,
          fullResponse: JSON.stringify(response, null, 2)
        })

        if (response.ready) {
          console.log('🎯 DEBUG - Response is READY, updating state')
          console.log('📋 DEBUG - Summary content:', response.summary)

          appendMessage(target, {
            role: 'assistant',
            content: `Ready to validate.\n${response.summary ?? ''}`,
          })

          console.log('✅ DEBUG - Message appended, checking if phase-specific handling needed')
          console.log('🔍 DEBUG - Current target phase:', target)

          // If deck_layout phase and user hasn't configured a deck yet, seed a valid default
          if (target === 'deck_layout' && !deckConfig) {
            const defaultDeckConfig: DeckConfig = {
              carriers: [
                {
                  carrier_type: 'TIP_CAR_480_A00',
                  start_rail: 1,
                  slots: [
                    { name: 'Tips 300µL #1', type: 'tip_rack', subtype: 'tips_300ul', contents: undefined },
                    { name: 'Tips 300µL #2', type: 'tip_rack', subtype: 'tips_300ul', contents: undefined },
                    null, null, null,
                  ],
                },
                {
                  carrier_type: 'PLT_CAR_L5AC_A00',
                  start_rail: 7,
                  slots: [
                    { name: 'Source Plate', type: 'plate', subtype: 'plate_96', contents: undefined },
                    { name: 'Destination Plate', type: 'plate', subtype: 'plate_96', contents: undefined },
                    null, null, null,
                  ],
                },
                {
                  carrier_type: 'RGT_CAR_3R_A00',
                  start_rail: 13,
                  slots: [
                    { name: 'Reagent Reservoir', type: 'reservoir', subtype: 'reservoir', contents: undefined },
                    null, null,
                  ],
                },
              ],
              aspiration_settings: {
                volume_ul: 100,
                flow_rate_ul_per_s: 100,
                mix_cycles: 0,
                mix_volume_ul: 0,
                liquid_class: 'Water',
                tip_type: '300uL',
                pre_wet: false,
                touch_off: true,
              },
              total_rails: 55,
            }
            setDeckConfig(defaultDeckConfig)
          }

        } else if (response.question) {
          console.log('❓ DEBUG - Response has QUESTION, not ready yet')
          console.log('📝 DEBUG - Question content:', response.question)

          appendMessage(target, { role: 'assistant', content: response.question })
        } else {
          console.log('⚠️ DEBUG - Response has neither ready nor question - unexpected state')
          console.log('📄 DEBUG - Full response:', response)
        }

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Chat request failed'
        setError(errorMessage)

        // Only show toast if error wasn't already handled by axios interceptor
        if (err && typeof err === 'object' && '_handled' in err) {
          // Error was already handled by axios interceptor, don't show duplicate toast
        } else {
          toast.error('Chat Failed', errorMessage)
        }
      }
    },
    [appendMessage, chat, chatInput, chatLoading, deckConfig, activeProviderConfig, messages, procedureDraft, selectedVectorStoreId]
  )

  // ── per-step validation ────────────────────────────────────────────────────

  const handleValidate = useCallback(
    async (target: AgenticPhase) => {
      console.group(`🔍 VALIDATION STARTED - Phase: ${target}`)
      console.log('Timestamp:', new Date().toISOString())

      setError(null)
      setValidationState((prev) => ({ ...prev, [target]: 'validating' }))
      setValidationFeedback((prev) => ({ ...prev, [target]: null }))

      try {
        // Get the static validation prompt for this phase
        const { prompt } = getValidationUI(target)
        console.log('📋 Validation prompt length:', prompt.length)

        console.log('⏳ Sending API request to /api/agentic/validate...')
        const startTime = Date.now()

        // Send validation request with the static prompt as the goal using new API client
        const response = await validatePhase({
          phase: target,
          goal: prompt,
          llmConfig: activeProviderConfig,
          deckConfig: deckConfig ? (deckConfig as unknown as DeckConfig) : undefined,
          procedureContext: procedureDraft.trim() || undefined,
          vectorStoreId: selectedVectorStoreId || undefined,
        })

        const endTime = Date.now()
        console.log(`⏱️ API request completed in ${endTime - startTime}ms`)

        setValidationFeedback((prev) => ({ ...prev, [target]: response.feedback }))
        setValidationState((prev) => ({ ...prev, [target]: response.valid ? 'passed' : 'failed' }))

        // Add validation result to chat
        const chatContent = response.valid
          ? `✓ Validation passed\n${response.feedback}`
          : `✗ Validation failed\n${response.feedback}`

        console.log('💬 Chat message:', {
          length: chatContent.length,
          preview: chatContent.substring(0, 200),
        })

        appendMessage(target, {
          role: 'assistant',
          content: chatContent,
        })

        // Show toast notification for validation result
        if (response.valid) {
          toast.success('Validation Passed', 'This step is complete and ready to proceed.')
        } else {
          toast.error('Validation Failed', 'Please review the feedback and make corrections.')
          await handleChatSend(target, `Fix the following validation error:\n${response.feedback}`)
        }

        console.log(`✅ VALIDATION COMPLETED - Result: ${response.valid ? 'PASSED' : 'FAILED'}`)
        console.groupEnd()
      } catch (err) {
        console.error('❌ VALIDATION ERROR')
        console.error('Error object:', err)
        console.error('Error name:', err instanceof Error ? err.name : 'unknown')
        console.error('Error message:', err instanceof Error ? err.message : String(err))

        const msg = err instanceof Error ? err.message : 'Validation failed'
        setValidationState((prev) => ({ ...prev, [target]: 'failed' }))
        setValidationFeedback((prev) => ({ ...prev, [target]: msg }))

        appendMessage(target, {
          role: 'assistant',
          content: `Validation error: ${msg}`,
        })

        toast.error('Validation Error', msg)
        await handleChatSend(target, `Fix the following validation error:\n${msg}`)

        console.log('🔴 Validation marked as FAILED due to error')
        console.groupEnd()
      }
    },
    [appendMessage, deckConfig, getValidationUI, activeProviderConfig, procedureDraft, validatePhase, selectedVectorStoreId, handleChatSend]
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
        deckConfig: deckConfig ? (deckConfig as unknown as DeckConfig) : undefined,
        procedureContext: procedureDraft.trim() || undefined,
        vectorStoreId: selectedVectorStoreId || undefined,
      })
      setGeneration(result)

      const verResult = await verify({
        script: result.script,
        tests: result.tests
      })

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

      if (err && typeof err === 'object' && '_handled' in err) {
        // already handled by axios interceptor
      } else {
        toast.error('Generation Failed', errorMessage)
      }
    }
  }, [deckConfig, activeProviderConfig, procedureDraft, generate, verify, selectedVectorStoreId])

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
        deckConfig: deckConfig ? (deckConfig as unknown as DeckConfig) : undefined,
        procedureContext: procedureDraft.trim() || undefined,
        vectorStoreId: selectedVectorStoreId || undefined,
      })
      setGeneration(fixed)

      const verResult = await verify({
        script: fixed.script,
        tests: fixed.tests
      })

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

      if (err && typeof err === 'object' && '_handled' in err) {
        // already handled by axios interceptor
      } else {
        toast.error('Retry Failed', errorMessage)
      }
    }
  }, [deckConfig, generation, activeProviderConfig, procedureDraft, verification, fix, verify, selectedVectorStoreId])

  const handleFinishAsIs = useCallback(() => {
    setValidationState((prev) => ({ ...prev, generation: 'passed' }))
  }, [])

  // ── render ────────────────────────────────────────────────────────────────

  // If API is not configured, show setup prompt
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

          {/* Knowledge Base selector */}
          <div className="flex items-center gap-2 shrink-0">
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
        </motion.div>

        {/* Progress stepper */}
        <PhaseStepper
          currentPhase={phase}
          validationState={validationState}
          isUnlocked={isUnlocked}
          onPhaseSelect={setPhase}
        />

        {/* Phase panels */}
        <AnimatePresence mode="wait">
          {/* Deck layout step */}
          {phase === 'deck_layout' && (
            <motion.div
              key="deck_layout"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              <StepChatPanel
                phase="deck_layout"
                messages={messages.deck_layout}
                input={chatInput.deck_layout}
                chatLoading={chatLoading}
                placeholder="Ask about this deck layout..."
                onInputChange={(v: string) => setChatInput((prev) => ({ ...prev, deck_layout: v }))}
                onSend={() => handleChatSend('deck_layout')}
              />

              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <HamiltonDeckBuilder value={deckConfig} onChange={setDeckConfig} />
              </div>

              <StepFooter
                phase="deck_layout"
                validationState={validationState.deck_layout}
                feedback={validationFeedback.deck_layout}
                canValidate={!!deckConfig}
                validationPrompt={getValidationUI('deck_layout').prompt}
                promptDescription={getValidationUI('deck_layout').description}
                isValidateRequired
                hasNext
                onValidate={() => handleValidate('deck_layout')}
                onNext={() => handleNext('deck_layout')}
              />
            </motion.div>
          )}

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

              <ProcedureDraftInput
                value={procedureDraft}
                onChange={setProcedureDraft}
                placeholder="Describe what the script should do, step by step..."
              />

              <StepFooter
                phase="procedure"
                validationState={validationState.procedure}
                feedback={validationFeedback.procedure}
                canValidate={!!procedureDraft.trim()}
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
