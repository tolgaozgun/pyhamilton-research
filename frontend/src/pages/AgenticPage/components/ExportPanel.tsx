import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Download, FileCode, FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgenticVerificationResponse } from '@/types'
import { CodeBlock } from '@/components/CodeBlock'
import { StatusBadge } from '@/components/StatusBadge'

export interface ExportPanelProps {
  verification: AgenticVerificationResponse | null
  script: string
  tests: string
  showDetails: boolean
  onToggleDetails: () => void
}

export function ExportPanel({
  verification,
  script,
  tests,
  showDetails,
  onToggleDetails,
}: ExportPanelProps) {
  const passed = verification?.passed ?? false

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 backdrop-blur-sm border border-emerald-500/20 rounded-2xl p-6 space-y-5 shadow-lg shadow-emerald-500/10"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Download className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Final Export</h2>
              <p className="text-sm text-zinc-500">
                {passed
                  ? 'All verifications passed. Download your generated files.'
                  : 'Export with outstanding verification issues.'}
              </p>
            </div>
          </div>
          <StatusBadge
            status={passed ? 'success' : 'warning'}
            label={passed ? 'Verified bundle' : 'Export with issues'}
          />
        </div>

        <button
          type="button"
          onClick={onToggleDetails}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
            'border border-zinc-700 text-zinc-400 text-sm',
            'hover:bg-zinc-800 hover:text-zinc-200',
            'transition-all duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50'
          )}
        >
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showDetails ? 'Hide code' : 'Show code'}
        </button>
      </div>

      {/* Download buttons */}
      <div className="grid grid-cols-2 gap-3">
        <DownloadButton
          filename="pyhamilton_script.py"
          icon={<FileCode className="w-4 h-4" />}
          label="Download script"
          content={script}
          variant="primary"
        />
        <DownloadButton
          filename="test_pyhamilton_script.py"
          icon={<FlaskConical className="w-4 h-4" />}
          label="Download tests"
          content={tests}
          variant="secondary"
        />
      </div>

      {/* Code preview */}
      <AnimatePresence initial={false}>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4 overflow-hidden"
          >
            <CodeBlock code={script} filename="pyhamilton_script.py" />
            <CodeBlock code={tests} filename="test_pyhamilton_script.py" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function DownloadButton({
  filename,
  icon,
  label,
  content,
  variant,
}: {
  filename: string
  icon: React.ReactNode
  label: string
  content: string
  variant: 'primary' | 'secondary'
}) {
  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/x-python' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className={cn(
        'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-medium',
        'transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
        variant === 'primary'
          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
          : 'border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
      )}
    >
      {icon}
      {label}
    </button>
  )
}
