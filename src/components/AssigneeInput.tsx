import { useId } from "react"
import { LIMITS } from "#/lib/types"
import { FIELD } from "./fieldStyles"

// Free text with the page's existing names as native suggestions
export function AssigneeInput({
  id,
  value,
  onChange,
  options,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  const listId = useId()
  return (
    <>
      <input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={LIMITS.assignee}
        autoComplete="off"
        placeholder="Quem cuida disso?"
        className={FIELD}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  )
}
