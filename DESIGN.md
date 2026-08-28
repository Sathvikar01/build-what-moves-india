---
name: Bengaluru Smart Waste Management
description: Explainable civic waste coordination from citizen signal to verified cleanup.
colors:
  ink-950: "#070e0a"
  ink-900: "#0b1510"
  ink-850: "#0f1b15"
  ink-800: "#14231b"
  ink-700: "#1e3327"
  line: "rgba(213,236,221,0.09)"
  text-hi: "#eaf3eb"
  text-mid: "#a2b8aa"
  text-lo: "#6b8074"
  lime: "#c9f24d"
  lime-bright: "#e0ff70"
  lime-soft: "rgba(201,242,77,0.12)"
  amber: "#f0a83c"
  red: "#f26d5f"
  teal: "#45d9c3"
  violet: "#b795ff"
  blue: "#74b9ff"
  focus: "#8ecbff"
  lime-deep: "#86c33a"
  shadow-ink: "rgba(2,6,4,0.45)"
typography:
  display: { fontFamily: "Space Grotesk (var(--font-display))", fontSize: "clamp(2.4rem, 5vw, 4rem)", fontWeight: 700, lineHeight: 1.02, letterSpacing: "-.03em" }
  headline: { fontFamily: "Space Grotesk (var(--font-display))", fontSize: "clamp(1.5rem, 3vw, 2.1rem)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-.025em" }
  body: { fontFamily: "Noto Sans (var(--font-body))", fontSize: "15px", lineHeight: 1.55 }
  kannada: { fontFamily: "Noto Sans Kannada (var(--font-kn))" }
rounded: { small: "8px", md: "12px", lg: "16px", xl: "22px", pill: "999px" }
spacing: { unit: "4px scale (--space-1..8)", page-inline: "clamp(16px, 4vw, 56px)" }
motion:
  ease-out: "cubic-bezier(0.23, 1, 0.32, 1)"
  ease-inout: "cubic-bezier(0.77, 0, 0.175, 1)"
  ease-drawer: "cubic-bezier(0.32, 0.72, 0, 1)"
  durations: "140ms press · 200ms small · 280ms drawers"
---

# Design System: Command Atlas

## Overview

Creative north star: **"Command Atlas."** A map-first operations surface — forest-ink chrome, one signal-lime accent reserved for "live / act now," and floating translucent materials over a dark CARTO basemap. Every decision explains itself in a why-drawer; every number on screen comes from seed 4242 and says so.

The incumbent "Namma Civic Atlas" (paper/cream, civic green) was replaced wholesale. Its look is the anti-reference; its product invariants carry forward unchanged.

## Structure

- **Split shell** (`AtlasShell` + `.atlas-split`): a persistent live map canvas plus a contextual glass rail. Desktop: map fills the viewport, rail docks right (360–430px). Mobile (≤960px): map collapses to a 40–44dvh hero layer, rail stacks below.
- **Floating chrome**: the app header and route-status chip are translucent material layers (`backdrop-filter: blur(20px) saturate(160%)`) with a bright top edge. Content scrolls underneath.
- **Why-drawer**: the explainability pattern. Desktop = right slide-over; mobile = bottom sheet. Enter and exit share one path (spatial consistency); exits animate before unmount.

## Color rules

- **Signal lime is sacred**: primary actions, live indicators, focus of attention, route traversal. Never decorative.
- Semantic states: amber (fill/warning), red (overflow/blocked), teal (signals/pickups), violet (placement recommendations), blue (user location, neutral info), `--focus` blue for focus rings (never lime — focus ≠ action).
- Score bands: routine (neutral) → scheduled (blue) → high (amber) → urgent (red) → critical (red + glow).
- Honesty: synthetic-data labels stay visible on every surface; source chips name geography.

## Type rules

- Space Grotesk for display + all numerals (`tabular-nums`); Noto Sans body; Noto Sans Kannada for KN locale. Tracking is size-specific: negative on display, ~0 on body.
- Hierarchy from weight + size + leading as a set; uppercase eyebrows at 0.72rem/0.09em tracking carry section labels.

## Motion rules (enforced)

- Press feedback on every pressable: `scale(0.97)` at 140ms ease-out, on pointer-down timelines.
- Entries start from `scale(0.95)/translateY(8px) + opacity: 0` via `@starting-style` — never from `scale(0)`, never `transition: all`.
- UI transitions ≤ 300ms; transform/opacity only; CSS transitions (interruptible), keyframes only for loops (pulse/shimmer/ping).
- List entries stagger 30–80ms where they appear in groups. Hover transforms gated behind `@media (hover:hover)`.
- `prefers-reduced-motion`: cross-fades replace slides/pulses; `prefers-reduced-transparency`: glass goes near-solid.

## Invariants (product law — never break)

1. Map/list parity — lists show what the map plots.
2. Synthetic-data labels — every operational number is labelled demo data.
3. Explainability before score — a factor breakdown ships with every number.
4. Evidence before cleanup confirmation — before/after proof precedes citizen confirmation.
