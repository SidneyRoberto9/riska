import type { DragEvent } from "react"

const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes("Files")

// Spread on a modal <dialog>: a file dropped anywhere in it goes to onFiles (or is ignored) instead of the browser
// navigating to it and losing what was typed. Text dragged between fields is left alone, and a drop the
// "Adicionar" tile already handled (defaultPrevented) isn't added twice.
export const fileDrop = (onFiles?: (files: File[]) => void) => ({
  onDragOver: (e: DragEvent) => {
    if (hasFiles(e)) {
      e.preventDefault()
    }
  },
  onDrop: (e: DragEvent) => {
    if (hasFiles(e) && !e.defaultPrevented) {
      e.preventDefault()
      onFiles?.([...e.dataTransfer.files])
    }
  },
})
