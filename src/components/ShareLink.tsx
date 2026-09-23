import { Check, Link2 } from "lucide-react"
import { useState } from "react"

export function ShareLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${location.origin}/s/${slug}`
        try {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          window.prompt("Copie o link:", url)
        }
      }}
      className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-line font-semibold hover:bg-accent-soft"
    >
      {copied ? <Check size={16} aria-hidden className="text-done" /> : <Link2 size={16} aria-hidden />}
      <span aria-live="polite">{copied ? "Link copiado" : "Copiar link da sessão"}</span>
    </button>
  )
}
