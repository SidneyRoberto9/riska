import { useCallback, useEffect, useRef, useState } from "react"

// Controls (and cards, which have their own drag-and-drop) keep their pointer behaviour; only empty board space pans
const NO_PAN = 'article, button, a, input, textarea, select, label, [contenteditable], [role="button"], [data-no-drag]'

// Horizontal board scrolling without a visible scrollbar:
// - mouse: grab empty space and drag, with a little momentum on release
// - mouse wheel: vertical wheel scrolls sideways unless a column under the pointer can still scroll vertically
// - touch/trackpad: native scrolling (and snap) untouched
// Returns edge flags so the caller can fade the side that has more content.
export function useDragScroll<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null)
  const [edges, setEdges] = useState({ start: false, end: false })
  const [panning, setPanning] = useState(false)
  const frame = useRef(0)

  const measure = useCallback(() => {
    if (!el) {
      return
    }
    const max = el.scrollWidth - el.clientWidth
    setEdges({ start: el.scrollLeft > 1, end: el.scrollLeft < max - 1 })
  }, [el])

  useEffect(() => {
    if (!el) {
      return
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const child of el.children) {
      ro.observe(child)
    }
    const mo = new MutationObserver(measure)
    mo.observe(el, { childList: true })
    el.addEventListener("scroll", measure, { passive: true })

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY) || el.scrollWidth <= el.clientWidth) {
        return
      }
      for (let n = e.target as HTMLElement | null; n && n !== el; n = n.parentElement) {
        const canScrollY = n.scrollHeight > n.clientHeight && /auto|scroll/.test(getComputedStyle(n).overflowY)
        if (canScrollY && (e.deltaY < 0 ? n.scrollTop > 0 : n.scrollTop + n.clientHeight < n.scrollHeight - 1)) {
          return
        }
      }
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener("wheel", onWheel, { passive: false })

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || el.scrollWidth <= el.clientWidth) {
        return
      }
      if ((e.target as Element).closest(NO_PAN)) {
        return
      }
      cancelAnimationFrame(frame.current)
      const startX = e.clientX
      const startLeft = el.scrollLeft
      let lastX = e.clientX
      let lastT = e.timeStamp
      let velocity = 0
      let moved = false
      const stop = (c: Event) => c.stopPropagation()

      const onMove = (m: PointerEvent) => {
        if (!moved && Math.abs(m.clientX - startX) < 4) {
          return
        }
        if (!moved) {
          moved = true
          el.setPointerCapture(e.pointerId)
          setPanning(true)
        }
        const dt = Math.max(1, m.timeStamp - lastT)
        velocity = (m.clientX - lastX) / dt
        lastX = m.clientX
        lastT = m.timeStamp
        el.scrollLeft = startLeft - (m.clientX - startX)
      }
      const onUp = () => {
        el.removeEventListener("pointermove", onMove)
        el.removeEventListener("pointerup", onUp)
        el.removeEventListener("pointercancel", onUp)
        if (!moved) {
          return
        }
        setPanning(false)
        // The click that ends a pan must not hit whatever is under the pointer
        el.addEventListener("click", stop, { capture: true, once: true })
        setTimeout(() => el.removeEventListener("click", stop, true), 0)
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
          return
        }
        let v = -velocity * 16
        const glide = () => {
          if (Math.abs(v) < 0.5) {
            return
          }
          el.scrollLeft += v
          v *= 0.92
          frame.current = requestAnimationFrame(glide)
        }
        frame.current = requestAnimationFrame(glide)
      }
      el.addEventListener("pointermove", onMove)
      el.addEventListener("pointerup", onUp)
      el.addEventListener("pointercancel", onUp)
    }
    el.addEventListener("pointerdown", onPointerDown)

    return () => {
      cancelAnimationFrame(frame.current)
      ro.disconnect()
      mo.disconnect()
      el.removeEventListener("scroll", measure)
      el.removeEventListener("wheel", onWheel)
      el.removeEventListener("pointerdown", onPointerDown)
    }
  }, [el, measure])

  return { ref: setEl, edges, panning, scrollable: edges.start || edges.end }
}
