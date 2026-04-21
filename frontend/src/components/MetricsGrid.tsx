export interface MetricsGridProps {
  metrics: Record<string, string | number>
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  const entries = Object.entries(metrics)

  if (entries.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
        >
          <div className="text-2xl font-bold text-zinc-100 mb-1">{value}</div>
          <div className="text-xs text-zinc-500 uppercase tracking-wide">
            {key.replace(/_/g, ' ')}
          </div>
        </div>
      ))}
    </div>
  )
}

export default MetricsGrid
