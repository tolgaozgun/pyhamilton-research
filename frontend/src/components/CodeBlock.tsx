import { useState } from 'react'
import { Copy, Download, Check } from 'lucide-react'
import { motion } from 'framer-motion'
export interface CodeBlockProps {
  code: string
  language?: string
  filename?: string
  onDownload?: () => void
}

export function CodeBlock({ code, filename, onDownload }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleDownload = () => {
    if (onDownload) {
      onDownload()
    } else {
      const blob = new Blob([code], { type: 'text/x-python' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || 'script.py'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const lines = code.split('\n')

  return (
    <div className="relative group">
      <div className="absolute top-3 right-3 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              <Check className="w-4 h-4 text-emerald-400" />
            </motion.div>
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={handleDownload}
          className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
          aria-label="Download code"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        {filename && (
          <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-950">
            <span className="text-sm text-zinc-400 font-mono">{filename}</span>
          </div>
        )}
        <div className="overflow-x-auto">
          <pre className="p-4 text-sm font-mono text-zinc-100">
            <code className="flex">
              <div className="select-none text-zinc-500 pr-4 text-right border-r border-zinc-800">
                {lines.map((_, i) => (
                  <div key={i} className="leading-6">
                    {i + 1}
                  </div>
                ))}
              </div>
              <div className="pl-4 flex-1">
                {lines.map((line, i) => (
                  <div key={i} className="leading-6 whitespace-pre">
                    {line || '\u00A0'}
                  </div>
                ))}
              </div>
            </code>
          </pre>
        </div>
      </div>
    </div>
  )
}

export default CodeBlock
