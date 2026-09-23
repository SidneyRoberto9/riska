import { createContext, useContext } from "react"
import type { Source } from "./source"

export const SourceContext = createContext<Source | null>(null)

export function useSource() {
  const source = useContext(SourceContext)
  if (!source) {
    throw new Error("useSource outside SourceContext")
  }
  return source
}
