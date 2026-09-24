import { useEffect, useReducer, useRef } from "react"
import { useToast } from "#/components/ToastProvider"
import { checkImage, IMAGE_ERRORS, MAX_IMAGES_PER_TASK } from "#/lib/images"
import { nextPosition } from "#/lib/order"
import { LIMITS } from "#/lib/types"
import { createUploadFn } from "#/server/attachments"
import { useActions } from "./actions"
import { useSource } from "./source-context"

export type Upload = {
  key: string
  file: File
  preview: string
  progress: number
  state: "pending" | "uploading" | "error"
}

let seq = 0

function put(url: string, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", file.type)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(e.loaded / e.total)
      }
    }
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`PUT ${xhr.status}`)))
    xhr.onerror = () => reject(new Error("PUT failed"))
    xhr.send(file)
  })
}

// Files picked for one task: validated on add, sent one at a time by start(); done items leave the list
// (the attachment row then shows up through the collection). The ref is the source of truth so start()
// right after add() sees the new files.
export function useUploads() {
  const source = useSource()
  const a = useActions()
  const toast = useToast()
  const items = useRef<Upload[]>([])
  const running = useRef<Promise<boolean> | null>(null)
  const [, render] = useReducer((n: number) => n + 1, 0)
  const set = (next: Upload[]) => {
    items.current = next
    render()
  }
  const patch = (key: string, changes: Partial<Upload>) =>
    set(items.current.map((u) => (u.key === key ? { ...u, ...changes } : u)))
  const drop = (key: string) => {
    const u = items.current.find((x) => x.key === key)
    if (u) {
      URL.revokeObjectURL(u.preview)
    }
    set(items.current.filter((x) => x.key !== key))
  }

  useEffect(
    () => () =>
      items.current.forEach((u) => {
        URL.revokeObjectURL(u.preview)
      }),
    []
  )

  const send = async (u: Upload, task: { id: string; pageId: string }) => {
    patch(u.key, { state: "uploading", progress: 0 })
    try {
      const { id, url } = await createUploadFn({
        data: { slug: source.slug ?? "", contentType: u.file.type, size: u.file.size },
      })
      await put(url, u.file, (progress) => patch(u.key, { progress }))
      const existing = [...source.attachments.values()].filter((x) => x.taskId === task.id)
      await a.addAttachment({
        id,
        taskId: task.id,
        pageId: task.pageId,
        name: u.file.name.slice(0, LIMITS.fileName),
        contentType: u.file.type,
        size: u.file.size,
        position: nextPosition(existing),
      })
      drop(u.key)
    } catch {
      patch(u.key, { state: "error" })
    }
  }

  return {
    items: items.current,
    busy: items.current.some((u) => u.state === "uploading"),
    add(files: File[], existing: number) {
      const room = MAX_IMAGES_PER_TASK - existing - items.current.length
      const ok: Upload[] = []
      for (const file of files) {
        const problem = checkImage(file.type, file.size)
        if (problem) {
          toast(`${file.name}: ${IMAGE_ERRORS[problem]}`)
        } else if (ok.length >= room) {
          toast(`Máximo de ${MAX_IMAGES_PER_TASK} imagens por tarefa.`)
          break
        } else {
          ok.push({ key: String(++seq), file, preview: URL.createObjectURL(file), progress: 0, state: "pending" })
        }
      }
      set([...items.current, ...ok])
    },
    remove: drop,
    // Sends pending and failed items in order; resolves true when nothing is left in error.
    // A second call while running joins the same run (which also picks up files added meanwhile).
    start(task: { id: string; pageId: string }) {
      if (!running.current) {
        running.current = sendAll(task).finally(() => {
          running.current = null
        })
      }
      return running.current
    },
  }

  async function sendAll(task: { id: string; pageId: string }) {
    set(items.current.map((u) => (u.state === "error" ? { ...u, state: "pending" as const } : u)))
    // send() leaves each item done (removed) or "error", never "pending", so this terminates
    let next = items.current.find((x) => x.state === "pending")
    while (next) {
      await send(next, task)
      next = items.current.find((x) => x.state === "pending")
    }
    return !items.current.some((x) => x.state === "error")
  }
}
