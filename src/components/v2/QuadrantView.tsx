import { useMemo, useState, useRef } from 'react'
import { useApp } from '../../store/context'
import type { FeatureV2, FeatureStatus } from '../../types'
import { InfoTip } from './InfoTip'
import { isValidRice, safeRiceScore } from '../../lib/filterV2'

type YAxis = 'rice' | 'value'

const STATUS_DOT: Partial<Record<FeatureStatus, string>> = {
  intake: '#A8A29A', tech_review: '#3A6B8A', refinement: '#2D5470', in_dev: '#3A6B8A',
  code_review: '#C8932F', qa: '#C8932F', staging_signoff: '#4F7C66', shipped: '#2F5743',
  rework: '#A83D2F', on_hold: '#8B8680', killed: '#8A2F23',
}
function dotColor(status: string) { return STATUS_DOT[status as FeatureStatus] ?? '#8B8680' }

const W = 600, H = 460
const PAD = { top: 36, right: 24, bottom: 48, left: 48 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom
const DOT_R = 5, CLUSTER_R = 22

interface Dot { x: number; y: number; id: string; name: string; status: string }
interface Cluster { cx: number; cy: number; items: { id: string; name: string; kind: string }[] }

function buildClusters(dots: Dot[]): Cluster[] {
  const clusters: Cluster[] = []
  for (const d of dots) {
    const ex = clusters.find(c => Math.hypot(c.cx - d.x, c.cy - d.y) < CLUSTER_R)
    if (ex) { ex.items.push({ id: d.id, name: d.name, kind: 'feature' }); ex.cx = (ex.cx * (ex.items.length - 1) + d.x) / ex.items.length; ex.cy = (ex.cy * (ex.items.length - 1) + d.y) / ex.items.length }
    else clusters.push({ cx: d.x, cy: d.y, items: [{ id: d.id, name: d.name, kind: 'feature' }] })
  }
  return clusters
}

export function quadrantLabel(effort: number, y: number, medEffort: number, medY: number) {
  const highY = y >= medY, lowX = effort <= medEffort
  if (highY && lowX) return 'Quick Win'
  if (highY && !lowX) return 'Big Bet'
  if (!highY && lowX) return 'Fill-In'
  return 'Money Pit'
}

interface Props {
  onOpenFeature: (id: string) => void
  onOpenProject?: (id: string) => void
}

export function QuadrantView({ onOpenFeature, onOpenProject }: Props) {
  const { featuresV2, projectsV2 } = useApp()
  const [yAxis, setYAxis] = useState<YAxis>('rice')
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string } | null>(null)
  const [expandedCluster, setExpandedCluster] = useState<Cluster | null>(null)

  // Phase B: Must-Do items are excluded from the quadrant (they ship unconditionally)
  const mustDoCount = useMemo(() =>
    [...featuresV2, ...projectsV2].filter(i => !!i.mustDo).length
  , [featuresV2, projectsV2])

  // Build items based on Y axis — Must-Do excluded
  const allItems = useMemo(() => [
    ...featuresV2.filter(f => !f.mustDo).map(f => ({ id: f.id, kind: 'feature' as const, name: f.name, status: f.status, effort: isValidRice(f.rice) ? f.rice.effort : undefined, riceNumerator: isValidRice(f.rice) ? f.rice.reach * f.rice.impact * (f.rice.confidence / 100) : undefined, valueRating: f.valueRating })),
    ...projectsV2.filter(p => !p.mustDo).map(p => ({ id: p.id, kind: 'project' as const, name: p.name, status: p.status, effort: isValidRice(p.rice) ? p.rice.effort : undefined, riceNumerator: isValidRice(p.rice) ? p.rice.reach * p.rice.impact * (p.rice.confidence / 100) : undefined, valueRating: p.valueRating })),
  ], [featuresV2, projectsV2])

  const validItems = useMemo(() => allItems.filter(i => {
    if (!i.effort) return false
    if (yAxis === 'rice') return i.riceNumerator !== undefined && i.effort >= 0.5
    return i.valueRating !== undefined && i.effort >= 0.5
  }), [allItems, yAxis])

  const excludedCount = allItems.filter(i => i.effort && (yAxis === 'rice' ? i.riceNumerator === undefined : i.valueRating === undefined)).length

  const { dots, medEffort, medY } = useMemo(() => {
    if (validItems.length === 0) return { dots: [], medEffort: 1, medY: 1 }
    const efforts = validItems.map(i => i.effort!)
    const ys = validItems.map(i => yAxis === 'rice' ? i.riceNumerator! : i.valueRating!)
    const maxEffort = Math.max(...efforts, 1)
    const maxY = Math.max(...ys, 1)
    const sortedE = [...efforts].sort((a, b) => a - b)
    const sortedY = [...ys].sort((a, b) => a - b)
    const medEffort = sortedE[Math.floor(sortedE.length / 2)]
    const medY = sortedY[Math.floor(sortedY.length / 2)]
    const dots: Dot[] = validItems.map(i => ({
      x: PAD.left + (i.effort! / maxEffort) * INNER_W,
      y: PAD.top + (1 - (yAxis === 'rice' ? i.riceNumerator! : i.valueRating!) / maxY) * INNER_H,
      id: i.id, name: i.name, status: i.status,
    }))
    return { dots, medEffort, medY }
  }, [validItems, yAxis])

  const clusters = useMemo(() => buildClusters(dots), [dots])
  const medX = dots.length > 0 ? PAD.left + (medEffort / Math.max(...validItems.map(i => i.effort!), 1)) * INNER_W : W / 2
  const medYPx = dots.length > 0 ? PAD.top + (1 - medY / Math.max(...validItems.map(i => yAxis === 'rice' ? i.riceNumerator! : i.valueRating!), 1)) * INNER_H : H / 2

  function handleClusterClick(cluster: Cluster) {
    if (cluster.items.length === 1) {
      const item = cluster.items[0]
      if (item.kind === 'project' && onOpenProject) onOpenProject(item.id)
      else onOpenFeature(item.id)
    } else {
      setExpandedCluster(expandedCluster?.cx === cluster.cx ? null : cluster)
    }
  }

  if (validItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
        {/* Toggle always visible — even when empty */}
        <div className="flex items-center gap-1 bg-surface-100 rounded-lg p-0.5">
          {(['rice', 'value'] as YAxis[]).map(v => (
            <button key={v} onClick={() => setYAxis(v)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${yAxis === v ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
              {v === 'rice' ? 'RICE' : 'Business Value'}
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-500">
          {yAxis === 'rice' ? 'Score at least one item with RICE to see the quadrant.' : 'Rate at least one item with Business Value to see this view.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto tibbie-scroll p-4">
      <div className="relative max-w-2xl mx-auto">
        {/* Y-axis toggle + excluded note */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {excludedCount > 0 && (
              <span className="text-xs text-ink-400">{excludedCount} item{excludedCount > 1 ? 's' : ''} not rated (excluded)</span>
            )}
            {mustDoCount > 0 && (
              <span className="text-xs text-brick-500">{mustDoCount} Must-Do item{mustDoCount > 1 ? 's' : ''} not plotted</span>
            )}
          </div>
          <div className="flex items-center gap-1 bg-surface-100 rounded-lg p-0.5 ml-auto">
            {(['rice', 'value'] as YAxis[]).map(v => (
              <button key={v} onClick={() => { setYAxis(v); setExpandedCluster(null) }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${yAxis === v ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
                {v === 'rice' ? 'RICE' : 'Business Value'}
              </button>
            ))}
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-surface-200 rounded-xl bg-white" style={{ aspectRatio: `${W}/${H}` }}
          onClick={() => { setTooltip(null); setExpandedCluster(null) }}>
          <line x1={medX} y1={PAD.top} x2={medX} y2={PAD.top + INNER_H} stroke="#E8E7E4" strokeWidth={1} />
          <line x1={PAD.left} y1={medYPx} x2={PAD.left + INNER_W} y2={medYPx} stroke="#E8E7E4" strokeWidth={1} />
          <text x={PAD.left + 8} y={PAD.top + 14} fill="#8B8680" fontSize={11} fontWeight={600} letterSpacing={1} fontFamily="Manrope, system-ui">QUICK WINS</text>
          <text x={medX + 8} y={PAD.top + 14} fill="#8B8680" fontSize={11} fontWeight={600} letterSpacing={1} fontFamily="Manrope, system-ui">BIG BETS</text>
          <text x={PAD.left + 8} y={PAD.top + INNER_H - 8} fill="#8B8680" fontSize={11} fontWeight={600} letterSpacing={1} fontFamily="Manrope, system-ui">FILL-INS</text>
          <text x={medX + 8} y={PAD.top + INNER_H - 8} fill="#8B8680" fontSize={11} fontWeight={600} letterSpacing={1} fontFamily="Manrope, system-ui">MONEY PITS</text>
          {/* Axis labels */}
          <text x={PAD.left + INNER_W / 2} y={H - 6} textAnchor="middle" fill="#A8A29A" fontSize={10} fontFamily="Manrope">← Less effort · More effort →</text>
          <text x={12} y={PAD.top + INNER_H / 2} textAnchor="middle" fill="#A8A29A" fontSize={10} fontFamily="Manrope"
            transform={`rotate(-90, 12, ${PAD.top + INNER_H / 2})`}>
            {yAxis === 'rice' ? 'Reach × Impact × Conf% ↑' : 'Business Value ↑'}
          </text>
          {clusters.map((cluster, ci) => {
            const isSingle = cluster.items.length === 1
            const dotD = dots.find(d => d.id === cluster.items[0].id)
            return (
              <g key={ci}>
                {isSingle ? (
                  <circle cx={cluster.cx} cy={cluster.cy} r={DOT_R}
                    fill={dotColor(dotD?.status ?? '')}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={e => { e.stopPropagation(); handleClusterClick(cluster) }}
                    onMouseEnter={() => setTooltip({ x: cluster.cx, y: cluster.cy, name: cluster.items[0].name })}
                    onMouseLeave={() => setTooltip(null)} />
                ) : (
                  <g onClick={e => { e.stopPropagation(); handleClusterClick(cluster) }} className="cursor-pointer">
                    <circle cx={cluster.cx} cy={cluster.cy} r={DOT_R + 4} fill="#C65D3B" opacity={0.15} />
                    <circle cx={cluster.cx} cy={cluster.cy} r={DOT_R} fill="#C65D3B" />
                    <text x={cluster.cx} y={cluster.cy + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={8} fontWeight={700} fontFamily="JetBrains Mono, monospace">{cluster.items.length}</text>
                  </g>
                )}
              </g>
            )
          })}
          {tooltip && (
            <g>
              <rect x={Math.min(tooltip.x + 8, W - 170)} y={tooltip.y - 28} width={160} height={24} rx={4} fill="#171512" opacity={0.9} />
              <text x={Math.min(tooltip.x + 88, W - 10)} y={tooltip.y - 12} textAnchor="middle" fill="white" fontSize={11} fontFamily="Manrope">
                {tooltip.name.slice(0, 22)}{tooltip.name.length > 22 ? '…' : ''}
              </text>
            </g>
          )}
        </svg>

        {expandedCluster && (
          <div className="absolute bg-white rounded-xl shadow-float border border-surface-200 p-3 z-20 w-56 animate-scale-in"
            style={{ left: `${(expandedCluster.cx / W) * 100}%`, top: `${(expandedCluster.cy / H) * 100}%`, transform: 'translate(-50%, 8px)' }}
            onClick={e => e.stopPropagation()}>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-2">{expandedCluster.items.length} items</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {expandedCluster.items.map(item => (
                <button key={item.id} onClick={() => { item.kind === 'project' && onOpenProject ? onOpenProject(item.id) : onOpenFeature(item.id); setExpandedCluster(null) }}
                  className="w-full text-left text-sm text-ink-800 hover:text-rust-600 py-1 transition-colors truncate block">
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function QuadrantMobileFallback({ onOpenFeature }: { onOpenFeature: (id: string) => void }) {
  const { featuresV2, rankedItemIds } = useApp()
  const scored = featuresV2.filter(f => isValidRice(f.rice))
  const sorted = [...scored].sort((a, b) => {
    const sa = safeRiceScore(a.rice) ?? 0
    const sb = safeRiceScore(b.rice) ?? 0
    return sb - sa
  })
  const efforts = scored.map(f => (f.rice as any).effort as number)
  const nums = scored.map(f => { const r = f.rice!; return r.reach * r.impact * (r.confidence / 100) })
  const medEffort = [...efforts].sort((a,b)=>a-b)[Math.floor(efforts.length/2)] ?? 1
  const medNum = [...nums].sort((a,b)=>a-b)[Math.floor(nums.length/2)] ?? 1

  if (!scored.length) return <p className="p-4 text-sm text-ink-400 text-center">Score features to see the quadrant.</p>
  return (
    <div className="flex-1 overflow-y-auto tibbie-scroll p-4 space-y-1">
      {sorted.map(f => {
        const r = f.rice!; const effort = r.effort, num = r.reach * r.impact * (r.confidence / 100)
        const score = num / effort, label = quadrantLabel(effort, num, medEffort, medNum)
        const rank = rankedItemIds.indexOf(f.id) + 1
        return (
          <button key={f.id} onClick={() => onOpenFeature(f.id)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-surface-50 transition-colors text-left">
            <span className="font-mono text-xs text-ink-400 w-10">#{rank}</span>
            <span className="flex-1 text-sm text-ink-900 truncate">{f.name}</span>
            <span className="font-mono text-xs text-ink-500">{score.toFixed(1)}</span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${
              label === 'Quick Win' ? 'bg-forest-50 text-forest-600 border-forest-200' :
              label === 'Big Bet' ? 'bg-steel-50 text-steel-600 border-steel-200' :
              label === 'Fill-In' ? 'bg-surface-100 text-ink-500 border-surface-300' :
              'bg-brick-50 text-brick-500 border-brick-200'
            }`}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
