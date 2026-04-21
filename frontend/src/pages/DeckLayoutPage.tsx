import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutGrid, Plus, Trash2, Upload, CheckCircle2, XCircle,
  Loader2, Bot, Send, Save,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import type { DeckConfig, UserDeckLayout } from '@/types'
import { HamiltonDeckBuilder } from '@/components/deck/HamiltonDeckBuilder'
import { useUserDeckLayouts } from '@/lib/hooks/useUserDeckLayouts'
import { useSettings, useAgentic } from '@/lib/hooks'
import type { LLMConfig } from '@/types'

// ─── Chat Message ─────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DeckLayoutPage() {
  const {
    layouts,
    isLoading,
    isSaving,
    isValidating,
    isImporting,
    fetchLayouts,
    createLayout,
    updateLayout,
    deleteLayout,
    importJson,
    validateLayout,
  } = useUserDeckLayouts()

  const { getActiveProvider, activeProvider } = useSettings()
  const { chat, chatLoading } = useAgentic()

  const [activeLayoutId, setActiveLayoutId] = useState<number | null>(null)
  const [editingConfig, setEditingConfig] = useState<DeckConfig | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  // Create dialog
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  // Import dialog
  const [showImportForm, setShowImportForm] = useState(false)
  const [importName, setImportName] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hello! I\'m your Hamilton deck layout assistant.\n\nI can help you:\n• Design carrier and labware configurations\n• Understand Hamilton deck constraints\n• Suggest optimal layouts for your workflow\n• Validate your configuration choices\n\nSelect or create a deck layout on the left to get started.',
    },
  ])
  const [chatInput, setChatInput] = useState('')

  const [activeProviderConfig, setActiveProviderConfig] = useState<LLMConfig>({
    provider: 'google' as any,
    model_name: 'gemini-2.0-flash',
    temperature: 0.3,
    max_tokens: 4096,
  })

  useEffect(() => {
    fetchLayouts()
    getActiveProvider().catch(console.error)
  }, [fetchLayouts, getActiveProvider])

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

  // ── Selection ──────────────────────────────────────────────────────────────

  const activeLayout = layouts.find((l) => l.id === activeLayoutId) ?? null

  const handleSelectLayout = useCallback((layout: UserDeckLayout) => {
    if (isDirty && activeLayoutId !== layout.id) {
      const confirmed = window.confirm('You have unsaved changes. Discard and switch layouts?')
      if (!confirmed) return
    }
    setActiveLayoutId(layout.id)
    setEditingConfig(layout.configuration)
    setIsDirty(false)
  }, [isDirty, activeLayoutId])

  const handleConfigChange = useCallback((config: DeckConfig) => {
    setEditingConfig(config)
    setIsDirty(true)
  }, [])

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!activeLayoutId || !editingConfig) return
    const result = await updateLayout(activeLayoutId, { configuration: editingConfig })
    if (result) {
      setIsDirty(false)
      toast.success('Saved', 'Deck layout saved successfully.')
    }
  }, [activeLayoutId, editingConfig, updateLayout])

  // ── Create ─────────────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return
    const defaultConfig: DeckConfig = {
      carriers: [],
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
      total_rails: 54,
    }
    const layout = await createLayout(newName.trim(), defaultConfig, newDesc.trim() || undefined)
    if (layout) {
      setShowCreateForm(false)
      setNewName('')
      setNewDesc('')
      setActiveLayoutId(layout.id)
      setEditingConfig(layout.configuration)
      setIsDirty(false)
    }
  }, [newName, newDesc, createLayout])

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm('Delete this deck layout? This cannot be undone.')) return
    await deleteLayout(id)
    if (activeLayoutId === id) {
      setActiveLayoutId(null)
      setEditingConfig(null)
      setIsDirty(false)
    }
  }, [activeLayoutId, deleteLayout])

  // ── Import ─────────────────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (!importName.trim() || !importFile) return
    const layout = await importJson(importName.trim(), importFile)
    if (layout) {
      setShowImportForm(false)
      setImportName('')
      setImportFile(null)
      setActiveLayoutId(layout.id)
      setEditingConfig(layout.configuration)
      setIsDirty(false)
    }
  }, [importName, importFile, importJson])

  // ── Validate ───────────────────────────────────────────────────────────────

  const handleValidate = useCallback(async () => {
    if (!activeLayoutId) return
    // Save first if dirty
    if (isDirty && editingConfig) {
      await updateLayout(activeLayoutId, { configuration: editingConfig })
      setIsDirty(false)
    }
    const result = await validateLayout(activeLayoutId)
    if (result) {
      const content = result.valid
        ? `✓ Deck layout is valid\n${result.feedback}`
        : `✗ Deck layout has issues:\n${result.errors.map((e) => `• ${e}`).join('\n')}`
      setMessages((prev) => [...prev, { role: 'assistant', content }])
    }
  }, [activeLayoutId, isDirty, editingConfig, updateLayout, validateLayout])

  // ── Chat ───────────────────────────────────────────────────────────────────

  const handleChatSend = useCallback(async () => {
    const text = chatInput.trim()
    if (!text || chatLoading) return
    const userMsg: ChatMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setChatInput('')

    try {
      const response = await chat({
        phase: 'procedure', // use procedure phase slot for deck assistant
        goal: `You are a Hamilton STAR deck layout specialist. Help the user configure their deck layout.

Available carrier types: TIP_CAR_480_A00 (5 tip slots, 6 rails), TIP_CAR_288_C00 (3 tip slots, 4 rails), PLT_CAR_L5AC_A00 (5 plate slots, 6 rails), PLT_CAR_P3AC (3 plate slots, 6 rails), RGT_CAR_3R_A00 (3 reservoir slots, 6 rails).

CRITICAL RULES:
- Tip carriers only accept tip racks
- Plate carriers only accept plates
- Reagent carriers only accept reservoirs
- Never mix labware types on incompatible carriers
- Deck has 54 rails total; carriers are typically 4–6 rails wide

Respond with practical, concise advice about deck configuration.`,
        conversation: [...messages, userMsg],
        llmConfig: activeProviderConfig,
        deckConfig: editingConfig ?? undefined,
      })

      const assistantContent = response.ready
        ? `${response.summary ?? ''}`
        : response.question ?? 'I\'m not sure how to help with that.'

      setMessages((prev) => [...prev, { role: 'assistant', content: assistantContent }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Chat failed'
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${msg}` }])
    }
  }, [chatInput, chatLoading, chat, messages, activeProviderConfig, editingConfig])

  // ── Render ─────────────────────────────────────────────────────────────────

  const validationStatusColor = (status: string) => {
    if (status === 'valid') return 'text-emerald-600'
    if (status === 'invalid') return 'text-red-600'
    return 'text-gray-400'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <div className="p-3 bg-gray-200 rounded-lg">
            <LayoutGrid className="w-6 h-6 text-gray-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Deck Layouts</h1>
            <p className="text-gray-600 text-sm mt-1">
              Save and manage Hamilton STAR deck configurations.
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_360px] gap-6">
          {/* ── Left panel: layout list ──────────────────────────────────────── */}
          <div className="space-y-3">
            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCreateForm(true); setShowImportForm(false) }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> New
              </button>
              <button
                onClick={() => { setShowImportForm(true); setShowCreateForm(false) }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Upload className="w-4 h-4" /> Import
              </button>
            </div>

            {/* Create form */}
            <AnimatePresence>
              {showCreateForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-700">New deck layout</p>
                    <input
                      type="text"
                      placeholder="Name"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreate()}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
                    />
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreate}
                        disabled={!newName.trim() || isSaving}
                        className="flex-1 py-1.5 rounded-lg bg-gray-800 text-white text-xs font-medium disabled:opacity-50"
                      >
                        {isSaving ? 'Creating…' : 'Create'}
                      </button>
                      <button
                        onClick={() => setShowCreateForm(false)}
                        className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Import form */}
            <AnimatePresence>
              {showImportForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-700">Import AutomationDeck.json</p>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center cursor-pointer hover:border-gray-300 transition-colors"
                    >
                      {importFile ? (
                        <p className="text-xs text-gray-700 font-medium">{importFile.name}</p>
                      ) : (
                        <p className="text-xs text-gray-400">Click to select .json file</p>
                      )}
                    </div>
                    {importFile && (
                      <input
                        type="text"
                        placeholder="Layout name"
                        value={importName}
                        onChange={e => setImportName(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
                      />
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0] ?? null
                        setImportFile(f)
                        if (f) setImportName(f.name.replace(/\.json$/i, ''))
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleImport}
                        disabled={!importFile || !importName.trim() || isImporting}
                        className="flex-1 py-1.5 rounded-lg bg-gray-800 text-white text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {isImporting ? <><Loader2 className="w-3 h-3 animate-spin" /> Importing…</> : 'Import'}
                      </button>
                      <button
                        onClick={() => setShowImportForm(false)}
                        className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Layout list */}
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : layouts.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                No layouts yet. Create or import one.
              </div>
            ) : (
              <div className="space-y-2">
                {layouts.map((layout) => (
                  <div
                    key={layout.id}
                    onClick={() => handleSelectLayout(layout)}
                    className={cn(
                      'group relative bg-white border rounded-xl p-3.5 cursor-pointer transition-all',
                      activeLayoutId === layout.id
                        ? 'border-gray-400 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{layout.name}</p>
                        {layout.description && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{layout.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          {layout.validation_status === 'valid' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          ) : layout.validation_status === 'invalid' ? (
                            <XCircle className="w-3.5 h-3.5 text-red-500" />
                          ) : null}
                          <span className={cn('text-xs', validationStatusColor(layout.validation_status))}>
                            {layout.validation_status}
                          </span>
                          {layout.source === 'imported' && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">imported</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(layout.id) }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Center panel: deck builder ────────────────────────────────────── */}
          <div className="space-y-4">
            {activeLayoutId && editingConfig ? (
              <>
                {/* Toolbar */}
                <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{activeLayout?.name}</p>
                    {isDirty && <p className="text-xs text-amber-600">Unsaved changes</p>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleValidate}
                      disabled={isValidating}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Validate
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!isDirty || isSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-white text-xs font-medium disabled:opacity-50 hover:bg-gray-700 transition-colors"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save
                    </button>
                  </div>
                </div>

                {/* Deck builder */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <HamiltonDeckBuilder value={editingConfig} onChange={handleConfigChange} />
                </div>

                {/* Validation feedback */}
                {activeLayout?.validation_feedback && (
                  <div className={cn(
                    'rounded-xl border p-4 text-sm',
                    activeLayout.validation_status === 'valid'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  )}>
                    <p className="font-semibold mb-1">
                      {activeLayout.validation_status === 'valid' ? 'Layout is valid' : 'Validation issues'}
                    </p>
                    <p className="text-xs whitespace-pre-wrap">{activeLayout.validation_feedback}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-80 bg-white border border-gray-200 rounded-2xl text-gray-400">
                <LayoutGrid className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Select a deck layout to edit</p>
              </div>
            )}
          </div>

          {/* ── Right panel: AI chat ──────────────────────────────────────────── */}
          <div className="flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden h-[600px]">
            {/* Chat header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Bot className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-800">Deck AI Assistant</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-xl px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap max-w-[90%]',
                    msg.role === 'user'
                      ? 'ml-auto bg-gray-800 text-white'
                      : 'mr-auto bg-gray-100 text-gray-800'
                  )}
                >
                  {msg.content}
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 text-gray-400 text-xs">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Thinking…
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-gray-100 p-3 flex gap-2">
              <textarea
                rows={2}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleChatSend()
                  }
                }}
                placeholder="Ask about deck configuration…"
                className="flex-1 resize-none text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-gray-400"
              />
              <button
                onClick={handleChatSend}
                disabled={!chatInput.trim() || chatLoading}
                className="self-end p-2.5 rounded-lg bg-gray-800 text-white disabled:opacity-50 hover:bg-gray-700 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
