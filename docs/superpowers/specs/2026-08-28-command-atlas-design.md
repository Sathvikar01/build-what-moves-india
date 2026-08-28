# Command Atlas — UI/UX Rebuild Design

**Date:** 2026-08-28
**Status:** Implemented
**Supersedes:** "Namma Civic Atlas" visual world (paper/cream + civic green)

## Decision

Full UI/UX rebuild of all six surfaces under one new design system, **Command
Atlas**: a map-first split shell with forest-ink dark chrome and a single
signal-lime accent. Chosen via design-ideate over two alternates (Ledger:
explainability-first editorial; Field Kit: task-card mobile-first). The
direction fuses the three: Command Atlas structure, Field-Kit task stacking on
mobile, and Ledger's explainability carried by the why-drawer pattern.

## Scope

Rewritten: landing, login, citizen, collector, BBMP console, data-assumptions,
globals CSS (replaced by `app/styles/{tokens,base,components}.css`),
`bengaluru-map` visual layer, `app-header`, `ui-bits` styling surface.

Untouched (the engine): `src/domain`, `src/server`, `src/data` logic,
`demo-provider` state, `auth`, all API routes, seed-4242 determinism.

## Architecture

- **Tokens** (`app/styles/tokens.css`): ink surface ramp, lime accent,
  semantic states, glass material vars, emil-design-eng motion curves, 4px
  spacing scale, Space Grotesk/Noto/Noto-Kannada font vars. Light-mode parity
  deferred until field users need it (tokens make it cheap).
- **Base** (`base.css`): reset, type scale, a11y primitives (skip link, focus
  ring, reduced-motion/-transparency), dark scrollbars.
- **Components** (`components.css`): floating glass chrome, atlas split shell,
  buttons with pointer-down press feedback, chips/bands, why-drawer, KPI
  strips, queue/audit, tables, per-surface sections, leaflet dark overrides.
- **Shell** (`src/components/atlas-shell.tsx`): `AtlasShell` (skip link +
  header + full-height main) and `WhyDrawer` (desktop slide-over / mobile
  bottom sheet; ESC + scrim close; animated exit before unmount; focus
  restore).
- **Map**: dark CARTO basemap (env-overridable), lime route traversal with
  white casing, palette-matched markers, restyled legend/popup/zoom chrome.

## Product invariants preserved

1. Map/list parity (citizen bins list = plotted bins).
2. Synthetic-data labels everywhere (badges, source chips, "synthetic" detail).
3. Explainability before score (factor tables, why-boxes, contribution chips).
4. Evidence before cleanup confirmation (EvidencePair precedes confirm).

## Motion contract

Press `scale(0.97)` @140ms; entries via `@starting-style` from
`scale(0.95)+opacity:0`; ≤300ms; transform/opacity only; CSS transitions for
interruptible UI; staggered lists 30–80ms; hover gated to fine pointers;
reduced-motion = cross-fades; reduced-transparency = solid chrome.

## Verification

`npm run lint` (0 errors), `npm run test` (51/51), `npm run build` (all routes),
dev-server screenshots desktop + mobile, impeccable detector pass.
