import { useEffect, useRef, useState } from 'react'

type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

const getRecognition = () => {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as Record<string, (new () => Recognition) | undefined>
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

// Web Speech API dictation; renders nothing where unsupported (e.g. Firefox)
export function VoiceButton({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const rec = useRef<Recognition | null>(null)

  useEffect(() => {
    setSupported(!!getRecognition())
    return () => rec.current?.stop()
  }, [])

  if (!supported) return null

  const toggle = () => {
    if (listening) {
      rec.current?.stop()
      return
    }
    const R = getRecognition()!
    const r = new R()
    const base = value.trim()
    r.lang = 'pt-BR'
    r.interimResults = true
    r.continuous = false
    r.onresult = (e) => {
      const said = Array.from(e.results, (res) => res[0].transcript).join('')
      onChange(base ? `${base} ${said}` : said)
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    rec.current = r
    r.start()
    setListening(true)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      aria-label={listening ? 'Parar ditado' : 'Ditar tarefa'}
      className={`grid size-10 shrink-0 place-items-center rounded-lg ${listening ? 'animate-pulse bg-accent-soft' : 'opacity-70 hover:opacity-100'}`}
    >
      🎤
    </button>
  )
}
