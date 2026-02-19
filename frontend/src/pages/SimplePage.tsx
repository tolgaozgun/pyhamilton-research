import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Loader2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { api } from '@/api/client'
import { extractCode } from '@/lib/utils'
import { CodeBlock } from '@/components/CodeBlock'

export default function SimplePage() {
  const { llmConfig } = useAppStore()
  const [goal, setGoal] = useState('')
  const [script, setScript] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamMode, setStreamMode] = useState(true)
  const eventSourceRef = useRef<EventSource | null>(null)

  const handleGenerate = useCallback(async () => {
    if (!goal.trim()) return

    setLoading(true)
    setError(null)
    setScript('')

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    if (streamMode) {
      const es = api.simple.stream({
        goal: goal.trim(),
        provider_name: llmConfig.provider,
        model_name: llmConfig.model_name,
        api_key: llmConfig.api_key,
      })
      eventSourceRef.current = es
      let accumulated = ''

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'chunk') {
            accumulated += data.content
            setScript(accumulated)
          } else if (data.type === 'done') {
            setScript(extractCode(accumulated || data.content || ''))
            setLoading(false)
            es.close()
          } else if (data.type === 'error') {
            setError(data.content || data.message || 'Stream error')
            setLoading(false)
            es.close()
          }
        } catch {
          accumulated += event.data
          setScript(accumulated)
        }
      }

      es.onerror = () => {
        if (accumulated) {
          setScript(extractCode(accumulated))
        } else {
          setError('Connection lost. Check your API key and try again.')
        }
        setLoading(false)
        es.close()
        eventSourceRef.current = null
      }
    } else {
      try {
        const result = await api.simple.generate(
          { goal: goal.trim(), mode: 'simple' },
          llmConfig
        )
        setScript(extractCode(result.script))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Generation failed')
      } finally {
        setLoading(false)
      }
    }
  }, [goal, llmConfig, streamMode])

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Simple Mode</h1>
        </div>
        <p className="text-zinc-400 text-sm ml-12">
          Describe your procedure and get a PyHamilton script instantly. No validation pipeline — fast and direct.
        </p>
      </div>

      <div className="space-y-4">
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Describe your liquid handling procedure…"
          rows={6}
          className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none text-sm leading-relaxed font-mono"
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-3 cursor-pointer select-none group">
            <button
              type="button"
              role="switch"
              aria-checked={streamMode}
              onClick={() => setStreamMode(!streamMode)}
              className={`
                relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors
                ${streamMode ? 'bg-emerald-600' : 'bg-zinc-700'}
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform
                  ${streamMode ? 'translate-x-4' : 'translate-x-0.5'}
                `}
              />
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
