import type { ReactNode } from "react"
import type { Status, Task } from "#/lib/types"
import { Popover, type TriggerProps } from "./Popover"
import { StatusOptions } from "./StatusOptions"

export function StatusPicker({
  task,
  statuses,
  trigger,
}: {
  task: Task
  statuses: Status[]
  trigger: (p: TriggerProps) => ReactNode
}) {
  return (
    <Popover className="min-w-52 p-1" trigger={trigger}>
      {(close) => <StatusOptions task={task} statuses={statuses} onDone={close} />}
    </Popover>
  )
}
