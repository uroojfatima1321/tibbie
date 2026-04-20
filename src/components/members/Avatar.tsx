import type { Member } from '../../types'
import { initials } from '../../lib/util'

interface Props {
  member: Member
  size?: 'xs' | 'sm' | 'md' | 'lg'
  title?: string
}

const SIZES = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
}

export function Avatar({ member, size = 'sm', title }: Props) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 ring-1 ring-cream-50 ${SIZES[size]}`}
      style={{ backgroundColor: member.color }}
      title={title || member.name}
    >
      {initials(member.name)}
    </span>
  )
}

export function AvatarStack({ members, max = 3, size = 'sm' }: { members: Member[]; max?: number; size?: Props['size'] }) {
  const shown = members.slice(0, max)
  const extra = members.length - shown.length
  return (
    <div className="flex -space-x-1.5">
      {shown.map(m => <Avatar key={m.id} member={m} size={size} />)}
      {extra > 0 && (
        <span className={`inline-flex items-center justify-center rounded-full bg-cream-200 text-ink-600 font-semibold ${SIZES[size || 'sm']} ring-1 ring-cream-50`}>
          +{extra}
        </span>
      )}
    </div>
  )
}
