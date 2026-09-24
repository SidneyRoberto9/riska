const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" })
const relFmt = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
]

export const formatDate = (iso: string) => dateFmt.format(new Date(iso))

export function relative(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000
  for (const [unit, n] of UNITS) {
    if (Math.abs(s) >= n) {
      return relFmt.format(Math.round(s / n), unit)
    }
  }
  return "agora"
}
