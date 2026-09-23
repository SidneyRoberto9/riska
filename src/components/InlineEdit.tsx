import { useRef, useState } from 'react'
import { VoiceButton } from './VoiceButton'

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
  label,
  voice,
  viewClassName = 'inline',
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
  /** Accessible name for the field while editing */
  label?: string
  /** Shows a dictation button while editing, labelled with this text */
  voice?: string
  /** Display-mode classes (default `inline`), e.g. `block line-clamp-2` */
  viewClassName?: string
}) {
  const [editing, setEditing] = useState(startEditing)
  const [draft, setDraft] = useState(value)
  const cancelled = useRef(false)

  if (!editing) {
    return (
      <button
        type="button"
        className={`${viewClassName} cursor-text text-left break-words ${className}`}
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
    'aria-label': label,
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
    className: `block w-full min-w-0 rounded-md bg-accent-soft/60 px-1 -mx-1 outline-2 outline-accent/40 ${className}`,
  }

  const field = multiline ? (
    <textarea rows={1} {...props} className={`${props.className} resize-none field-sizing-content`} />
  ) : (
    <input {...props} />
  )
  if (!voice) return field
  return (
    <span className="flex items-start gap-1">
      {field}
      <VoiceButton value={draft} onChange={setDraft} label={voice} />
    </span>
  )
}
