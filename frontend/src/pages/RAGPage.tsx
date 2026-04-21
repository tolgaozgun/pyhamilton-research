import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Database,
  Upload,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Search,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRAG } from '@/lib/hooks/useRAG'
import type { VectorStore, RAGFile, VectorStoreFile } from '@/types'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: typeof CheckCircle; cls: string }> = {
    completed: { icon: CheckCircle, cls: 'text-green-600 bg-green-50' },
    ready: { icon: CheckCircle, cls: 'text-green-600 bg-green-50' },
    in_progress: { icon: Clock, cls: 'text-yellow-600 bg-yellow-50' },
    failed: { icon: AlertCircle, cls: 'text-red-600 bg-red-50' },
    cancelled: { icon: AlertCircle, cls: 'text-gray-500 bg-gray-100' },
  }
  const entry = map[status] ?? { icon: Clock, cls: 'text-gray-500 bg-gray-100' }
  const Icon = entry.icon
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', entry.cls)}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  )
}

// ─── Vector Store Card ────────────────────────────────────────────────────────

function VectorStoreCard({
  store,
  allFiles,
  storeFiles,
  onDelete,
  onFetchFiles,
  onAddFile,
  onRemoveFile,
}: {
  store: VectorStore
  allFiles: RAGFile[]
  storeFiles: VectorStoreFile[] | undefined
  onDelete: (id: string) => void
  onFetchFiles: (id: string) => void
  onAddFile: (vsId: string, fileId: string) => void
  onRemoveFile: (vsId: string, fileId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [addingFile, setAddingFile] = useState(false)
  const [selectedFileId, setSelectedFileId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [, setIsSearching] = useState(false)

  const handleExpand = () => {
    if (!expanded) onFetchFiles(store.id)
    setExpanded(e => !e)
  }

  const handleAdd = async () => {
    if (!selectedFileId) return
    await onAddFile(store.id, selectedFileId)
    setSelectedFileId('')
    setAddingFile(false)
  }

  const attachedIds = new Set((storeFiles ?? []).map(f => f.id))
  const availableFiles = allFiles.filter(f => !attachedIds.has(f.id))

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={handleExpand}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <Database className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-gray-900 text-sm truncate">{store.name}</div>
            <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
              <span>{store.file_counts.total} files</span>
              <span>·</span>
              <span>{formatBytes(store.usage_bytes)}</span>
              <span>·</span>
              <span>{formatDate(store.created_at)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <StatusBadge status={store.status} />
          <button
            onClick={e => { e.stopPropagation(); onDelete(store.id) }}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-100 overflow-hidden"
          >
            <div className="p-4 space-y-3">
              {/* Search within store */}
              <div className="flex gap-2">
                <input
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400"
                  placeholder="Search this store…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && setIsSearching(true)}
                />
                <button
                  onClick={() => setIsSearching(true)}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>

              {/* Files list */}
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Attached Files</div>
              {storeFiles && storeFiles.length === 0 && (
                <p className="text-sm text-gray-400 py-2">No files attached yet.</p>
              )}
              {storeFiles &&
                storeFiles.map(f => (
                  <div key={f.id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{f.id}</span>
                      <StatusBadge status={f.status} />
                    </div>
                    <button
                      onClick={() => onRemoveFile(store.id, f.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

              {/* Add file */}
              {addingFile ? (
                <div className="flex gap-2">
                  <select
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400 bg-white"
                    value={selectedFileId}
                    onChange={e => setSelectedFileId(e.target.value)}
                  >
                    <option value="">Select file…</option>
                    {availableFiles.map(f => (
                      <option key={f.id} value={f.id}>{f.filename}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAdd}
                    disabled={!selectedFileId}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setAddingFile(false)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingFile(true)}
                  className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Attach file
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── File Card ────────────────────────────────────────────────────────────────

function FileCard({ file, onDelete }: { file: RAGFile; onDelete: (id: string) => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-gray-500" />
        </div>
        <div className="min-w-0">
          <div className="font-medium text-gray-900 text-sm truncate">{file.filename}</div>
          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
            <span>{formatBytes(file.bytes)}</span>
            <span>·</span>
            <span>{formatDate(file.created_at)}</span>
          </div>
        </div>
      </div>
      <button
        onClick={() => onDelete(file.id)}
        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RAGPage() {
  const {
    files,
    vectorStores,
    vectorStoreFiles,
    isLoadingFiles,
    isLoadingStores,
    isUploading,
    fetchFiles,
    fetchVectorStores,
    fetchVectorStoreFiles,
    uploadFile,
    deleteFile,
    createVectorStore,
    deleteVectorStore,
    addFileToVectorStore,
    removeFileFromVectorStore,
  } = useRAG()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [newStoreName, setNewStoreName] = useState('')
  const [creatingStore, setCreatingStore] = useState(false)
  const [showNewStoreForm, setShowNewStoreForm] = useState(false)

  useEffect(() => {
    fetchFiles()
    fetchVectorStores()
  }, [fetchFiles, fetchVectorStores])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadFile(file)
    e.target.value = ''
  }

  const handleCreateStore = async () => {
    if (!newStoreName.trim()) return
    setCreatingStore(true)
    await createVectorStore(newStoreName.trim())
    setNewStoreName('')
    setShowNewStoreForm(false)
    setCreatingStore(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            Knowledge Base
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage files and vector stores used for OpenAI RAG retrieval.
          </p>
        </div>

        {/* Vector Stores */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Vector Stores
            </h2>
            <button
              onClick={() => setShowNewStoreForm(s => !s)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Store
            </button>
          </div>

          <AnimatePresence>
            {showNewStoreForm && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white border border-gray-200 rounded-xl p-4 flex gap-2"
              >
                <input
                  autoFocus
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400"
                  placeholder="Store name…"
                  value={newStoreName}
                  onChange={e => setNewStoreName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateStore()}
                />
                <button
                  onClick={handleCreateStore}
                  disabled={creatingStore || !newStoreName.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {creatingStore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                </button>
                <button
                  onClick={() => setShowNewStoreForm(false)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {isLoadingStores ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : vectorStores.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
              <Database className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No vector stores yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {vectorStores.map(store => (
                <VectorStoreCard
                  key={store.id}
                  store={store}
                  allFiles={files}
                  storeFiles={vectorStoreFiles[store.id]}
                  onDelete={deleteVectorStore}
                  onFetchFiles={fetchVectorStoreFiles}
                  onAddFile={addFileToVectorStore}
                  onRemoveFile={removeFileFromVectorStore}
                />
              ))}
            </div>
          )}
        </section>

        {/* Files */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Uploaded Files
            </h2>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".txt,.pdf,.md,.json,.csv,.docx"
              onChange={handleFileUpload}
            />
          </div>

          {isLoadingFiles ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : files.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No files uploaded yet.</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Upload your first file
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map(file => (
                <FileCard key={file.id} file={file} onDelete={deleteFile} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
