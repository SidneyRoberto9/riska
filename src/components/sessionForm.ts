export const card = "rounded-2xl border border-line bg-surface p-5"

export const input =
  "w-full min-w-0 rounded-xl border border-line bg-ground px-3 py-2.5 focus-visible:border-accent focus-visible:outline-offset-0"

export const button =
  "min-h-11 rounded-xl bg-accent px-5 font-semibold text-surface hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"

export const fieldLabel = "mb-1.5 block text-[0.82rem] font-semibold text-ink-soft"

// Session names double as URLs, so no autocorrect/capitalization on mobile keyboards
export const nameProps = { autoComplete: "off", autoCapitalize: "none", autoCorrect: "off", spellCheck: false } as const

export const pinProps = { type: "password", inputMode: "numeric", maxLength: 4, autoComplete: "off" } as const

export const onlySlug = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 40)
