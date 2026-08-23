# Bengaluru Smart Waste Management (VMH)

**Explainable civic waste coordination for the Mahadevapura pilot — from citizen signal to verified cleanup.**

A hackathon pilot for Mahadevapura zone (wards 28–50, Bengaluru East) covering the full waste-management loop: citizens signal waste and report garbage hotspots with photo + GPS, an explainable priority engine ranks the work, an ACO-inspired optimizer adapts collection routes, collectors submit before/after proof of cleanup, and citizens confirm the street is actually clean.

- **Real geography** — streets, places, and ward context from OpenStreetMap (ODbL).
- **Clearly labelled synthetic operations** — vehicles, bins, reports, ETAs, and routes all come from deterministic seed `4242`, and every screen says so.
- **Every decision has a reason** — priority scores, route stops, and bin-placement recommendations expose their factors, weights, and contributions. No unexplained score is allowed.

---

## Table of Contents

1. [Running the App](#running-the-app)
2. [Tech Stack](#tech-stack)
3. [The Three Roles](#the-three-roles)
4. [Feature Walkthrough](#feature-walkthrough)
5. [Architecture](#architecture)
6. [Project Structure](#project-structure)
7. [API Reference](#api-reference)
8. [Domain Algorithms](#domain-algorithms)
9. [Data & Persistence](#data--persistence)
10. [Design System](#design-system)
11. [Accessibility & i18n](#accessibility--i18n)
12. [Testing](#testing)
13. [Deployment (Cloudflare)](#deployment-cloudflare)
14. [Product Principles](#product-principles)
15. [Known Limitations](#known-limitations)

---

## Running the App

**Prerequisites:** Node.js ≥ 22.13.0 and npm.

```bash
npm install        # install dependencies
npm run dev        # dev server        → http://localhost:3000
```

Other commands:

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (Vite/vinext) on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm test` | Run the vitest unit suite |
| `npx tsc --noEmit` | Typecheck |

**Local URL:** http://localhost:3000 — landing page with links to all three role experiences.

---

## Tech Stack

| Layer | Choice |
|---|---|
| UI framework | React 19 + Next.js-style App Router (`app/`) on **vinext** (Vite 8 runtime) |
| Language | TypeScript 5.9 (strict) |
| Styling | Hand-written design-token CSS (`app/globals.css`), zero utility frameworks |
| Maps | Leaflet + OpenStreetMap tiles with full fallback list-alternative |
| Icons | lucide-react |
| Validation | zod (API request bodies) |
| Database | Cloudflare D1 (SQLite) via Drizzle ORM — audit-event journaling |
| Object storage | Cloudflare R2 for private evidence photos (memory fallback) |
| Runtime/deploy | Cloudflare Workers (wrangler + `@cloudflare/vite-plugin`) |
| Tests | Vitest (domain units) + Playwright (e2e) |

---

## The Three Roles

### 1. Citizen — `/citizen` (mobile-first, English + ಕನ್ನಡ)
- **No-login citizen entry** for the core service journey; demo sign-in remains optional for role switching.
- **2026 four-stream preparation** for wet, dry, sanitary, and special-care waste, with bilingual examples, exceptions, and an honest reminder to verify locality collection notices.
- Two quick **waste signals**: "I have waste" / "Waste kept outside" — each immediately recalculates the demo route.
- **Garbage reporting** with photo (EXIF/metadata stripped in-browser, re-encoded), geolocation capture, category/hygiene/obstruction classification.
- **Live truck map** with ETA, nearby smart-bin fill status, and a transparent activity timeline.
- **Cleanup confirmation**: after a collector's proof is accepted, the citizen closes the loop — cleaned / partly cleaned / still present (reopening returns the report to the priority queue).
- **Accountable journey + low-data mode**: ETA, route reason, proof, citizen closure/reopening and four-hour demo SLA escalation stay visible even when map tiles are paused.

### 2. BBMP Operations — `/bbmp` (desktop control room)
- **Live overview**: "Today in Mahadevapura" impact strip (litres collected, stops completed, reports resolved/pending, average pickup latency, verified proofs), KPI cards, fleet + demand map.
- **Priority queue**: explainable ranking of every open report with a full ten-factor audit per report.
- **Routes lab**: inspect the optimizer's adaptive signal weights, per-stop explanations and contributions, unassigned work with reasons; recalculate or publish a route revision.
- **Smart bins**: synthetic IoT telemetry table with fill/status/freshness.
- **Placement lab**: six diversified smart-bin placement recommendations with 9-factor scorecards, confidence, and field-validation warnings.

### 3. Collector — `/collector` (mobile web)
- Route revision banner with acknowledge, navigation sequence, "why this stop?" explanations.
- Actions: **arrived → collected** (enforced status transitions) or **blocked** (stop removed, suffix re-optimized, dispatch review flagged).
- **Cleanup proof**: before/after photos (metadata-removed), device GPS (or labelled demo coordinate), and a checklist — all required before a report can become "cleaned".

Plus public transparency pages at **`/data-assumptions`** (factor weights, algorithm cards, privacy statement) and **`/impact-replay`** (seed-4242 fixed-baseline vs adaptive comparison with raw missed-pickup, overflow, waiting, fairness, distance, fuel/CO₂-proxy and fallback metrics).

---

## Feature Walkthrough

The end-to-end demo loop (all data deterministic, seed 4242):

```
Citizen signal/report ──▶ 10-factor priority score ──▶ ACO route plan
       │                        (auditable)              (5 signal colonies)
       │                                                      │
       │                                              Collector follows stops
       │                                                      │
       └── notification ◀── collected / blocked ◀────────────┘
                                     │
                        before/after photo + GPS + checklist
                                     │
                          report becomes "cleaned"
                                     │
                     Citizen confirms ──▶ case closed
                        (or reopens ──▶ back to queue)
```

**Try it:**
1. Open `/citizen`, tap a quick signal, watch the route recalculate.
2. Open `/bbmp` → Priority queue → click a report to see its full factor audit.
3. Open `/collector`, acknowledge the route, arrive → collect → submit the proof (demo GPS + any two images work).
4. Back on `/citizen`, confirm the cleanup.
5. Use the ⏩ button in the header (BBMP/collector) to advance the simulation 30 s; ↺ resets to seed 4242.

---

## Architecture

**Client** — `src/components/demo-provider.tsx` is a React context holding the whole `DemoState`. Every action applies an **optimistic local update**, then POSTs to the API with an `idempotency-key`, then re-syncs. A 2-second poll keeps all three role tabs in sync; the poll is paused while a mutation is in flight and uses the event cursor to discard stale snapshots. Sync failures surface as a dismissible error banner — nothing fails silently.

**Server** — 18 API routes under `app/api/**` validate a role header (`x-demo-role`: citizen/bbmp/collector), enforce idempotency keys, and mutate the shared in-memory `DemoState` in `src/server/store.ts` (kept on `globalThis` per worker isolate). Priority and routes are recomputed server-side on every mutation.

**One source of truth for simulation rules** — `src/domain/simulate.ts` implements the tick rules (vehicle movement, bin fill thresholds 70%/94%, event-id generation, citizen-report scoring defaults) and is used by **both** the client provider and the server store, so optimistic updates and server state can't drift apart.

**Event journal** — every state change appends a cursor-ordered `DemoEvent`; mutations best-effort journal new events into **Cloudflare D1** (graceful memory-only fallback when the binding is absent) so the audit trail survives isolate resets.

```
app/(pages + api routes)  ──▶  src/server/store.ts  ──▶  D1 event_journal
        │                              │
src/components/demo-provider.tsx       │
        │                              │
        └──── src/domain/* ────────────┘
      (priority, optimizer, placement, simulate, impact — pure, tested)
```

---

## Project Structure

```
vmh/
├── app/
│   ├── page.tsx                  # Landing with role cards + map
│   ├── citizen/page.tsx          # Citizen mobile flow (EN/KN)
│   ├── bbmp/page.tsx             # Operations control room (5 tabs)
│   ├── collector/page.tsx        # Collector route + proof flow
│   ├── data-assumptions/page.tsx # Public transparency page
│   ├── layout.tsx / globals.css / proof.css
│   └── api/                      # 18 endpoints (see API reference)
├── src/
│   ├── components/
│   │   ├── demo-provider.tsx     # Client state, optimistic sync, error surfacing
│   │   ├── bengaluru-map.tsx     # Leaflet map + loading/error/keyboard fallback
│   │   ├── app-header.tsx        # Shared header (locale, tick, reset)
│   │   └── priority-audit.tsx    # Ten-factor audit renderer
│   ├── domain/                   # Pure, tested business logic
│   │   ├── priority.ts           # 10-factor explainable scoring
│   │   ├── optimizer.ts          # Multi-signal ACO-inspired routing
│   │   ├── placement.ts          # 9-factor bin placement scoring
│   │   ├── simulate.ts           # Shared simulation rules (client+server)
│   │   ├── impact.ts             # "Today in Mahadevapura" summary
│   │   ├── types.ts              # All shared types
│   │   └── *.test.ts             # Vitest suites
│   ├── server/
│   │   ├── store.ts              # In-memory DemoState + D1 journaling + caches
│   │   └── http.ts               # ok/fail helpers, role guard, idempotency
│   ├── data/
│   │   ├── demo.ts               # Deterministic seed-4242 scenario
│   │   ├── locations.ts          # Real OSM place coordinates
│   │   └── copy.ts               # Bilingual EN/KN citizen copy
│   ├── client/image.ts           # EXIF-stripping canvas re-encode
│   └── config/map.ts             # Tile config + resilience
├── db/
│   ├── schema.ts                 # Full Drizzle/D1 schema (17 tables)
│   ├── index.ts                  # getDb() via env.DB binding
│   └── drizzle/                  # SQL migrations
├── PRODUCT.md / DESIGN.md        # Product spec + design tokens
├── vite.config.ts / wrangler config / drizzle.config.ts
```

---

## API Reference

All endpoints return `{ data, meta: { requestId, generatedAt, cursor? } }` or `{ error: { code, message } }`. Mutations require an `idempotency-key` header; all endpoints require the `x-demo-role` header (`citizen` | `bbmp` | `collector`).

| Method | Endpoint | Role(s) | Purpose |
|---|---|---|---|
| GET | `/api/state` | any | Full demo state (with cursor) |
| GET | `/api/sync` | any | Cursor-based event feed |
| POST | `/api/demo/reset` | bbmp | Reset to seed 4242 |
| POST | `/api/demo/tick` | bbmp, collector | Advance simulation 5–300 s |
| POST | `/api/signals` | citizen | Create a waste signal |
| POST | `/api/signals/[signalId]/confirmation` | citizen | Confirm or reopen a proof-accepted Waste Ready pickup |
| POST | `/api/reports` | citizen | Create a garbage report (requires prior photo upload) |
| POST | `/api/reports/[reportId]/confirmation` | citizen | Confirm / reopen cleanup |
| POST | `/api/routing/optimize` | bbmp | Recalculate route plan |
| POST | `/api/routing/publish` | bbmp | Publish a route revision |
| GET | `/api/routing/active` | any | Current route plan |
| GET | `/api/priority/rankings` | any | Ranked open reports with audits |
| GET | `/api/placement/recommendations` | any | Bin placement recommendations |
| GET | `/api/citizen/overview` | citizen | Zone, vehicle, ETA, bins, activity |
| GET | `/api/bbmp/overview` | bbmp | Operations summary |
| POST | `/api/collector/stops/[stopId]/action` | collector | arrived / collected / blocked |
| POST | `/api/collector/stops/[stopId]/proof` | collector | Submit cleanup proof |
| POST | `/api/uploads` | citizen, collector | Evidence photo (magic-byte check, 5 MB cap, R2 + memory fallback) |
| GET | `/api/diagnostics` | any | Health/diagnostics |

Example:

```bash
curl -H "x-demo-role: bbmp" http://localhost:3000/api/state
curl -X POST -H "x-demo-role: bbmp" -H "idempotency-key: demo-key-12345" \
     -H "content-type: application/json" -d '{"seconds":30}' \
     http://localhost:3000/api/demo/tick
```

---

## Domain Algorithms

### Priority scoring (`src/domain/priority.ts`)
Additive, factorized, versioned score per report across **ten visible factors**: garbage amount, affected area, people affected, hygiene risk, obstruction (traffic-lane blockage escalated), report age, population density, building density, nearby-bin fill, and active 24 h citizen demand — plus corroborating reports and safety escalations. Every factor carries raw value, normalized value, weight, contribution, and a plain-language explanation; coverage gaps and manual-review reasons are surfaced, never hidden.

### Route optimization (`src/domain/optimizer.ts`)
`multi-signal-aco-inspired-v1`: **five specialist colonies** (smart-bin fill, citizen demand, report severity, urban density, travel efficiency) each run 18 iterations × 8 ants over a seeded RNG (deterministic per seed). Adaptive weights respond to current urgency and are rate-limited against the previous plan. Constraints: vehicle capacity, 45 km route distance, 8 stops, 480-minute shift; collected/arrived stops stay locked. Distances are labelled Haversine × 1.25 at 20 km/h. Every stop gets per-signal contributions and a human-readable explanation; infeasible work lands in an *unassigned* list with reasons.

### Bin placement (`src/domain/placement.ts`)
Nine-factor scoring (population, building density, coverage gap, citizen demand, report hotspot, POI activity, road access, pedestrian access, public-land availability) with 300 m diversity suppression, confidence scoring, and mandatory field-validation warnings when land ownership is unknown. An intentionally unsafe candidate (highway median) demonstrates the exclusion path.

### Shared simulation (`src/domain/simulate.ts`)
Single source of truth for tick rules, bin thresholds (filling ≥ 70%, full ≥ 94%), event-id generation, and citizen-report field defaults — imported by both the client provider and server store.

---

## Data & Persistence

- **Scenario** — `src/data/demo.ts` builds the deterministic seed-4242 world: 4 vehicles, 10 smart bins, 6 reports, 6 signals, 8 placement candidates, all timestamped from a fixed demo epoch.
- **Runtime state** — in-memory `DemoState` on the worker (`globalThis`); reads stay in memory for demo speed.
- **D1 journal** — state changes are append-only events, best-effort persisted to the `event_journal` D1 table via Drizzle (`db/schema.ts` defines the full 17-table schema for future hardening). Absent binding ⇒ silent memory-only fallback.
- **Evidence photos** — uploaded to private R2 objects (memory fallback); validated by magic-byte signature, 5 MB cap, and re-encoded client-side to strip EXIF/metadata before upload.
- **Bounded caches** — idempotency keys (200) and in-memory uploads (60) are capped FIFO; no unbounded growth.
- **Client** — only the language preference (`bsw-locale`) is persisted in localStorage; it is restored on load.

---

## Design System

"Namma Civic Atlas" — a calm, high-contrast public-service UI (spec in `DESIGN.md`, tokens in `app/globals.css:1`):

- **Palette**: warm paper `#f4f2e9`, near-white surfaces, Bengaluru green (`--green #176b48` / `--green-dark #0e5035` / `--green-deep #083e29`) for primary actions; amber reserved for attention/waste-outside; red for reports/blocked/full/offline; focus blue `#146bd1` for the universal keyboard ring. All colors are CSS custom properties — no ad-hoc hex values.
- **Typography**: Noto Sans (display + body) with tight-tracked headlines; Noto Sans Kannada mandatory for Kannada copy.
- **Layout**: thin 1px rules, restrained depth, 14 px panel radius, 44 px minimum control height, tabular numerals for metrics.
- **Responsive**: breakpoints at 1050/1000/760/720 px; grids collapse to single columns; ops tabs scroll horizontally on mobile.
- **Motion**: subtle 160–170 ms transitions; fully disabled under `prefers-reduced-motion`.

---

## Accessibility & i18n

Targeting WCAG 2.2 AA:

- 3 px visible `:focus-visible` ring everywhere, including the file-upload control (`focus-within`).
- Full keyboard support: roving-tabindex tab list with arrow-key navigation (BBMP tabs), skip-to-content link on landing, accessible map alternative — every map ships a keyboard/screen-reader location list with legend parity, plus loading, tile-error, and retry states.
- Semantic status: `role="alert"` for errors, `aria-live="polite"` scoped to the action message (not the chatty cursor), `aria-pressed`, `aria-busy`, `aria-selected`, sr-only headings.
- Empty and degraded states are honest: "no vehicles online", "no bin telemetry", sync-failure banner with dismiss — nothing hides offline/stale conditions.
- **Bilingual**: the entire citizen flow — hero, quick signals, form labels *and options*, severity levels, validation messages, empty states, and dates — is available in English and Kannada, persisted across reloads.

---

## Testing

```bash
npm test   # vitest
```

- `src/domain/priority.test.ts` — factor scoring, bands, safety escalations, coverage.
- `src/domain/optimizer.test.ts` — deterministic replay for seed 4242, no duplicate work, five explained signals per stop, citizen signals become routable work.
- `src/domain/simulate.test.ts` — bin thresholds, post-increment status correctness, unique event ids with monotonic cursors, shared report defaults, traffic-lane escalation.
- `src/domain/placement.test.ts` — 9-factor scoring, diversity suppression, unsafe exclusion.
- Playwright e2e config is included (`@playwright/test`); test ids like `data-testid="report-form"` are embedded throughout for scripting.

All 13 unit tests pass; `tsc --noEmit` and the production build are clean.

---

## Deployment (Cloudflare)

The app targets Cloudflare Workers with bindings defined in `.openai/hosting.json`:

- `DB` — D1 database for the event journal (optional; falls back to memory).
- `FILES` — R2 bucket for private evidence photos (optional; falls back to memory).

```bash
npm run build
npx wrangler deploy
```

Without bindings, everything still runs — persistence simply degrades to per-isolate memory.

---

## Product Principles

1. **Explain before optimizing.**
2. Keep human judgment and overrides visible.
3. Turn citizen signals into operational work.
4. Treat verified cleanup as the end of the workflow.
5. Use real geography and honest simulation.
6. Degrade safely when maps, uploads, routing, telemetry, or connectivity fail.
7. Protect exact citizen locations outside operational detail.

---

## Known Limitations

- This is a labelled demo: no production identity, payments, notifications, or live BBMP system integration.
- Operational telemetry (vehicles, bins, ETAs) is synthetic seed-4242 data and must never be presented as official BBMP telemetry.
- The `x-demo-role` header is a demo guard, not authentication.
- In-memory state resets when a worker isolate recycles (the D1 journal preserves the audit trail); route-replay animation is a planned stretch feature.

---

*Map data © OpenStreetMap contributors (ODbL). Bengaluru Smart Waste Management — real streets, honest simulation.*
