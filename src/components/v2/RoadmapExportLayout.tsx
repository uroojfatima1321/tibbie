import { isValidRice, safeRiceScore } from '../../lib/filterV2'
import type { ProjectV2, FeatureV2, Member } from '../../types'
import type { RiceScore } from '../../types'

function riceScore(rice: RiceScore) {
  return (rice.reach * rice.impact * (rice.confidence / 100)) / rice.effort
}

const STATUS_EXPORT_COLORS: Record<string, string> = {
  intake: '#E8E7E4', requirement_gathering: '#3A6B8A', requirement_analysis: '#2D5470',
  architecture: '#232B3A', development: '#3A6B8A', in_testing: '#C8932F',
  beta_production: '#4F7C66', production: '#2F5743', production_monitoring: '#234433',
  mvp_live: '#4F7C66', on_hold: '#8B8680', killed: '#8A2F23',
}
const STATUS_EXPORT_LABELS: Record<string, string> = {
  intake: 'Intake', requirement_gathering: 'Req. Gathering', requirement_analysis: 'Req. Analysis',
  architecture: 'Architecture & Req.', development: 'Development', in_testing: 'In Testing',
  beta_production: 'Beta', production: 'Production', production_monitoring: 'Prod. Monitoring',
  mvp_live: 'MVP Live', on_hold: 'On Hold', killed: 'Killed',
}

interface ExportPortfolio {
  name: string
  projects: ProjectV2[]
}

interface Props {
  portfolios: ExportPortfolio[]
  features: FeatureV2[]
  members: Member[]
  quarter?: string
}

export function RoadmapExportLayout({ portfolios, features, members, quarter }: Props) {
  const now = new Date()
  const heading = quarter ?? `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`
  const featsByProject = Object.fromEntries(
    portfolios.flatMap(p => p.projects).map(p => [
      p.id,
      features.filter(f => f.projectId === p.id),
    ])
  )

  return (
    <div
      id="tibbie-export-root"
      style={{
        position: 'absolute', left: -9999, top: 0, zIndex: -1,
        width: 1280, background: '#FFFFFF',
        fontFamily: 'Manrope, system-ui, sans-serif',
        color: '#171512',
      }}
    >
      {/* Header */}
      <div style={{ padding: '48px 64px 32px', borderBottom: '1px solid #E8E7E4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 32, fontFamily: 'Fraunces, Georgia, serif', fontWeight: 600, color: '#171512', fontStyle: 'italic', marginBottom: 4 }}>
              tibbie<span style={{ color: '#C65D3B' }}>.</span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#171512', margin: 0 }}>
              {heading} · Product Roadmap
            </h1>
          </div>
          <div style={{ fontSize: 12, color: '#8B8680' }}>
            Generated {now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Portfolio sections */}
      {portfolios.map((portfolio, pi) => (
        <div key={portfolio.name} style={{ padding: '40px 64px 24px', pageBreakBefore: pi > 0 ? 'always' : 'auto' }}>
          <h2 style={{
            fontSize: 18, fontFamily: 'Fraunces, Georgia, serif', fontWeight: 600,
            color: '#171512', marginBottom: 24, paddingBottom: 12,
            borderBottom: '2px solid #E8E7E4',
          }}>
            {portfolio.name}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {portfolio.projects.map((project, i) => {
              const pFeatures = featsByProject[project.id] || []
              const scoredFs = pFeatures.filter(f => isValidRice(f.rice))
              const topRice = scoredFs.length ? Math.max(...scoredFs.map(f => safeRiceScore(f.rice) ?? 0)) : null
              const nextMs = project.milestones
                .filter(m => m.status === 'upcoming' && m.date >= new Date().toISOString().slice(0, 10))
                .sort((a, b) => a.date.localeCompare(b.date))[0]

              const statusColor = STATUS_EXPORT_COLORS[project.status] || '#8B8680'
              const statusLabel = STATUS_EXPORT_LABELS[project.status] || project.status.replace(/_/g, ' ')

              return (
                <div key={project.id} style={{
                  background: '#FFFFFF',
                  border: '1px solid #E8E7E4',
                  borderLeft: `4px solid ${statusColor}`,
                  borderRadius: 12,
                  padding: 16,
                  boxShadow: '0 1px 3px rgba(23,21,18,0.06)',
                }}>
                  {/* Card number + name */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#A8A29A', flexShrink: 0, marginTop: 2 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#171512', lineHeight: 1.3 }}>{project.name}</span>
                  </div>

                  {/* Status pill */}
                  <div style={{
                    display: 'inline-block',
                    background: statusColor, color: '#FFFFFF',
                    borderRadius: 20, padding: '3px 10px',
                    fontSize: 11, fontWeight: 500, marginBottom: 10,
                  }}>
                    {statusLabel}
                  </div>
                  {project.status === 'on_hold' && project.holdReason && (
                    <span style={{ fontSize: 10, color: '#8B8680', marginLeft: 6 }}>· {project.holdReason}</span>
                  )}

                  {/* One-liner */}
                  {project.oneLiner && (
                    <p style={{ fontSize: 12, color: '#57524C', lineHeight: 1.5, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {project.oneLiner}
                    </p>
                  )}

                  {/* Meta */}
                  <div style={{ fontSize: 11, color: '#8B8680', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {pFeatures.length > 0 && (
                      <span>◇ {pFeatures.length} feature{pFeatures.length !== 1 ? 's' : ''}{topRice !== null ? ` · Top RICE ${topRice.toFixed(1)}` : ''}</span>
                    )}
                    {nextMs && (
                      <span>▸ Next: {nextMs.name} — {new Date(nextMs.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                        {project.effortEstimate && `${project.effortEstimate}`}
                        {project.effortEstimate && project.targetQuarter && ' · '}
                        {project.targetQuarter && project.targetQuarter}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Wordmark */}
      <div style={{ padding: '24px 64px', borderTop: '1px solid #E8E7E4', display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 14, fontStyle: 'italic', color: '#A8A29A' }}>
          tibbie<span style={{ color: '#C65D3B' }}>.</span>
        </span>
      </div>
    </div>
  )
}
