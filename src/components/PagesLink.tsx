import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import type { Source } from "#/data/source"

export function PagesLink({
  source,
  className,
  children,
}: {
  source: Source
  className?: string
  children: ReactNode
}) {
  return source.slug ? (
    <Link to="/s/$slug" params={{ slug: source.slug }} className={className}>
      {children}
    </Link>
  ) : (
    <Link to="/local" className={className}>
      {children}
    </Link>
  )
}
