---
name: Bengaluru Smart Waste Management
description: Explainable civic waste coordination from citizen signal to verified cleanup.
colors:
  ink: "#14241c"
  muted: "#5d6c64"
  paper: "#f4f2e9"
  surface: "#fffef9"
  line: "#cfd5cc"
  green: "#176b48"
  green-dark: "#0e5035"
  green-soft: "#dcebe1"
  amber: "#bd6b19"
  red: "#b43d34"
  focus: "#146bd1"
typography:
  display: { fontFamily: "Noto Sans, sans-serif", fontSize: "clamp(46px, 6.2vw, 88px)", fontWeight: 700, lineHeight: 0.98, letterSpacing: "-.04em" }
  headline: { fontFamily: "Noto Sans, sans-serif", fontSize: "clamp(42px, 6vw, 72px)", fontWeight: 700, lineHeight: 1, letterSpacing: "-.045em" }
  body: { fontFamily: "Noto Sans, sans-serif", fontSize: "14px", lineHeight: 1.55 }
rounded: { small: "8px", control: "10px", map: "12px", panel: "14px", atlas: "16px", pill: "999px" }
spacing: { control-inline: "17px", section: "17px", panel: "24px", page-inline: "clamp(18px, 3vw, 44px)" }
---

# Design System: Bengaluru Smart Waste Management

## Overview

Creative north star: “Namma Civic Atlas.” This is a calm, high-contrast public-service interface grounded in Bengaluru geography. A citizen signal becomes operational demand, priorities and route changes show their reasons, and cleanup ends with evidence and citizen verification.

Use warm paper, near-white civic surfaces, thin rules, restrained depth, and Bengaluru green. Amber and red are reserved for operational meaning. Real geography and synthetic telemetry must be labelled distinctly.

## Color and type

- Deep civic green is for primary actions, active navigation, brand marks, routes, and high-emphasis metrics.
- Amber marks attention, elevated fill, and waste-outside signals. Red marks reports, blocked/full/offline states, and danger.
- Ink is primary text; muted ink is metadata and supporting copy; focus blue is the universal keyboard ring.
- Noto Sans is the display and body face. Noto Sans Kannada is mandatory for Kannada copy; Kannada is first-class content, not ornament.
- Large headlines use tight tracking and compact leading. Operational text stays compact but readable.

## Layout

- Landing: a narrative beside an atlas preview, followed by three role rows.
- Citizen: mobile-first hero, two prominent signals, collection/map status, nearby bins, evidence report, cleanup confirmation, and event timeline.
- BBMP: KPI strip, map beside priority queue, and stable tabs for priority, routes, bins, and placement.
- Collector: next-stop map/action pairing, explicit evidence gate, and a canonical route list.
- Maps always have complete list/table parity. On mobile the list is visible beneath the map. Tables scroll horizontally and dashboard columns collapse to one.

## Components

- Primary and secondary controls use 10px radii and at least 44px height. All controls retain the 3px blue focus ring.
- Panels use the civic surface, a quiet border, 14px radius, 24px padding, and only subtle lift.
- Inputs are white, 46px high, 9px radius, and visibly labelled. Upload zones describe size/type/privacy before selection.
- Status chips pair color with text. Selected queue and placement rows use a pale green field.
- Priority, route, and placement scores never appear without factor/signal contributions and prose reasons.
- Collection, proof submission, proof acceptance, and citizen confirmation are distinct workflow states.

## Accessibility and truth rules

- Preserve map/list parity, 44px touch targets, visible focus, reduced motion, semantic tables, and plain-language recovery states.
- Keep exact citizen coordinates out of public aggregate views.
- Label simulated vehicles, sensors, ETAs, evidence, and scenario seed. Never imply an official live BBMP feed.
- Do not hide blocked, stale, offline, permission-denied, upload-failed, or incomplete-cleanup states.
- Do not introduce glossy gradients, arbitrary semantic colors, heavy shadow stacks, or motion that overrides reduced-motion preference.
