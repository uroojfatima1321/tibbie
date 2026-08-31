import { useApp } from '../../store/context'

interface Props {
  value: 1 | 2 | 3 | 4 | 5 | undefined
  editable?: boolean
  onSet?: (v: 1 | 2 | 3 | 4 | 5 | undefined) => void
  size?: 'sm' | 'md'
}

/** 5-dot Business Value rating. Click in edit mode to set/clear. */
export function ValueDots({ value, editable = false, onSet, size = 'sm' }: Props) {
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
  const gap = size === 'sm' ? 'gap-0.5' : 'gap-1'

  return (
    <span className={`inline-flex items-center ${gap}`} aria-label={`Business value: ${value ?? 'unset'} of 5`}>
      {([1, 2, 3, 4, 5] as const).map(n => (
        <button
          key={n}
          type="button"
          disabled={!editable}
          onClick={e => {
            e.stopPropagation()
            if (!editable || !onSet) return
            onSet(value === n ? undefined : n)
          }}
          title={editable ? (value === n ? 'Clear rating' : `Set to ${n}`) : `${n} / 5`}
          className={`${dotSize} rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-rust-300 ${
            value !== undefined && n <= value
              ? 'bg-rust-500'
              : 'bg-surface-300'
          } ${editable ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
        />
      ))}
    </span>
  )
}

/** Used in table cells — connects directly to context */
export function ValueDotsCell({
  itemId,
  kind,
  value,
}: {
  itemId: string
  kind: 'project' | 'feature' | 'module'   // Fix 1 R2-C1: modules scoreable
  value: 1 | 2 | 3 | 4 | 5 | undefined
}) {
  const { editMode, updateProjectV2, updateFeatureV2, updateModuleV2 } = useApp()
  async function handleSet(v: 1 | 2 | 3 | 4 | 5 | undefined) {
    if (kind === 'project') await updateProjectV2(itemId, { valueRating: v })
    else if (kind === 'module') await updateModuleV2(itemId, { valueRating: v })
    else await updateFeatureV2(itemId, { valueRating: v })
  }
  return <ValueDots value={value} editable={editMode} onSet={handleSet} />
}
