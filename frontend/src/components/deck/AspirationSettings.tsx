import { cn } from '@/lib/utils'
import { TIP_CATALOG } from '@/types'
import type { AspirationSettingsData } from '@/types'

interface AspirationSettingsProps {
  settings: AspirationSettingsData
  onChange: (settings: AspirationSettingsData) => void
}

const LIQUID_CLASSES = ['Water', 'Serum', 'DMSO', 'Glycerol', 'Ethanol']

const inputClass =
  'w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm'

const labelClass = 'block text-sm font-medium text-zinc-100 mb-2'

export function AspirationSettings({ settings, onChange }: AspirationSettingsProps) {
  const update = <K extends keyof AspirationSettingsData>(
    key: K,
    value: AspirationSettingsData[K]
  ) => {
    onChange({ ...settings, [key]: value })
  }

  return (
    <div className="space-y-5">
      {/* Volume */}
      <div>
        <label className={labelClass}>
          Volume: {settings.volume_ul} µL
        </label>
        <input
          type="range"
          min={0}
          max={5000}
          step={1}
          value={settings.volume_ul}
          onChange={(e) => update('volume_ul', Number(e.target.value))}
          className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-zinc-500">0</span>
          <input
            type="number"
            min={0}
            max={5000}
            value={settings.volume_ul}
            onChange={(e) => update('volume_ul', Math.max(0, Number(e.target.value)))}
            className="w-20 px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-100 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-xs text-zinc-500">5000</span>
        </div>
      </div>

      {/* Flow rate */}
      <div>
        <label className={labelClass}>Flow Rate (µL/s)</label>
        <input
          type="number"
          min={1}
          max={2000}
          value={settings.flow_rate_ul_per_s}
          onChange={(e) => update('flow_rate_ul_per_s', Math.max(1, Number(e.target.value)))}
          className={inputClass}
        />
      </div>

      {/* Mix cycles */}
      <div>
        <label className={labelClass}>Mix Cycles</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={settings.mix_cycles <= 0}
            onClick={() => update('mix_cycles', settings.mix_cycles - 1)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              settings.mix_cycles <= 0
                ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            )}
          >
            −
          </button>
          <span className="w-12 text-center text-zinc-100 text-sm font-mono">
            {settings.mix_cycles}
          </span>
          <button
            type="button"
            disabled={settings.mix_cycles >= 20}
            onClick={() => update('mix_cycles', settings.mix_cycles + 1)}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              settings.mix_cycles >= 20
                ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            )}
          >
            +
          </button>
        </div>
      </div>

      {/* Mix volume (conditional) */}
      {settings.mix_cycles > 0 && (
        <div>
          <label className={labelClass}>Mix Volume (µL)</label>
          <input
            type="number"
            min={0}
            max={5000}
            value={settings.mix_volume_ul}
            onChange={(e) => update('mix_volume_ul', Math.max(0, Number(e.target.value)))}
            className={inputClass}
          />
        </div>
      )}

      {/* Liquid class */}
      <div>
        <label className={labelClass}>Liquid Class</label>
        <select
          value={settings.liquid_class}
          onChange={(e) => update('liquid_class', e.target.value)}
          className={inputClass}
        >
          {LIQUID_CLASSES.map((lc) => (
            <option key={lc} value={lc}>
              {lc}
            </option>
          ))}
        </select>
      </div>

      {/* Tip type */}
      <div>
        <label className={labelClass}>Tip Type</label>
        <select
          value={settings.tip_type}
          onChange={(e) => update('tip_type', e.target.value)}
          className={inputClass}
        >
          {Object.entries(TIP_CATALOG).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={settings.pre_wet}
            onClick={() => update('pre_wet', !settings.pre_wet)}
            className={cn(
              'relative w-10 h-5 rounded-full transition-colors',
              settings.pre_wet ? 'bg-blue-600' : 'bg-zinc-700'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                settings.pre_wet ? 'translate-x-5' : 'translate-x-0.5'
              )}
            />
          </button>
          <span className="text-sm text-zinc-300">Pre-wet</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={settings.touch_off}
            onClick={() => update('touch_off', !settings.touch_off)}
            className={cn(
              'relative w-10 h-5 rounded-full transition-colors',
              settings.touch_off ? 'bg-blue-600' : 'bg-zinc-700'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                settings.touch_off ? 'translate-x-5' : 'translate-x-0.5'
              )}
            />
          </button>
          <span className="text-sm text-zinc-300">Touch-off</span>
        </label>
      </div>
    </div>
  )
}

export default AspirationSettings
