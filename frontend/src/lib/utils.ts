import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function extractCode(text: string): string {
  const match = text.match(/```(?:python)?\s*\n([\s\S]*?)```/)
  return match ? match[1].trim() : text.trim()
}

export function downloadFile(content: string, filename: string, mime = 'text/x-python') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
