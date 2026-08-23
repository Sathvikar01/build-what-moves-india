# Bengaluru Smart Waste Management

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated: OpenAI Sites TypeScript/React capability project with D1-compatible relational persistence, R2-compatible image storage, cursor-based synchronization, and a repository-compatible local development store.

## Users

- Citizens requesting collection, reporting garbage, finding usable bins, following trucks, and confirming cleanup.
- BBMP operations staff monitoring demand, ranking work, publishing routes, reviewing cleanup, and planning bin placement.
- Collectors following assigned routes and submitting proof of collection.
- Hackathon judges and civic stakeholders evaluating the transparent end-to-end workflow.

## Product Purpose

Reduce the time between waste appearing in Mahadevapura and verified cleanup by making citizen demand visible, prioritization auditable, routes adaptive, and completion measurable.

## Positioning

A transparent civic coordination layer for Bengaluru, not merely a complaint form, truck map, or opaque optimization dashboard. Every important decision explains what was observed, how it was weighted, what action followed, and whether cleanup was verified.

## Operating Context

- Single-zone pilot covering Mahadevapura wards 28–50 in Bengaluru East City Corporation, with the deepest scenario in Whitefield, Kundalahalli, Dodda Nekkundi, Marathahalli, and Bellanduru.
- Citizen mobile web, BBMP desktop control room, and collector mobile web share one deterministic scenario.
- Current GBA/BBMP boundary context and real Bengaluru geography are paired with clearly labelled synthetic operational telemetry.
- Seed `4242` reproduces the same vehicles, bins, reports, routes, and explanations.

## Capabilities and Constraints

- Citizen: live truck/ETA, two waste signals, photo and geolocation reporting, nearby bin status, activity, and cleanup confirmation.
- BBMP: live vehicles, demand, bin fill, reports, explainable priority, multi-signal route optimization, cleanup state, and explainable bin-placement recommendations.
- Collector: route revisions, navigation sequence, arrival, blocked access, collection, offline-safe proof upload, and completion.
- Priority and placement scores are additive, factorized, versioned, and auditable; no unexplained score is allowed.
- Routing uses five ACO-inspired signal colonies with visible adaptive weights, constraints, fallbacks, and stop explanations.
- No production identity, payments, notifications, or live BBMP system integration are included.

## Brand Commitments

The product name is Bengaluru Smart Waste Management. The interface uses the user-approved calm “Namma civic atlas” direction: light, high-contrast public-service UI, restrained Bengaluru green with semantic amber and red, real maps, accessible list alternatives, English and Kannada citizen flows, and minimal motion.

## Evidence on Hand

- Official GBA/BBMP corporation maps and Mahadevapura ward population report.
- Census India 2011 demographic context.
- OpenStreetMap roads, buildings, places, and exclusions with attribution.
- Google Open Buildings aggregates where needed.
- Live vehicle, sensor, citizen, ETA, route, and cleanup records are synthetic demo data and must never be presented as official telemetry.

## Product Principles

1. Explain before optimizing.
2. Keep human judgment and overrides visible.
3. Turn citizen signals into operational work.
4. Treat verified cleanup as the end of the workflow.
5. Use real geography and honest simulation.
6. Degrade safely when maps, uploads, routing, telemetry, or connectivity fail.
7. Protect exact citizen locations outside operational detail.

## Accessibility & Inclusion

- English and Kannada support all citizen-critical flows.
- Meet WCAG 2.2 AA with keyboard navigation, visible focus, semantic status labels, screen-reader names, 44 px targets, reduced motion, and contrast-safe colors.
- Map information always has a list or table alternative.
- Location denial, stale data, offline mode, upload failure, and tile failure have plain-language recovery paths.
