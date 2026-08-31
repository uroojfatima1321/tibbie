import { useState, useRef } from 'react'

/**
 * Keeps a local draft while a text field is focused.
 * Commits to the store only on blur (single-line: also on Enter).
 * Ignores incoming server/query updates while focused.
 *
 * BUG-CR2-004 fix: prevents React Query cache refetches from clobbering
 * in-progress keystrokes when fields are bound directly to store values.
 *
 * Usage:
 *   const d = useDraftField(project.oneLiner, v => updateProject(id, { oneLiner: v }))
 *   <textarea {...d.textareaProps} />
 *   <input    {...d.inputProps}    />   // also handles Enter + Escape
 */
export function useDraftField(
  serverValue: string | undefined | null,
  onCommit: (value: string) => void,
) {
  const [draft, setDraft] = useState<string | null>(null)

  // Use refs to avoid stale-closure issues in blur/keydown handlers
  const draftRef = useRef<string | null>(null)
  const serverRef = useRef<string>(serverValue ?? '')
  // Always track latest server value (used by blur to detect actual changes)
  serverRef.current = serverValue ?? ''

  // While focused: show draft. While blurred: show server value.
  const value = draft !== null ? draft : serverRef.current

  function handleFocus() {
    const init = serverRef.current
    draftRef.current = init
    setDraft(init)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const v = e.target.value
    draftRef.current = v
    setDraft(v)
  }

  function commitAndClear() {
    const d = draftRef.current
    draftRef.current = null
    setDraft(null)
    if (d !== null && d !== serverRef.current) {
      onCommit(d)
    }
  }

  function discardAndClear() {
    draftRef.current = null
    setDraft(null)
  }

  function handleBlur() {
    commitAndClear()
  }

  /** Only for single-line <input> — Enter commits, Escape discards. */
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commitAndClear() }
    if (e.key === 'Escape') { e.preventDefault(); discardAndClear(); (e.target as HTMLInputElement).blur() }
  }

  return {
    /** Spread on a <textarea> — Enter inserts newline, blur commits. */
    textareaProps: {
      value,
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
    },
    /** Spread on a single-line <input> — Enter commits, Escape discards. */
    inputProps: {
      value,
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
    },
    // Expose individually for cases needing custom assembly
    value,
    onChange: handleChange,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    /** True when the field has been edited and not yet committed (draft ≠ server value). */
    isDirty: draft !== null && draft !== serverRef.current,
  }
}
