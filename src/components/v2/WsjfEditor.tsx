/**
 * WsjfEditor — Phase C
 * Scores items using WSJF: (Business Value + Time Criticality + Risk/Opportunity) ÷ Job Size
 * All fields 1–10 (selects, not free numbers). Usability is acceptance-critical.
 */
import { useState, useEffect } from 'react'
import type { WsjfScore } from '../../types'
import { useApp } from '../../store/context'
import { InfoTip } from './InfoTip'
import { isValidWsjf, safeWsjfScore } from '../../lib/filterV2'

const OPTS_1_10 = Array.from({ length: 10 }, (_, i) => i + 1)

// ── Field definitions with exact spec helper copy ─────────────────────────────
const WSJF_FIELDS: {
  key: keyof Pick<WsjfScore, 'businessValue' | 'timeCriticality' | 'riskOpportunity' | 'jobSize'>
  label: string
  tip: string
  helper: string
}[] = [
  {
    key: 'businessValue',
    label: 'Business Value',
    tip: 'How much revenue or strategic value does this deliver?',
    helper: 'How much money/strategic value does this deliver? 1 = minimal, 10 = massive',
  },
  {
    key: 'timeCriticality',
    label: 'Time Criticality',
    tip: 'What do we lose by waiting?',
    helper: 'What do we lose by waiting? 1 = nothing, 10 = deadline/opportunity expires',
  },
  {
    key: 'riskOpportunity',
    label: 'Risk / Opportunity',
    tip: 'Does this reduce risk or unlock future work?',
    helper: 'Does this reduce risk or unlock future work? 1 = no, 10 = critically',
  },
  {
    key: 'jobSize',
    label: 'Job Size',
    tip: 'Relative size vs other items. WSJF divides by this — bigger = lower rank.',
    helper: 'Relative size vs other items. 1 = tiny, 10 = huge',
  },
]

const EXPLAINER_KEY = 'tibbie-wsjf-explainer-v1'

interface Props {
  featureId?: string
  projectId?: string
  moduleId?: string
  kind?: 'feature' | 'project' | 'module'   // Fix 1 R2-C1: all three entity types
  /** When true, discard scoring UI and show the reason instead (Must-Do items) */
  mustDoReason?: string
  /** When true, show Live-product blocking message */
  isLive?: boolean
}

export function WsjfEditor({ featureId, projectId, moduleId, kind = 'feature', mustDoReason, isLive }: Props) {
  const { featuresV2, projectsV2, modulesV2, rankedItemIds, updateFeatureV2, updateProjectV2, updateModuleV2, data } = useApp()
  const itemId = featureId ?? projectId ?? moduleId ?? ''
  const item = kind === 'feature'
    ? featuresV2.find(f => f.id === featureId)
    : kind === 'project'
    ? projectsV2.find(p => p.id === projectId)
    : modulesV2.find(m => m.id === moduleId)

  const existing = item?.wsjf
  const [vals, setVals] = useState<Record<string, number>>({
    businessValue: existing?.businessValue ?? 5,
    timeCriticality: existing?.timeCriticality ?? 5,
    riskOpportunity: existing?.riskOpportunity ?? 5,
    jobSize: existing?.jobSize ?? 5,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [explainerDismissed, setExplainerDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(EXPLAINER_KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    if (existing) {
      setVals({
        businessValue: existing.businessValue,
        timeCriticality: existing.timeCriticality,
        riskOpportunity: existing.riskOpportunity,
        jobSize: existing.jobSize,
      })
    }
  }, [existing?.scoredAt])

  // Compute live score
  const bv = vals.businessValue, tc = vals.timeCriticality, ro = vals.riskOpportunity, js = vals.jobSize
  const score = (bv + tc + ro) / js

  // Rank preview
  const wouldBeRank = (() => {
    const others = rankedItemIds
      .filter(id => id !== itemId)
      .map(id => {
        const f = featuresV2.find(x => x.id === id) ?? projectsV2.find(x => x.id === id)
        if (!f?.wsjf) return 0
        return safeWsjfScore(f.wsjf) ?? 0
      })
    return { rank: others.filter(s => s > score).length + 1, total: others.length + 1 }
  })()

  function dismissExplainer() {
    setExplainerDismissed(true)
    try { localStorage.setItem(EXPLAINER_KEY, '1') } catch {}
  }

  async function handleSave() {
    setSaving(true)
    try {
      const wsjf: WsjfScore = {
        businessValue: bv, timeCriticality: tc, riskOpportunity: ro, jobSize: js,
        scoredAt: new Date().toISOString().slice(0, 10),
        scoredBy: data?.members[0]?.id,
      }
      if (kind === 'feature') await updateFeatureV2(itemId, { wsjf })
      else if (kind === 'project') await updateProjectV2(itemId, { wsjf })
      else await updateModuleV2(itemId, { wsjf })  // Fix 1: no more 'as any'
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  // ── Must-Do override ──────────────────────────────────────────────────────
  if (mustDoReason) {
    return (
      <div className="bg-brick-50 border border-brick-200 rounded-xl p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-brick-600">WSJF Score</p>
        <p className="text-sm text-brick-700 font-medium">Must-Do items are not scored — they ship regardless.</p>
        <p className="text-xs text-brick-600 italic">Reason: {mustDoReason}</p>
      </div>
    )
  }

  // ── Live-product override (also covers in-delivery — EXC-3 F) ─────────────
  if (isLive) {
    return (
      <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">WSJF Score</p>
        <p className="text-sm text-ink-600">Build decision is made — score its features and improvements instead.</p>
        {existing && (
          <p className="text-xs text-ink-400 font-mono">
            Last score retained: {safeWsjfScore(existing)?.toFixed(1) ?? '—'} (not in rank pool)
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">WSJF Score</p>
        {existing && (
          <span className="font-mono text-[10px] text-ink-400">
            Scored {new Date(existing.scoredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>

      {/* One-time first-use explainer card */}
      {!explainerDismissed && (
        <div className="bg-steel-50 border border-steel-500/20 rounded-lg p-3 text-xs text-steel-600 space-y-1 relative">
          <p className="font-semibold text-steel-700">WSJF ranks by value-per-effort with urgency</p>
          <p>Score each dimension 1–10, then divide by Job Size. High value + time pressure + small size = top rank.</p>
          <p className="font-mono text-[10px] text-steel-500">(Business Value + Time Criticality + Risk/Opp.) ÷ Job Size</p>
          <button onClick={dismissExplainer} className="absolute top-2 right-2 text-steel-400 hover:text-steel-600 text-lg leading-none">×</button>
        </div>
      )}

      {/* 4 field selects */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {WSJF_FIELDS.map(f => (
          <div key={f.key}>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">{f.label}</label>
              <InfoTip content={f.tip} />
            </div>
            <select
              className="input w-full text-sm"
              value={vals[f.key]}
              onChange={e => setVals(v => ({ ...v, [f.key]: Number(e.target.value) }))}
            >
              {OPTS_1_10.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <p className="text-[10px] text-ink-400 mt-0.5 leading-tight">{f.helper}</p>
          </div>
        ))}
      </div>

      {/* Score + formula + rank preview */}
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">Score</p>
            <InfoTip content="(Business Value + Time Criticality + Risk/Opportunity) ÷ Job Size" />
          </div>
          <span className="font-display text-[28px] text-ink-900 leading-none">
            {score.toFixed(1)}
          </span>
          <p className="font-mono text-[10px] text-ink-400 mt-0.5">
            ({bv} + {tc} + {ro}) ÷ {js} = {score.toFixed(2)}
          </p>
        </div>
        <div className="pb-1 flex items-center gap-1">
          <p className="text-sm text-ink-500">
            → would rank{' '}
            <span className="font-mono font-semibold text-ink-900">#{wouldBeRank.rank}</span>
            <span className="text-ink-400"> / {wouldBeRank.total}</span>
          </p>
          <InfoTip content="Position among all scored items using WSJF" />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="btn-primary !py-1.5 text-sm disabled:opacity-40">
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save WSJF score'}
        </button>
      </div>
    </div>
  )
}
