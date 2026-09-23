import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import type { Source } from "#/data/source"

// Same UI serves /local and /s/$slug; these keep the typed router links in one place
export function PageLink({
  source,
  pageId,
  className,
  children,
}: {
  source: Source
  pageId: string
  className?: string
  children: ReactNode
}) {
  return source.slug ? (
    <Link to="/s/$slug/p/$pageId" params={{ slug: source.slug, pageId }} className={className}>
      {children}
    </Link>
  ) : (
    <Link to="/local/p/$pageId" params={{ pageId }} className={className}>
      {children}
    </Link>
  )
}
