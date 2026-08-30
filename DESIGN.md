# Bengaluru Smart Waste — "Municipal Works" design system

Swiss industrial print crossed with Bengaluru field-operations signage.
Flat ink-ruled cells on unbleached newsprint. Heavy grotesque display type,
monospace telemetry labels. One hazard-red accent. No rounded corners, no soft
shadows, no gradients anywhere.

## Surfaces

| Token | Value | Role |
| --- | --- | --- |
| `--paper` | `#f2f1ec` | Page substrate (matte newsprint) |
| `--card` | `#f6f5f0` | Panel fill — cells divide by rules, never float |
| `--well` | `#e0dfd6` | Wells, bar tracks, insets |
| `--ink` | `#12120f` | Carbon ink — text, thick rules, solid fills |
| `--accent` | `#c41a16` | Hazard red — THE accent: CTAs, vital data, alerts |
| `--teal` | `#0d6e62` | Functional "live / collected / good" status only |
| `--amber` / `--blue` | `#9a6a00` / `#24549c` | Equipment-tag status hues only |

Structure is drawn with rules: `1px solid --line` inside panels, `2–3px solid
--ink` for section boundaries. Radii are all `0`. Shadows are all `none`.

## Type

- **Display / body — Archivo** (next/font `--font-archivo`): headings are
  uppercase, weight 800–900, tracking `-0.02em` to `-0.035em`, line-height
  `0.9–1.1`. The landing masthead runs to `clamp(2.9rem, 8.5vw, 7rem)`.
- **Telemetry — JetBrains Mono** (`--font-mono`): every label, chip, number,
  button, ETA, and eyebrow. Uppercase, tracked `0.05–0.1em`, small sizes.
- **Kannada — Noto Sans Kannada** (kept); the vertical ಕನ್ನಡ line on the login
  stage is a deliberate signage element.
- Eyebrows render as work-order brackets: `[ SYNTHETIC DEMO ]` via
  `.eyebrow::before/::after` in `base.css`.

## Signature moves

1. **Newsprint rules** — newspaper double-rule masthead top, barcode strip on
   `.mast-rule`, `//` separators in mono metadata.
2. **Monochrome maps** — OSM tiles desaturated via
   `.map-frame .leaflet-tile { filter: grayscale(1) }`; routes print in ink,
   the leg to the next stop and vehicles in hazard red.
3. **Work-order ledgers** — full-width numbered rows (`01`–`05`) with mono
   indices that invert to ink-on-hover (landing ledger, role index).
4. **Stamp controls** — buttons are uppercase mono tiles; primary is solid
   hazard red; press feedback is a 1px mechanical nudge, not a scale.
5. **Terminal stage** — the login gate is solid carbon ink with scanline
   texture, red display statement, and a red 4px rule against the desk.
6. **Score docket** — priority queue rows carry red score bars sized by score;
   selected row gets an inset red bar.

## Status color semantics

| Meaning | Color |
| --- | --- |
| Collected / confirmed / cleaned | `--teal` |
| En route / arrived (in progress) | `--blue` |
| Blocked / reopened / critical | `--red` |
| Urgent / filling / threshold | `--amber` |
| Live tick (header) | `--teal` pulse |

## Motion

Fast and mechanical: `100–240ms`, `cubic-bezier(0.2, 0.9, 0.3, 1)` exits, no
bounce, no glow. Entry stagger (`.rise`) is retained. Reduced-motion and
reduced-transparency are honored.

## Screens

- **Landing** (`app/page.tsx`) — broadsheet masthead, captioned map figure
  ("FIG. 01"), work-order ledger, role index rows.
- **Login** (`app/login/page.tsx`) — split gate: carbon stage + sign-in desk
  with a mono segmented role control.
- **Citizen** (`app/citizen/page.tsx`) — status band + ETA chip, vertical step
  rail, workbench panels, map right.
- **BBMP** (`app/bbmp/page.tsx`) — vertical ops rail, 8-cell stat ticker,
  priority docket + docked map.
- **Collector** (`app/collector/page.tsx`) — route tick strip, numbered action
  card, stop manifest.
- **Data & assumptions** (`app/data-assumptions/page.tsx`) — chaptered docs
  with sticky mono TOC.

Screenshot regression: `node scripts/redesign-shots.mjs` against a dev server
on `:3100` (outputs `scripts/redesign-shots/`). Maps wait for
`.map-frame[aria-busy="false"]` before capture.
