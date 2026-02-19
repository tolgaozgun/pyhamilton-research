import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { useAppStore } from '@/store'
import { api } from '@/api/client'
import { extractCode } from '@/lib/utils'
import { CodeBlock } from '@/components/CodeBlock'
import { DeckLayout } from '@/components/deck/DeckLayout'
import { AspirationSettings } from '@/components/deck/AspirationSettings'
import type { CarrierPlacement, AspirationSettingsData, DeckConfig } from '@/types'
import { DEFAULT_ASPIRATION } from '@/types'

const DEFAULT_CARRIERS: CarrierPlacement[] = [
  {
    carrier_type: 'TIP_CAR_480_A00',
    start_rail: 1,
    slots: [
      { type: 'tip_rack', subtype: '300uL', name: 'Tips 300µL #1' },
      { type: 'tip_rack', subtype: '300uL', name: 'Tips 300µL #2' },
      null,
      null,
      null,
    ],
  },
  {
    carrier_type: 'PLT_CAR_L5AC_A00',
    start_rail: 7,
    slots: [
      { type: 'plate', subtype: '96_well', name: 'Source Plate' },
      { type: 'plate', subtype: '96_well', name: 'Dest Plate' },
      null,
      null,
      null,
    ],
  },
]

export default function SimplePage() {
  const { llmConfig } = useAppStore()
  const [goal, setGoal] = useState('')
  const [script, setScript] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamMode, setStreamMode] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  const [carriers, setCarriers] = useState<CarrierPlacement[]>(DEFAULT_CARRIERS)
  const [aspiration, setAspiration] = useState<AspirationSettingsData>(DEFAULT_ASPIRATION)
  const [showDeck, setShowDeck] = useState(false)

  const handleGenerate = useCallback(async () => {
    if (!goal.trim()) return

    setLoading(true)
    setError(null)
    setScript('')

    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    const deckConfig: DeckConfig = {
      carriers,
      aspiration_settings: aspiration,
      total_rails: 55,
    }

    const userInput = {
      goal: goal.trim(),
      mode: 'simple' as const,
      deck_config: deckConfig as unknown as Record<string, unknown>,
    }

    if (streamMode) {
      try {
        let accumulated = ''
        for await (const event of api.simple.stream(userInput, llmConfig)) {
          if (event.type === 'chunk') {
            accumulated += event.content
            setScript(accumulated)
          } else if (event.type === 'done') {
            setScript(extractCode(accumulated))
            break
          } else if (event.type === 'error') {
            setError(event.content || 'Stream error')
            break
          }
        }
        if (!error) setScript(prev => extractCode(prev))
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message)
        }
      } finally {
        setLoading(false)
      }
    } else {
      try {
        const result = await api.simple.generate(userInput, llmConfig)
        setScript(extractCode(result.script))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Generation failed')
      } finally {
        setLoading(false)
      }
    }
  }, [goal, llmConfig, streamMode, error, carriers, aspiration])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Simple Mode</h1>
        </div>
        <p className="text-zinc-400 text-sm ml-12">
          Configure your deck, describe your procedure, and get a PyHamilton script instantly.
        </p>
      </div>

      {/* Deck Layout Section */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowDeck(!showDeck)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-zinc-800/50 transition-colors"
        >
          <span className="text-sm font-medium text-zinc-300">Deck Layout &amp; Settings</span>
          {showDeck
            ? <ChevronUp className="w-4 h-4 text-zinc-500" />
            : <ChevronDown className="w-4 h-4 text-zinc-500" />
          }
        </button>
        <AnimatePresence>
          {showDeck && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-5 border-t border-zinc-800">
                <div className="pt-4">
                  <DeckLayout carriers={carriers} onChange={setCarriers} />
                </div>
                <div className="border-t border-zinc-800 pt-4">
                  <AspirationSettings settings={aspiration} onChange={setAspiration} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Protocol Input */}
      <div className="space-y-4">
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Describe your liquid handling procedure…"
          rows={5}
          className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 resize-none text-sm leading-relaxed"
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-3 cursor-pointer select-none group">
            <button
              type="button"
              role="switch"
              aria-checked={streamMode}
              onClick={() => setStreamMode(!streamMode)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                streamMode ? 'bg-emerald-600' : 'bg-zinc-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                streamMode ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
            <span className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
              Stream output
            </span>
          </label>
        </div>

        <motion.button
          onClick={handleGenerate}
          disabled={loading || !goal.trim()}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          whileHover={{ scale: loading ? 1 : 1.01 }}
          whileTap={{ scale: loading ? 1 : 0.99 }}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Generate Script
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
        {script && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <CodeBlock code={script} filename="generated_script.py" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
