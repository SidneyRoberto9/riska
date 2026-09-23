import { useRef, useState } from 'react'

// Click to edit; Enter or blur saves, Esc cancels. Empty value is ignored when `required`.
export function InlineEdit({
  value,
  onSave,
  placeholder = '',
  className = '',
  multiline = false,
  required = false,
  maxLength,
  startEditing = false,
  onDone,
}: {
  value: string
  onSave: (value: string) => void
  placeholder?: string
  className?: string
  multiline?: boolean
  required?: boolean
  maxLength?: number
  startEditing?: boolean
  onDone?: () => void
}) {
  const [editing, setEditing] = useState(startEditing)
  const [draft, setDraft] = useState(value)
  const cancelled = useRef(false)

  if (!editing) {
    return (
      <button
        type="button"
        className={`inline cursor-text text-left break-words ${className}`}
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
      >
        {value || <span className="text-ink-soft opacity-70">{placeholder}</span>}
      </button>
    )
  }

  const commit = () => {
    setEditing(false)
    onDone?.()
    if (cancelled.current) {
      cancelled.current = false
      return
    }
    const v = draft.trim()
    if (v !== value && (v || !required)) onSave(v)
  }

  const props = {
    autoFocus: true,
    value: draft,
    maxLength,
    placeholder,
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        cancelled.current = true
        e.currentTarget.blur()
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        e.currentTarget.blur()
      }
    },
    className: `block w-full rounded-md bg-accent-soft/60 px-1 -mx-1 outline-2 outline-accent/40 ${className}`,
  }

  return multiline ? <textarea rows={1} {...props} className={`${props.className} resize-none field-sizing-content`} /> : <input {...props} />
}
