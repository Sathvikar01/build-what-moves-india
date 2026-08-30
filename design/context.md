# Context — full visual redesign ("Civic Field Guide")

goal: replace the dark "Command Atlas" UI entirely with a light, warm, civic-editorial design that feels like a modern public institution; improve UX states (hover/focus/empty/loading/errors) everywhere.
user: citizens (low civic-tech comfort, mobile-heavy), BBMP ops staff (desktop, data-dense), collectors (field, phone), hackathon judges (first impression in seconds).
JTBD: citizen signals waste / tracks truck / confirms cleanup; BBMP ranks, routes, audits; collector follows route, submits proof.
constraints: Next.js 16 App Router + vanilla CSS (no Tailwind migration), Leaflet maps, existing class vocabulary and all interactive logic preserved; bilingual EN/KN copy; labelled synthetic data (seed 4242) must stay visibly labelled.
success: entire app reads as one coherent light editorial system, dramatically different from the dark command-center look; lint/build/tests pass; all 6 pages screenshot-verified; AA contrast.
scope v1: tokens + base + components CSS rewrite, layout fonts (Fraunces + Public Sans), landing/editorial hero, header, shared components, all 6 pages, light map tiles, DESIGN.md.
non-goals: Tailwind migration, framer-motion, dark mode toggle, new state management, changes to domain/API/seed logic.
open assumptions: light-theme direction chosen by user ("i want light theme UI"); Phosphor icon swap approved but only used where it adds clarity.
⚠ risks: dark→light flips contrast assumptions in map overlays (verify popup/legend legibility); Leaflet controls restyle needs care; Kannada glyphs must render in body font fallback.
