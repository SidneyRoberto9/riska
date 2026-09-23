import { Plus } from "lucide-react"
import { useActions } from "#/data/actions"
import { COLUMN_W } from "./boardStyles"
import { Popover } from "./Popover"
import { StatusEditor } from "./StatusEditor"

export function BoardNewColumn({ pageId }: { pageId: string }) {
  const a = useActions()
  return (
    <Popover
      trigger={(p) => (
        <button
          {...p}
          className={`flex min-h-12 ${COLUMN_W} shrink-0 snap-start items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-sm font-semibold text-ink-soft hover:border-accent hover:text-accent`}
        >
          <Plus size={16} aria-hidden />
          Nova coluna
        </button>
      )}
    >
      {(close) => (
        <StatusEditor
          onSave={(v) => {
            a.addStatus(pageId, v)
            close()
          }}
        />
      )}
    </Popover>
  )
}
