/**
 * RiceEditor — upgraded for Phase B+C
 * - Helper text under every field (usability is acceptance-critical)
 * - InfoTip on every field label
 * - Disabled state when item is Must-Do (shows reason)
 * - Disabled state when project is Live-group (not ranked)
 */
import { useState, useEffect } from 'react'
import type { RiceScore } from '../../types'
import { useApp } from '../../store/context'
import { InfoTip } from './InfoTip'
import { isValidRice, safeRiceScore } from '../../lib/filterV2'

const REACH_OPTIONS: { value: RiceScore['reach']; label: string; helper: string }[] = [
  { value: 1, label: '1 · Very few users',    helper: 'Niche — almost no one benefits directly' },
  { value: 2, label: '2 · Some users',         helper: 'A small segment uses this path' },
  { value: 3, label: '3 · Many users',         helper: 'A meaningful portion of the user base' },
  { value: 4, label: '4 · Most users',         helper: 'The majority will see or use this' },
  { value: 5, label: '5 · Nearly all users',   helper: 'Core — virtually everyone is affected' },
]

const IMPACT_OPTIONS: { value: RiceScore['impact']; label: string }[] = [
  { value: 0.25, label: '0.25 · Minimal' },
  { value: 0.5,  label: '0.5 · Low' },
  { value: 1,    label: '1 · Medium' },
  { value: 2,    label: '2 · High' },
  { value: 3,    label: '3 · Massive' },
]

function computeScore(reach: number, impact: number, confidence: number, effort: number): number | null {
  if (!reach || !impact || confidence < 0 || effort < 0.5 || confidence > 100) return null
  return (reach * impact * (confidence / 100)) / effort
}

interface Props {
  featureId?: string
  projectId?: string
  moduleId?: string
  kind?: 'feature' | 'project' | 'module'   // Fix 1 R2-C1: modules are scoreable
  /** Non-null = Must-Do tagged, show blocked state with reason */
  mustDoReason?: string
  /** When true, show Live-product blocking message */
  isLive?: boolean
}

export function RiceEditor({ featureId, projectId, moduleId, kind = 'feature', mustDoReason, isLive }: Props) {
  const { featuresV2, projectsV2, modulesV2, rankedItemIds, updateFeatureV2, updateProjectV2, updateModuleV2, data } = useApp()
  const itemId = featureId ?? projectId ?? moduleId ?? ''
  const item = kind === 'feature'
    ? featuresV2.find(f => f.id === featureId)
    : kind === 'project'
    ? projectsV2.find(p => p.id === projectId)
    : modulesV2.find(m => m.id === moduleId)

  const existing = item?.rice
  const [reach, setReach]         = useState<RiceScore['reach'] | ''>(existing?.reach ?? '')
  const [impact, setImpact]       = useState<RiceScore['impact'] | ''>(existing?.impact ?? '')
  const [confidence, setConfidence] = useState<string>(existing?.confidence?.toString() ?? '')
  const [effort, setEffort]       = useState<string>(existing?.effort?.toString() ?? '')
  const [confFlash, setConfFlash] = useState(false)
  const [effortErr, setEffortErr] = useState('')
  const [confErr, setConfErr]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  useEffect(() => {
    if (existing) {
      setReach(existing.reach); setImpact(existing.impact)
      setConfidence(existing.confidence.toString()); setEffort(existing.effort.toString())
    }
  }, [existing?.scoredAt])

  const confNum   = parseFloat(confidence)
  const effortNum = parseFloat(effort)
  const score = (reach !== '' && impact !== '' && !isNaN(confNum) && !isNaN(effortNum))
    ? computeScore(Number(reach), Number(impact), confNum, effortNum)
    : null

  const formulaBreakdown = (score !== null && reach !== '' && impact !== '')
    ? `(${reach} × ${impact} × ${confNum}%) ÷ ${effortNum} = ${score.toFixed(2)}`
    : null

  const wouldBeRank = (() => {
    if (score === null) return null
    const others = rankedItemIds
      .filter(id => id !== itemId)
      .map(id => {
        const f = featuresV2.find(x => x.id === id) ?? projectsV2.find(x => x.id === id)
        if (!f?.rice) return 0
        return safeRiceScore(f.rice) ?? 0
      })
    return { rank: others.filter(s => s > score).length + 1, total: others.length + 1 }
  })()

  function handleConfBlur() {
    const n = parseFloat(confidence)
    if (isNaN(n)) return
    if (n > 100) {
      setConfidence('100'); setConfFlash(true)
      setTimeout(() => setConfFlash(false), 400)
    }
    setConfErr('')
  }

  function handleEffortBlur() {
    const n = parseFloat(effort)
    if (!isNaN(n) && n < 0.5) setEffortErr('Min 0.5 person-weeks')
    else setEffortErr('')
  }

  async function handleSave() {
    if (score === null || reach === '' || impact === '') return
    const confN = parseFloat(confidence); const effortN = parseFloat(effort)
    if (isNaN(confN) || confN < 0 || confN > 100) { setConfErr('Must be 0–100'); return }
    if (isNaN(effortN) || effortN < 0.5) { setEffortErr('Min 0.5'); return }
    setSaving(true)
    try {
      const rice: RiceScore = {
        reach: reach as RiceScore['reach'],
        impact: impact as RiceScore['impact'],
        confidence: confN, effort: effortN,
        scoredAt: new Date().toISOString().slice(0, 10),
        scoredBy: data?.members[0]?.id,
      }
      if (kind === 'feature') await updateFeatureV2(itemId, { rice })
      else if (kind === 'project') await updateProjectV2(itemId, { rice })
      else await updateModuleV2(itemId, { rice })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  // ── Must-Do blocked state ────────────────────────────────────────────────
  if (mustDoReason) {
    return (
      <div className="bg-brick-50 border border-brick-200 rounded-xl p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-brick-600">RICE Score</p>
        <p className="text-sm text-brick-700 font-medium">Must-Do items are not scored — they ship regardless.</p>
        <p className="text-xs text-brick-600 italic">Reason: {mustDoReason}</p>
        {existing && (
          <p className="text-xs text-ink-400 font-mono">
            Prior score retained: {safeRiceScore(existing)?.toFixed(1) ?? '—'} (not in rank pool)
          </p>
        )}
      </div>
    )
  }

  // ── Live-product blocked state (also covers in-delivery projects — EXC-3 F) ─
  if (isLive) {
    return (
      <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">RICE Score</p>
        <p className="text-sm text-ink-600">Build decision is made — score its features and improvements instead.</p>
        {existing && (
          <p className="text-xs text-ink-400 font-mono">
            Score retained: {safeRiceScore(existing)?.toFixed(1) ?? '—'} (not in rank pool)
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">RICE Score</p>
        {existing && (
          <span className="font-mono text-[10px] text-ink-400">
            Scored {new Date(existing.scoredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Reach */}
        <div>
          <div className="flex items-center gap-1 mb-1">
            <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">Reach</label>
            <InfoTip content="How many users does this affect per release period? Count unique users, not events." />
          </div>
          <select className="input w-full text-sm" value={reach}
            onChange={e => setReach(Number(e.target.value) as RiceScore['reach'])}>
            <option value="">—</option>
            {REACH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p className="text-[10px] text-ink-400 mt-0.5 leading-tight">
            {reach !== '' ? REACH_OPTIONS.find(o => o.value === Number(reach))?.helper : 'How many users are affected?'}
          </p>
        </div>

        {/* Impact */}
        <div>
          <div className="flex items-center gap-1 mb-1">
            <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">Impact</label>
            <InfoTip content="How much does this move the needle for each user? Use 3 sparingly — only for transformative changes." />
          </div>
          <select className="input w-full text-sm" value={impact}
            onChange={e => setImpact(Number(e.target.value) as RiceScore['impact'])}>
            <option value="">—</option>
            {IMPACT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p className="text-[10px] text-ink-400 mt-0.5 leading-tight">How much does it move each user's needle?</p>
        </div>

        {/* Confidence */}
        <div>
          <div className="flex items-center gap-1 mb-1">
            <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">Conf. %</label>
            <InfoTip content="How confident are you in Reach and Impact estimates? 80% = good data, 50% = gut feel, 20% = speculation." />
          </div>
          <div className="relative">
            <input type="number" min={0} max={100} step={5}
              className={`input w-full text-sm pr-5 ${confFlash ? 'border-amber-500' : ''} ${confErr ? 'border-brick-500' : ''}`}
              value={confidence} placeholder="80"
              onChange={e => { setConfidence(e.target.value); setConfErr('') }}
              onBlur={handleConfBlur} />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-400 pointer-events-none">%</span>
          </div>
          <p className="text-[10px] text-ink-400 mt-0.5 leading-tight">How sure are you? 80 = data-backed, 20 = gut feel</p>
          {confErr && <p className="text-[10px] text-brick-500 mt-0.5">{confErr}</p>}
        </div>

        {/* Effort */}
        <div>
          <div className="flex items-center gap-1 mb-1">
            <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">Effort Req.</label>
            <InfoTip content="Total person-weeks to design, build, and ship. Include all disciplines. Min 0.5." />
          </div>
          <input type="number" min={0.5} step={0.5}
            className={`input w-full text-sm ${effortErr ? 'border-brick-500' : ''}`}
            value={effort} placeholder="2"
            onChange={e => { setEffort(e.target.value); setEffortErr('') }}
            onBlur={handleEffortBlur} />
          <p className="text-[10px] text-ink-400 mt-0.5 leading-tight">Person-weeks end-to-end. Min 0.5</p>
          {effortErr && <p className="text-[10px] text-brick-500 mt-0.5">{effortErr}</p>}
        </div>
      </div>

      {/* Score + formula */}
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">Score</p>
            <InfoTip content="(Reach × Impact × Confidence%) ÷ Effort Required" />
          </div>
          <span className="font-display text-[28px] text-ink-900 leading-none">
            {score !== null ? score.toFixed(1) : '—'}
          </span>
          {formulaBreakdown && (
            <p className="font-mono text-[10px] text-ink-400 mt-0.5">{formulaBreakdown}</p>
          )}
        </div>
        {wouldBeRank !== null && (
          <div className="pb-1 flex items-center gap-1">
            <p className="text-sm text-ink-500">
              → would rank{' '}
              <span className="font-mono font-semibold text-ink-900">#{wouldBeRank.rank}</span>
              <span className="text-ink-400"> / {wouldBeRank.total}</span>
            </p>
            <InfoTip content="Position among all scored items, sorted by RICE score" />
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={score === null || saving || !!confErr || !!effortErr}
          className="btn-primary !py-1.5 text-sm disabled:opacity-40">
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save RICE score'}
        </button>
      </div>
    </div>
  )
}
