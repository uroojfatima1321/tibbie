/**
 * SettingsPanel — Phase C
 * Workspace-level settings: scoring framework (RICE / WSJF).
 * Switching shows a confirmation explaining score preservation and Unscored behavior.
 */
import { useState } from 'react'
import { X, Settings } from 'lucide-react'
import { useApp } from '../../store/context'

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsPanel({ open, onClose }: Props) {
  const { framework, setFramework } = useApp()
  const [pendingFw, setPendingFw] = useState<'rice' | 'wsjf' | null>(null)
  const [loading, setLoading] = useState(false)

  if (!open) return null

  async function confirmSwitch() {
    if (!pendingFw) return
    setLoading(true)
    try {
      await setFramework(pendingFw)
      setPendingFw(null)
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-float max-w-md w-full p-6 space-y-5 animate-scale-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-ink-500" />
            <h2 className="font-semibold text-ink-900">Workspace settings</h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 p-1 rounded-lg hover:bg-surface-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Scoring framework */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-ink-900">Scoring framework</p>
            <p className="text-xs text-ink-500 mt-0.5">Determines how items are ranked in Prioritize. Only one framework is active at a time.</p>
          </div>

          {/* Radio options */}
          <div className="space-y-2">
            {([
              {
                value: 'rice' as const,
                label: 'RICE',
                description: 'Reach × Impact × Confidence% ÷ Effort',
              },
              {
                value: 'wsjf' as const,
                label: 'WSJF',
                description: '(Business Value + Time Criticality + Risk/Opp.) ÷ Job Size',
              },
            ] as const).map(opt => (
              <label key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  framework === opt.value
                    ? 'border-rust-400 bg-rust-50'
                    : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
                }`}
              >
                <input
                  type="radio"
                  name="framework"
                  value={opt.value}
                  checked={framework === opt.value}
                  onChange={() => {
                    if (opt.value !== framework) setPendingFw(opt.value)
                  }}
                  className="mt-0.5 text-rust-500 focus:ring-rust-400"
                />
                <div>
                  <span className="text-sm font-semibold text-ink-900">{opt.label}</span>
                  <p className="text-xs text-ink-500 font-mono mt-0.5">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Confirm switch dialog (inline) */}
        {pendingFw && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-ink-900">
              Switch to {pendingFw === 'rice' ? 'RICE' : 'WSJF'}?
            </p>
            <p className="text-xs text-ink-600">
              Existing scores are kept — items scored in the previous framework retain their data.
              Items not yet scored in <strong>{pendingFw === 'rice' ? 'RICE' : 'WSJF'}</strong> will appear as <em>Unscored</em> in the rank pool until scored.
            </p>
            <div className="flex gap-2">
              <button onClick={confirmSwitch} disabled={loading}
                className="btn-primary !py-1.5 text-sm disabled:opacity-50">
                {loading ? 'Switching…' : `Switch to ${pendingFw === 'rice' ? 'RICE' : 'WSJF'}`}
              </button>
              <button onClick={() => setPendingFw(null)} className="btn-ghost !py-1.5 text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={onClose} className="btn-outline text-sm !py-1.5">Done</button>
        </div>
      </div>
    </div>
  )
}
