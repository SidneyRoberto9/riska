import type { ComponentProps } from "react"
import { tint } from "#/lib/status"
import type { Status } from "#/lib/types"

export function StatusChip({ status, className = "", ...props }: { status: Status } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      style={tint(status.color)}
      className={`inline-block rounded-md px-1.5 py-px align-[1px] text-[0.68rem] font-bold tracking-[.03em] ${className}`}
    >
      {status.name}
    </button>
  )
}
