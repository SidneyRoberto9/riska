import { Check, Monitor, Moon, Sun } from "lucide-react"
import { useActions } from "#/data/actions"
import { useSettings } from "#/data/theme"
import { MODES, THEMES } from "#/lib/types"
import { label } from "./settingsStyles"

const modeIcons = { light: Sun, dark: Moon, system: Monitor }

export function ThemePicker() {
  const { theme, mode } = useSettings()
  const a = useActions()
  return (
    <>
      <div>
        <p className={label}>Tema</p>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.label}
              aria-label={t.label}
              aria-pressed={theme === t.id}
              onClick={() => a.setSettings({ theme: t.id })}
              className="grid size-10 place-items-center rounded-full text-white ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-ink"
              style={{ background: t.swatch }}
            >
              {theme === t.id && <Check size={18} strokeWidth={3} aria-hidden />}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className={label}>Modo</p>
        <div className="grid grid-cols-3 gap-0.5 rounded-lg border border-line p-0.5">
          {MODES.map((m) => {
            const Icon = modeIcons[m.id]
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={mode === m.id}
                onClick={() => a.setSettings({ mode: m.id })}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-md aria-pressed:bg-accent-soft aria-pressed:font-semibold aria-pressed:text-accent"
              >
                <Icon size={15} aria-hidden />
                {m.label}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
