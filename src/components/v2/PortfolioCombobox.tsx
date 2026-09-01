import { useState, useRef } from 'react'
import { Popover } from '../ui/Popover'

interface Props {
  value: string
  onChange: (v: string) => void
  options: string[]                  // existing portfolio names
  onCommit?: () => void              // blur/Enter commits (drawer mode)
  onCancel?: () => void              // Esc cancels (drawer mode)
  autoFocus?: boolean
  placeholder?: string
  className?: string
}

/**
 * Shared portfolio combobox — used in ProjectDrawer (inline click-to-edit)
 * and RoadmapBulkBar ("Move to portfolio" panel).
 *
 * In drawer mode: pass onCommit + onCancel; blur/Enter auto-commits.
 * In bulk-bar mode: pass only onChange; caller drives commit via a separate button.
 *
 * Dropdown migrated to Popover primitive (B2 commit 2).
 */
export function PortfolioCombobox({
  value, onChange, options,
  onCommit, onCancel,
  autoFocus = true,
  placeholder = 'Portfolio name',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = options.filter(o =>
    o.toLowerCase().includes(value.toLowerCase()) && o !== value
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      setOpen(false)
      onCommit?.()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      onCancel?.()
    }
  }

  function handleBlur() {
    setTimeout(() => {
      if (!inputRef.current || document.activeElement === inputRef.current) return
      setOpen(false)
      onCommit?.()
    }, 80)
  }

  function selectOption(opt: string) {
    onChange(opt)
    setOpen(false)
    onCommit?.()
    setTimeout(() => inputRef.current?.blur(), 0)
  }

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        autoFocus={autoFocus}
        type="text"
        className="input text-xs !py-0.5 w-full"
        placeholder={placeholder}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      <Popover
        triggerRef={inputRef as unknown as React.RefObject<HTMLElement>}
        open={open && filtered.length > 0}
        onOpenChange={setOpen}
        placement="bottom-start"
        className="w-full min-w-[160px] py-1"
      >
        {filtered.map(opt => (
          <button
            key={opt}
            type="button"
            className="w-full text-left px-3 py-1.5 text-xs text-ink-700 hover:bg-surface-50 transition-colors"
            onMouseDown={e => e.preventDefault()}
            onClick={() => selectOption(opt)}
          >
            {opt}
          </button>
        ))}
      </Popover>
    </div>
  )
}
