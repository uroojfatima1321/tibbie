import { useState, useRef } from 'react'

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
    // Blur fires AFTER mousedown on dropdown options (which call e.preventDefault()).
    // So if blur fires naturally (not from option click), commit.
    // Use a tiny timeout to let option mousedown settle first.
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
    // Re-focus input so the component remains controlled until blur
    setTimeout(() => inputRef.current?.blur(), 0)
  }

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
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
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[160px] bg-white border border-surface-200 rounded-xl shadow-float z-50 py-1 max-h-48 overflow-y-auto">
          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs text-ink-700 hover:bg-surface-50 transition-colors"
              // onMouseDown prevents input blur before the click registers
              onMouseDown={e => e.preventDefault()}
              onClick={() => selectOption(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
