import { useLiveQuery } from "@tanstack/react-db"
import { useEffect } from "react"
import { DEFAULT_SETTINGS, type Settings } from "#/lib/types"
import { useSource } from "./source-context"

export const LOCAL_THEME_KEY = "checklist-theme"

// Runs before hydration on /local pages so the saved theme paints without a flash
export const localThemeScript = `try{if(location.pathname.startsWith('/local')){var t=JSON.parse(localStorage.getItem('${LOCAL_THEME_KEY}')||'null');if(t){document.documentElement.dataset.theme=t.theme;document.documentElement.dataset.mode=t.mode}}}catch(e){}`

export function useSettings(): Settings {
  const source = useSource()
  const { data } = useLiveQuery((q) => q.from({ s: source.settings }), [source])
  return data[0] ?? DEFAULT_SETTINGS
}

export function useApplyTheme() {
  const source = useSource()
  const { theme, mode } = useSettings()
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.mode = mode
    if (!source.slug) {
      try {
        localStorage.setItem(LOCAL_THEME_KEY, JSON.stringify({ theme, mode }))
      } catch {}
    }
  }, [theme, mode, source.slug])
}
