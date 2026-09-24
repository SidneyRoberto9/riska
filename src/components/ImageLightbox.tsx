import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

const NAV = "grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"

export function ImageLightbox({
  images,
  index,
  onClose,
}: {
  images: { src: string; name: string }[]
  index: number
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [i, setI] = useState(index)
  const [failed, setFailed] = useState(false)
  const touchX = useRef<number | null>(null)
  const many = images.length > 1
  const go = (d: number) => {
    setFailed(false)
    setI((x) => (Math.min(x, images.length - 1) + d + images.length) % images.length)
  }
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  // Clamped: an image deleted while shown (e.g. on another device) falls back to the last one
  const at = Math.min(i, images.length - 1)
  const img = images[at]
  if (!img) {
    return null
  }

  return (
    <dialog
      ref={ref}
      aria-label={`Imagem ${at + 1} de ${images.length}: ${img.name}`}
      onClose={onClose}
      onKeyDown={(e) => {
        if (many && e.key === "ArrowLeft") {
          go(-1)
        } else if (many && e.key === "ArrowRight") {
          go(1)
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          ref.current?.close()
        }
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(e) => {
        const start = touchX.current
        const end = e.changedTouches[0]?.clientX
        if (many && start !== null && end !== undefined && Math.abs(end - start) > 50) {
          go(end < start ? 1 : -1)
        }
      }}
      className="m-auto h-[96dvh] max-h-none w-[96vw] max-w-none overflow-hidden border-0 bg-transparent p-0 text-white backdrop:bg-black/85"
    >
      <div className="flex size-full flex-col">
        <header className="flex items-center gap-3 px-2 py-2">
          <span className="text-sm tabular-nums text-white/80">
            {at + 1} / {images.length}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{img.name}</span>
          <a href={img.src} target="_blank" rel="noopener" className={NAV} aria-label="Abrir original">
            <ExternalLink size={18} aria-hidden />
          </a>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Fechar" className={NAV}>
            <X size={20} aria-hidden />
          </button>
        </header>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: empty-area click to close mirrors the backdrop; Esc already closes the dialog */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: same as above, Esc already closes the dialog */}
        <div
          className="relative flex min-h-0 flex-1 items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              ref.current?.close()
            }
          }}
        >
          {failed ? (
            <p className="text-white/80">Não foi possível carregar a imagem.</p>
          ) : (
            <img
              key={img.src}
              src={img.src}
              alt={img.name}
              onError={() => setFailed(true)}
              className="max-h-full max-w-full object-contain"
            />
          )}
          {many && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Imagem anterior"
                className={`${NAV} absolute left-2`}
              >
                <ChevronLeft size={22} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Próxima imagem"
                className={`${NAV} absolute right-2`}
              >
                <ChevronRight size={22} aria-hidden />
              </button>
            </>
          )}
        </div>
      </div>
    </dialog>
  )
}
