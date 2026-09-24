# Design

Source of truth: `src/styles.css` (tokens) and `src/lib/types.ts`
(`THEMES`, `MODES`, `STATUS_COLORS`). This file describes what they
implement; change the code, then this file.

## Typography

- **IBM Plex Sans** (400/500/600) for UI text, **Manrope** (700/800) for
  `h1`–`h3`, both loaded from Google Fonts in `__root.tsx`.
- Fallback: `system-ui, sans-serif`. Headings use `text-wrap: balance`.

## Color tokens

Each theme is one block of `light-dark()` pairs, so light and dark come
from `color-scheme` instead of duplicated rules. Tailwind exposes them as
`ink`, `ink-soft`, `line`, `surface`, `ground`, `accent`, `accent-soft`,
`done`, `done-soft`, `warn`, `warn-soft`.

| Token | Use |
| --- | --- |
| `--ground` | Page background |
| `--surface` | Cards, popovers, dialog |
| `--line` | Borders, dividers, unchecked checkbox |
| `--ink` / `--ink-soft` | Primary / secondary text |
| `--accent` / `--accent-soft` | Actions, focus ring, active state / its tinted background |
| `--done` / `--done-soft` | Completed tasks (shared by every theme) |
| `--warn` / `--warn-soft` | Errors and destructive feedback (shared by every theme) |

Themes (`data-theme` on `<html>`), accent light → dark:

| Theme | Accent |
| --- | --- |
| `roxo` (default) | `#6d28d9` → `#a78bfa` |
| `rosa` | `#be185d` → `#f472b6` |
| `verde` | `#047857` → `#34d399` |
| `azul` | `#1d4ed8` → `#60a5fa` |
| `ambar` | `#c2410c` → `#fb923c` |
| `grafite` | `#3f3f46` → `#d4d4d8` |

Mode (`data-mode`): `light`, `dark`, or `system` (default, follows the OS).
Sessions store theme + mode server-side and the root loader applies them
during SSR; local mode restores them from `localStorage` with a pre-paint
script. Either way the first paint is already themed.

Status colors are a fixed palette of 8 (`STATUS_COLORS`), each with a
PT-BR name for screen readers.

## Shape & layout

- Radius: Tailwind `rounded-md` → `rounded-2xl` for controls and cards,
  `12px` popovers, `20px` task dialog, `6px` checkbox and focus ring.
- Content max width `1440px`, centered, `px-4` (`sm:px-6`) gutters.
- Board columns `min(85vw, 300px)` wide, scrolling horizontally with no
  visible scrollbar; the side with more columns fades out via a mask.
- Task dialogs (`.task-dialog`: details and "Nova tarefa"): centered
  modal `min(640px, 100vw − 32px)` wide on desktop, bottom sheet at
  ≤ 640px (respecting the safe-area inset).
- Image lightbox: a separate modal `<dialog>` styled with Tailwind only,
  `96vw × 96dvh`, transparent over a `bg-black/85` backdrop, image
  `object-contain`; ←/→ keys, arrow buttons and a 50px horizontal swipe
  move between images, Esc/backdrop close it and focus returns to the
  thumbnail.
- Image thumbnails: square tiles in a `repeat(auto-fill, minmax(88px, 1fr))`
  grid, remove button `size-10`.

## Task fields

- **Column chips** (`ColumnChips`): one pill radio per status, `min-h-10`,
  a color dot plus the name; the selected one takes the status tint.
- **Meta line** (`TaskMeta`) under a task title on rows and cards,
  `0.75rem` `ink-soft`: `UserRound` + responsável, `Image` + count,
  `StickyNote` when there is a description (lucide, 13px; each has
  screen-reader text).

## Hit targets

Interactive rows and buttons are `min-h-10` (40px) or `min-h-11` (44px);
icon buttons `size-10`. The 19px checkbox gets a padded label around it so
its hit area is larger than its visual.

## Motion

- Dialog fade/rise (`0.18s`), bottom-sheet slide on phones (`0.24s`).
- Drag: faded dashed placeholder where the item lands (`.drag-ghost`),
  lifted, slightly rotated copy under the pointer (`.drag-lift`).
- Row menus and drag handles fade in on hover on pointer devices; always
  visible on touch.
- `prefers-reduced-motion: reduce` collapses every animation and
  transition and removes the drag rotation/scale.

## Accessibility

- Visible `:focus-visible` outline (2px accent) on every focusable element.
- Icon-only buttons carry `aria-label`s; state is never color-only (done
  tasks are also struck through, statuses have names).
- Drag-and-drop works by keyboard (Space to lift, arrows to move) and
  announces moves in PT-BR through dnd-kit live regions.
- Voice dictation renders nothing where the Web Speech API is unsupported,
  rather than a dead button.
