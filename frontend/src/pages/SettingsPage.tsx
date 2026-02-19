import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Settings, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { api } from '@/api/client'
import { SettingsPanel } from '@/components/SettingsPanel'

export default function SettingsPage() {
  const [testing, setTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')

  const handleTestConnection = useCallback(async () => {
    setTesting(true)
    setConnectionStatus('idle')
    setStatusMessage('')

    try {
      const result = await api.health()
      setConnectionStatus('ok')
      setStatusMessage(result.status || 'Connected successfully')
    } catch (err) {
      setConnectionStatus('error')
      setStatusMessage(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setTesting(false)
    }
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-zinc-700/50 rounded-lg">
            <Settings className="w-5 h-5 text-zinc-300" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        </div>
        <p className="text-zinc-400 text-sm ml-12">
          Configure your LLM provider, model, and parameters.
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <SettingsPanel />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          Connection
        </h3>

        <motion.button
          onClick={handleTestConnection}
          disabled={testing}
          className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 border border-zinc-700"
          whileHover={{ scale: testing ? 1 : 1.01 }}
          whileTap={{ scale: testing ? 1 : 0.99 }}
        >
          {testing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Testing…
            </>
          ) : (
            'Test Connection'
          )}
        </motion.button>

        {connectionStatus !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              connectionStatus === 'ok'
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            {connectionStatus === 'ok' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span
              className={`text-sm ${
                connectionStatus === 'ok' ? 'text-emerald-300' : 'text-red-300'
              }`}
            >
              {statusMessage}
            </span>
          </motion.div>
        )}
      </div>
    </div>
  )
}
