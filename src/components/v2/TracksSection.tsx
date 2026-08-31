import { useState } from 'react'
import { Plus, Trash2, ChevronDown } from 'lucide-react'
import type { ProjectV2, TrackKind, DepartmentTrack } from '../../types'
import { useApp } from '../../store/context'
import { ConfirmDialog as Confirm } from '../ui/Confirm'
import { Avatar } from '../members/Avatar'

type TrackKindNonEng = Exclude<TrackKind, 'engineering'>

const TRACK_LADDERS: Record<TrackKindNonEng, string[]> = {
  marketing: ['not_started', 'positioning', 'collateral_ready', 'launched'],
  sales: ['not_started', 'deck_pricing_ready', 'team_trained', 'selling'],
  support: ['not_started', 'docs_written', 'team_trained', 'live'],
  implementation: ['not_started', 'deployment_plan', 'pilot_client', 'rolled_out'],
}

const TRACK_LABELS: Record<TrackKindNonEng, string> = {
  marketing: 'Marketing',
  sales: 'Sales',
  support: 'Support',
  implementation: 'Implementation',
}

const TRACK_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started',
  positioning: 'Positioning', collateral_ready: 'Collateral ready', launched: 'Launched',
  deck_pricing_ready: 'Deck & pricing ready', team_trained: 'Team trained', selling: 'Selling',
  docs_written: 'Docs written', live: 'Live',
  deployment_plan: 'Deployment plan', pilot_client: 'Pilot client', rolled_out: 'Rolled out',
}

interface Props {
  project: ProjectV2
}

export function TracksSection({ project }: Props) {
  const { data, editMode, addProjectV2Track, updateProjectV2Track, removeProjectV2Track } = useApp()
  const members = data?.members || []
  const [addPickerOpen, setAddPickerOpen] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState<TrackKindNonEng | null>(null)
  const [blockErrors, setBlockErrors] = useState<Record<string, string>>({})
  // BUG-CR2-004: local note drafts — typed value held locally, committed on blur
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string | null>>({})

  function noteDisplayValue(track: DepartmentTrack) {
    const d = noteDrafts[track.kind]
    return d !== null && d !== undefined ? d : (track.note ?? '')
  }

  function handleNoteFocus(track: DepartmentTrack) {
    setNoteDrafts(prev => ({ ...prev, [track.kind]: track.note ?? '' }))
  }

  function handleNoteChange(track: DepartmentTrack, note: string) {
    setNoteDrafts(prev => ({ ...prev, [track.kind]: note }))
    if (blockErrors[track.kind] && note.trim()) {
      setBlockErrors(prev => ({ ...prev, [track.kind]: '' }))
    }
    // No KV write here — commit on blur only
  }

  function handleNoteBlur(track: DepartmentTrack) {
    const draft = noteDrafts[track.kind]
    setNoteDrafts(prev => ({ ...prev, [track.kind]: null }))
    if (draft !== null && draft !== undefined && draft !== (track.note ?? '')) {
      updateProjectV2Track(project.id, track.kind as TrackKindNonEng, {
        note: draft,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  const presentKinds = new Set(project.tracks.map(t => t.kind))
  const availableKinds = (['marketing', 'sales', 'support', 'implementation'] as TrackKindNonEng[]).filter(k => !presentKinds.has(k))

  async function addTrack(kind: TrackKindNonEng) {
    const now = new Date().toISOString()
    await addProjectV2Track(project.id, {
      kind,
      status: 'not_started',
      ownerIds: [],
      blocked: false,
      updatedAt: now,
      statusLog: [{ id: crypto.randomUUID(), from: '', to: 'not_started', at: now }],
    })
    setAddPickerOpen(false)
  }

  async function handleRemove(kind: TrackKindNonEng) {
    await removeProjectV2Track(project.id, kind)
    setRemoveConfirm(null)
  }

  async function handleStatusChange(track: DepartmentTrack, newStatus: string) {
    const now = new Date().toISOString()
    await updateProjectV2Track(project.id, track.kind as TrackKindNonEng, {
      status: newStatus,
      statusLog: [...track.statusLog, { id: crypto.randomUUID(), from: track.status, to: newStatus, at: now }],
      updatedAt: now,
    })
  }

  async function handleBlockedToggle(track: DepartmentTrack) {
    const next = !track.blocked
    if (next && !track.note?.trim()) {
      setBlockErrors(prev => ({ ...prev, [track.kind]: 'Blocked needs a reason' }))
      return
    }
    setBlockErrors(prev => ({ ...prev, [track.kind]: '' }))
    await updateProjectV2Track(project.id, track.kind as TrackKindNonEng, { blocked: next, updatedAt: new Date().toISOString() })
  }

  function toggleOwner(track: DepartmentTrack, memberId: string) {
    const next = track.ownerIds.includes(memberId)
      ? track.ownerIds.filter(id => id !== memberId)
      : [...track.ownerIds, memberId]
    updateProjectV2Track(project.id, track.kind as TrackKindNonEng, { ownerIds: next, updatedAt: new Date().toISOString() })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">Tracks</p>
        {editMode && availableKinds.length > 0 && (
          <div className="relative">
            <button onClick={() => setAddPickerOpen(v => !v)}
              className="flex items-center gap-1 text-xs text-ink-400 hover:text-rust-500 transition-colors focus:outline-none focus:ring-1 focus:ring-rust-200 rounded">
              <Plus size={12} /> Add track
            </button>
            {addPickerOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-surface-200 rounded-xl shadow-float z-20 py-1 animate-scale-in">
                {availableKinds.map(k => (
                  <button key={k} onClick={() => addTrack(k)}
                    className="w-full text-left px-3 py-2 text-sm text-ink-700 hover:bg-surface-50 transition-colors">
                    {TRACK_LABELS[k]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Engineering row — read-only */}
      <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-surface-50 border border-surface-200 mb-2">
        <span className="text-xs font-medium text-ink-600 w-24 shrink-0">Engineering</span>
        <span className="flex-1 text-xs text-ink-500">{project.status.replace(/_/g, ' ')}</span>
        <span className="text-[10px] text-ink-400 italic">Change via status pill above</span>
      </div>

      {/* Department tracks */}
      {project.tracks.length === 0 ? (
        <p className="text-xs text-ink-400 py-1">{editMode ? 'Add department tracks to track launch readiness.' : 'No department tracks.'}</p>
      ) : (
        <div className="space-y-2">
          {project.tracks.map(track => {
            const kind = track.kind as TrackKindNonEng
            const ladder = TRACK_LADDERS[kind] || []
            const owners = members.filter(m => track.ownerIds.includes(m.id))
            const err = blockErrors[kind]

            return (
              <div key={kind} className={`rounded-xl border p-3 space-y-2 ${track.blocked ? 'border-brick-300 bg-brick-50/30' : 'border-surface-200 bg-white'}`}>
                {/* Header row */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-ink-800 w-24 shrink-0">{TRACK_LABELS[kind]}</span>

                  {/* Status dropdown */}
                  {editMode ? (
                    <select className="text-xs border border-surface-200 rounded bg-white px-2 py-0.5 outline-none focus:ring-1 focus:ring-rust-400 flex-1"
                      value={track.status}
                      onChange={e => handleStatusChange(track, e.target.value)}>
                      {ladder.map(s => (
                        <option key={s} value={s}>{TRACK_STATUS_LABELS[s] ?? s}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-ink-600 flex-1">{TRACK_STATUS_LABELS[track.status] ?? track.status}</span>
                  )}

                  {/* Blocked toggle */}
                  {editMode && (
                    <button
                      onClick={() => handleBlockedToggle(track)}
                      className={`shrink-0 text-[10px] px-2 py-0.5 rounded border font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-rust-200 ${track.blocked ? 'bg-brick-500 text-white border-brick-500' : 'bg-white text-ink-400 border-surface-200 hover:border-brick-300'}`}
                      title={track.blocked ? 'Blocked — click to unblock' : 'Mark as blocked'}>
                      {track.blocked ? 'Blocked' : 'Block'}
                    </button>
                  )}
                  {!editMode && track.blocked && (
                    <span className="text-[10px] text-brick-500 border border-brick-300 px-2 py-0.5 rounded font-medium">Blocked</span>
                  )}

                  {/* Remove */}
                  {editMode && (
                    <button onClick={() => setRemoveConfirm(kind)} className="shrink-0 p-1 text-ink-300 hover:text-brick-500 transition-colors focus:outline-none focus:ring-1 focus:ring-rust-200 rounded"
                      aria-label={`Remove ${TRACK_LABELS[kind]} track`}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                {/* Blocked note */}
                {editMode && (track.blocked || track.note) && (
                  <div>
                    <textarea
                      className={`input w-full text-xs min-h-[40px] ${err ? 'border-brick-500' : ''}`}
                      placeholder="Blocker / context note (required when blocked)…"
                      maxLength={200}
                      value={noteDisplayValue(track)}
                      onChange={e => handleNoteChange(track, e.target.value)}
                      onFocus={() => handleNoteFocus(track)}
                      onBlur={() => handleNoteBlur(track)}
                    />
                    {err && <p className="text-[10px] text-brick-500 mt-0.5">{err}</p>}
                  </div>
                )}
                {!editMode && track.note && (
                  <p className="text-xs text-ink-500 italic">{track.note}</p>
                )}

                {/* Owner picker */}
                {editMode && members.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {owners.map(m => (
                      <button key={m.id} onClick={() => toggleOwner(track, m.id)} className="focus:outline-none focus:ring-1 focus:ring-rust-200 rounded-full">
                        <Avatar member={m} size="xs" />
                      </button>
                    ))}
                    <div className="relative group">
                      <select className="text-[10px] border border-surface-200 rounded bg-white px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-rust-400 text-ink-400"
                        value=""
                        onChange={e => { if (e.target.value) toggleOwner(track, e.target.value); e.target.value = '' }}>
                        <option value="">+ Owner</option>
                        {members.filter(m => !track.ownerIds.includes(m.id)).map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {!editMode && owners.length > 0 && (
                  <div className="flex items-center gap-1">
                    {owners.map(m => <Avatar key={m.id} member={m} size="xs" />)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Remove confirm */}
      <Confirm
        open={removeConfirm !== null}
        title={`Remove ${removeConfirm ? TRACK_LABELS[removeConfirm] : ''} track`}
        message="Removes its status history too. This is recorded in the project log."
        onConfirm={() => removeConfirm && handleRemove(removeConfirm)}
        onClose={() => setRemoveConfirm(null)}
        danger
      />
    </div>
  )
}
