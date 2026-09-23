import { Settings2 } from "lucide-react"
import { useSource } from "#/data/source-context"
import { DeleteSession } from "./DeleteSession"
import { Popover } from "./Popover"
import { ShareLink } from "./ShareLink"
import { ThemePicker } from "./ThemePicker"

export function SettingsButton() {
  const source = useSource()
  return (
    <Popover
      className="w-72 space-y-4 p-3"
      trigger={(p) => (
        <button
          {...p}
          aria-label="Configurações"
          className="grid size-10 place-items-center rounded-xl text-ink-soft hover:bg-accent-soft hover:text-accent"
        >
          <Settings2 size={20} aria-hidden />
        </button>
      )}
    >
      {() => (
        <>
          <ThemePicker />
          {source.slug && <ShareLink slug={source.slug} />}
          {source.slug && <DeleteSession slug={source.slug} />}
        </>
      )}
    </Popover>
  )
}
