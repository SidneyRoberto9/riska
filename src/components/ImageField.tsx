import { ImagePlus, Loader2, RotateCw, X } from "lucide-react"
import { useRef, useState } from "react"
import { imageSrc } from "#/data/images"
import type { useUploads } from "#/data/useUploads"
import { IMAGE_ACCEPT } from "#/lib/images"
import type { Attachment } from "#/lib/types"

const TILE = "relative aspect-square overflow-hidden rounded-xl border border-line bg-ground"

export function ImageField({
  slug,
  attachments,
  uploads,
  onFiles,
  onOpen,
  onRemove,
}: {
  slug: string
  attachments: Attachment[]
  uploads: ReturnType<typeof useUploads>
  onFiles: (files: File[]) => void
  onOpen: (index: number) => void
  onRemove?: (att: Attachment) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
      {attachments.map((att, i) => (
        <div key={att.id} className={`group ${TILE}`}>
          <button type="button" onClick={() => onOpen(i)} aria-label={`Ver imagem ${att.name}`} className="size-full">
            <img src={imageSrc(slug, att.id)} alt="" loading="lazy" className="size-full object-cover" />
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(att)}
              aria-label={`Remover imagem ${att.name}`}
              className="absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-black/60 text-white opacity-100 hover:bg-black/80 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
            >
              <X size={15} aria-hidden />
            </button>
          )}
        </div>
      ))}
      {uploads.items.map((u) => (
        <div key={u.key} className={TILE}>
          <img src={u.preview} alt="" className={`size-full object-cover ${u.state === "error" ? "opacity-40" : ""}`} />
          {u.state === "uploading" && (
            <div className="absolute inset-0 grid place-items-center bg-black/40 text-white">
              <Loader2 size={18} aria-hidden className="animate-spin" />
              <span className="sr-only">Enviando {u.file.name}</span>
              <span aria-hidden className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/30">
                <span className="block h-full bg-white" style={{ width: `${Math.round(u.progress * 100)}%` }} />
              </span>
            </div>
          )}
          {u.state === "error" && (
            <span className="absolute inset-x-1 bottom-1 flex items-center gap-1 rounded-md bg-warn px-1.5 py-0.5 text-[0.68rem] font-semibold text-white">
              <RotateCw size={11} aria-hidden /> Falhou
            </span>
          )}
          {u.state !== "uploading" && (
            <button
              type="button"
              onClick={() => uploads.remove(u.key)}
              aria-label={`Tirar ${u.file.name}`}
              className="absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X size={15} aria-hidden />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          onFiles([...e.dataTransfer.files])
        }}
        className={`${TILE} flex flex-col items-center justify-center gap-1 border-dashed text-xs text-ink-soft hover:border-accent hover:text-accent ${over ? "border-accent bg-accent-soft text-accent" : ""}`}
      >
        <ImagePlus size={20} aria-hidden />
        Adicionar
      </button>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])])
          e.target.value = ""
        }}
      />
    </div>
  )
}
