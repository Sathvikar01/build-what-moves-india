# Winning Strategy Round 1 Implementation Plan

> **Execution:** Inline on `feat/winning-strategy-round1`, test-first, with a final full-suite and production-build verification.

**Goal:** Strengthen the hackathon demo around one complete, honest citizen journey, current 2026 waste segregation guidance, accessibility/low-data resilience, and a deterministic baseline-vs-adaptive impact replay.

**Architecture:** Keep the existing seed-4242 simulation as the source of truth. Add pure domain helpers for waste-stream guidance, SLA state, and impact comparison; render them in citizen and transparency surfaces without claiming live government integration. Impact metrics are computed from the same fixed scenario and display raw values, method, seed, compute time, and fallback status.

**Tech Stack:** React 19, Next.js App Router, TypeScript, Vitest, existing CSS design tokens.

### Task 1: Honest governance framing

**Files:** Modify `src/components/app-header.tsx`, `app/page.tsx`, `app/data-assumptions/page.tsx`.

1. Add a visible independent-prototype/synthetic-data statement.
2. Replace outdated operator-only framing with GBA/BSWML-compatible neutral wording.
3. Link directly to assumptions and impact replay.

### Task 2: 2026 four-stream guidance

**Files:** Create `src/domain/waste-streams.ts`, `src/domain/waste-streams.test.ts`; modify `src/data/copy.ts`, `app/citizen/page.tsx`.

1. Write failing tests for wet, dry, sanitary, and special-care stream classification and exception instructions.
2. Implement typed bilingual guidance.
3. Add a citizen schedule/checklist card with large, semantic controls.

### Task 3: Complete citizen service loop and low-data mode

**Files:** Create `src/domain/service-journey.ts`, `src/domain/service-journey.test.ts`; modify `app/citizen/page.tsx`, `app/globals.css`.

1. Write failing tests for journey stages and overdue escalation.
2. Implement derived ETA/reason/proof/confirm/reopen/SLA status.
3. Render a single end-to-end journey tracker and low-data list toggle that removes map tiles while preserving route/status details.

### Task 4: Deterministic Impact Replay

**Files:** Create `src/domain/impact-replay.ts`, `src/domain/impact-replay.test.ts`, `app/impact-replay/page.tsx`; modify `app/globals.css`, `app/page.tsx`, `README.md`.

1. Write failing deterministic and accounting tests.
2. Compute fixed-baseline and adaptive outcomes from explicit scenario inputs using seed 4242.
3. Show missed pickups, overflow risk, waiting, longest-neglected locality, fairness gap, route distance, fuel/CO2 proxy, compute time, and fallback status with honest methodology.

### Task 5: Verification and handoff

1. Run targeted tests after every domain increment.
2. Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` fresh.
3. Review the diff for scope and honesty, commit, and push only `feat/winning-strategy-round1`.
