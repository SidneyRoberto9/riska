# Riska — Brand

**Idea:** *riscar* an item is finishing it — the strike ends in a check.

## Files

| File | Use |
|---|---|
| `riska-symbol.svg` | Symbol (master). Avatars, large icons |
| `riska-symbol-small.svg` | Heavier cut for ≤ 32 px (favicon, tab, app icon) |
| `riska-horizontal.svg` | Main lockup: symbol + name |
| `riska-stacked.svg` | Square spaces (splash, social) |
| `riska-wordmark.svg` | Name struck through + check — expressive use only (≥ 160 px wide) |
| `*-reversed.svg` | On dark backgrounds |
| `export/` | Black / white / violet one-colour SVG+PNG, app icon, favicon set, `site.webmanifest`, `head-snippet.html` |
| `presentation.html` | Board with mockups |
| `concepts/` | Explored concepts (A, B, C) |

## Colour

| Role | HEX | RGB | CMYK (approx.) |
|---|---|---|---|
| Violet (symbol) | `#6d28d9` | 109 40 217 | 50 82 0 15 |
| Violet on dark | `#a78bfa` | 167 139 250 | 33 44 0 2 |
| Ink (name) | `#1c1a22` | 28 26 34 | 18 24 0 87 |
| On dark (name) | `#ffffff` | 255 255 255 | 0 0 0 0 |

Same values as the app's `roxo` theme (`src/styles.css`). Pantone not matched — get a printed swatch before print jobs.

## Rules

- **Clear space:** the height of the name's x-height (the "r" without ascender) on every side.
- **Minimum size:** symbol 16 px (use the small cut up to 32 px); horizontal lockup 96 px wide.
- **Backgrounds:** white, `ground`/`surface` of the app, violet (symbol in white), dark (reversed files).
- **Don't:** rotate, change the check angle, add a box around the symbol, outline, gradient/shadow,
  recolour the name violet, use the struck wordmark below 160 px (the strike hurts legibility).

## Construction

256 grid. Stroke 28, round caps and joins. Strike 108 long → drop at 45° (32×32) → rise at 60° (56×97).
Name: monoline 24, x-height 80, ascender 140. Small cut: stroke 40, shorter strike.

## Open items

- Masters use strokes; convert to outlines (Inkscape: *Path → Stroke to Path*) before sending to print or a
  trademark filing.
- No trademark search done — check INPI and a reverse image search before official use.
- Favicon/icons not wired into the app yet (`export/head-snippet.html` has the tags).
