import { cn } from '@/lib/utils'

export type StatusBadgeStatus = 'success' | 'error' | 'warning' | 'info' | 'running'

export interface StatusBadgeProps {
  status: StatusBadgeStatus
  label: string
}

const statusStyles: Record<StatusBadgeStatus, string> = {
  success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  error: 'bg-red-500/10 border-red-500/30 text-red-400',
  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  running: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        statusStyles[status]
      )}
    >
      {label}
    </span>
  )
}

export default StatusBadge
