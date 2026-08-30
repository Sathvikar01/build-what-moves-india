---
name: Bengaluru Smart Waste
description: Explainable civic waste coordination from citizen signal to verified cleanup.
colors:
  paper: "#f5f2ea"
  paper-2: "#ede8db"
  card: "#fffdf7"
  card-2: "#faf7ee"
  card-3: "#f2eee2"
  well: "#e8e3d4"
  edge: "#cfc8b2"
  line: "rgba(29,42,34,0.12)"
  line-strong: "rgba(29,42,34,0.22)"
  line-accent: "rgba(47,107,79,0.35)"
  ink: "#1d2a22"
  ink-mid: "#4f6055"
  ink-lo: "#75837a"
  on-accent: "#f7f4ec"
  accent: "#2f6b4f"
  accent-bright: "#3d8261"
  accent-deep: "#235239"
  accent-soft: "rgba(47,107,79,0.10)"
  accent-edge: "rgba(47,107,79,0.38)"
  amber: "#a4650f"
  red: "#b23a2e"
  teal: "#0e7a6d"
  violet: "#6b4fb8"
  blue: "#2b6cb0"
  focus: "#2b6cb0"
  shadow-ink: "rgba(46,58,48,0.10)"
typography:
  display: { fontFamily: "Fraunces (var(--font-fraunces))", fontSize: "clamp(2.7rem, 6vw, 4.8rem)", fontWeight: 560, lineHeight: 1.04, letterSpacing: "-.022em" }
  headline: { fontFamily: "Fraunces (var(--font-fraunces))", fontSize: "clamp(1.9rem, 3.6vw, 2.9rem)", fontWeight: 560, lineHeight: 1.08, letterSpacing: "-.018em" }
  body: { fontFamily: "Public Sans (var(--font-public-sans))", fontSize: "15px", lineHeight: 1.6 }
  kannada: { fontFamily: "Noto Sans Kannada (var(--font-kn))" }
  eyebrow: { fontFamily: "Fraunces italic", color: "var(--accent)", fontSize: "0.95rem", transform: "none (sentence case)" }
rounded: { small: "6px", md: "10px", lg: "14px", xl: "20px", pill: "999px" }
spacing: { unit: "4px scale (--space-1..8)", page-inline: "clamp(16px, 4vw, 56px)" }
motion:
  ease-out: "cubic-bezier(0.23, 1, 0.32, 1)"
  ease-inout: "cubic-bezier(0.77, 0, 0.175, 1)"
  ease-drawer: "cubic-bezier(0.32, 0.72, 0, 1)"
  durations: "140ms press · 200ms small · 280ms drawers"
---

# Design System: Civic Field Guide

## Overview

Creative north star: **"Civic Field Guide."** A light, warm, editorial civic surface — paper grounds, ink text, hairline rules, one deep civic-green accent reserved for "live / act now," serif display type (Fraunces) over Public Sans UI text, over a light CARTO Positron basemap. It reads like a well-set public document, not a command center. Every decision still explains itself in a why-drawer; every number on screen still comes from seed 4242 and says so.

The previous "Command Atlas" (forest-ink chrome, signal lime) was replaced wholesale; the current look is its inverse. Product invariants carry forward unchanged.

## Structure

- **Split shell** (`AtlasShell` + `.atlas-split`): a persistent live map canvas plus a contextual paper rail. Desktop: map fills the viewport, rail docks right (360–430px). Mobile (≤1100px): map collapses to a ~46dvh layer, rail stacks below.
- **Paper chrome**: the app header is translucent warm paper (`backdrop-filter: blur(18px) saturate(130%)`) over a hairline rule. Cards are near-white paper (`--card`) with 1px hairline borders and tinted warm shadows — no glass-dark materials.
- **Why-drawer**: the explainability pattern. Desktop = right slide-over; mobile = bottom sheet. Enter and exit share one path (spatial consistency); exits animate before unmount.

## Color rules

- **Civic green is sacred** (`--accent`): primary actions, live indicators, route traversal, selected states. Never decorative.
- Semantic states: amber (fill/warning), red (overflow/blocked), teal (signals/pickups), violet (placement recommendations), blue (user location, neutral info), `--focus` blue for focus rings (never green — focus ≠ action).
- Score bands: routine (neutral) → high (blue) → urgent (amber) → critical (red).
- Honesty: synthetic-data labels stay visible on every surface; source chips name geography.

## Type rules

- Fraunces (serif) for display, headlines, big numerals with `tabular-nums` for data; Public Sans body; Noto Sans Kannada for KN locale. Tracking: slightly negative on display, ~0 on body.
- Eyebrows are italic serif in civic green, sentence case — the signature editorial label. Never all-caps.

## Motion rules (enforced)

- Press feedback on every pressable: `scale(0.97)` at 140ms ease-out.
- Staggered entries: `.rise` cascade, translateY(14px) + opacity, 60–380ms delays.
- UI transitions ≤ 300ms; transform/opacity only; CSS transitions (interruptible), keyframes only for loops (pulse/shimmer/glow-drift).
- Hover lifts gated behind pointer capability; `prefers-reduced-motion`: animations collapse to near-zero; `prefers-reduced-transparency`: glass goes near-solid.

## Invariants (product law — never break)

1. Map/list parity — lists show what the map plots.
2. Synthetic-data labels — every operational number is labelled demo data.
3. Explainability before score — a factor breakdown ships with every number.
4. Evidence before cleanup confirmation — before/after proof precedes citizen confirmation.
