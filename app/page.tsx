"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2, MapPin, Recycle, Route, ShieldCheck } from "lucide-react";
import { BengaluruMap, MOCK_USER_LOCATION, type MapMarker } from "../src/components/bengaluru-map";
import { routeOnRoads } from "../src/domain/road-graph";
import { LOCATION_SOURCE } from "../src/data/locations";
import { uiCopy, citizenCopy } from "../src/data/copy";
import { useDemo } from "../src/components/demo-provider";
import { createDemoState } from "../src/data/demo";
import { tripStatusFor } from "../src/components/trip-status";

// The landing preview is generated from the same deterministic seed-4242
// scenario every console uses — no hand-written numbers on this page.
const seedState = createDemoState();
const landingVehicle = seedState.vehicles.find(v => v.status !== "offline") ?? seedState.vehicles[0];
const landingStops = seedState.route.routes[0]?.stops ?? [];

const landingMarkers: MapMarker[] = [
  { id: landingVehicle.id, label: landingVehicle.label, location: landingVehicle.location, kind: "vehicle", detail: `${landingVehicle.status.replaceAll("_", " ")} · synthetic` },
  ...(seedState.userLocation ? [{ id: seedState.userLocation.id, label: "Citizen handover point", location: seedState.userLocation.location, kind: "pickup" as const, detail: "mock live location · ACO-routed stop" }] : []),
  ...[...seedState.bins].sort((a, b) => b.fillPercent - a.fillPercent).slice(0, 3).map(bin => ({
    id: bin.id, label: bin.label, location: bin.location, kind: "bin" as const,
    detail: `${Math.round(bin.fillPercent)}% full`, overflow: bin.fillPercent >= 100,
  })),
  ...seedState.reports.filter(report => report.status !== "confirmed").slice(0, 2).map(report => ({
    id: report.id, label: report.title, location: report.location, kind: "report" as const,
    detail: `${report.priority.audit.effectiveScore.toFixed(1)} · ${report.priority.audit.effectiveBand}`,
  })),
];

const landingRoadRoute = routeOnRoads([
  landingVehicle.location,
  ...landingStops.map(stop => stop.location),
  landingVehicle.location,
]);

const roleMeta = [
  { href: "/citizen", key: "citizen" as const, icon: Recycle, accent: "var(--accent)" },
  { href: "/bbmp", key: "bbmp" as const, icon: Building2, accent: "var(--blue)" },
  { href: "/collector", key: "collector" as const, icon: Route, accent: "var(--teal)" },
];

// Lime-highlight the payoff sentence of the hero headline (last ". " split;
// copy without an inner sentence break renders plain).
function HeroHeadline({ text }: { text: string }) {
  const cut = text.lastIndexOf(". ");
  if (cut < 0) return <>{text}</>;
  return <>{text.slice(0, cut + 1)} <em>{text.slice(cut + 2)}</em></>;
}

export default function Home() {
  const { locale, setLocale } = useDemo();
  const copy = uiCopy[locale].landing;
  // Live-from-seed numbers: the masthead board and the ledger both read from
  // the same deterministic scenario the consoles run — no hand-written stats.
  const summary = useMemo(() => {
    const trip = tripStatusFor(seedState);
    const nearestEta = trip?.etaToNextMinutes ?? Math.min(...seedState.signals.map(signal => signal.etaMinutes ?? 9), 9);
    return {
      locations: landingMarkers.length,
      revisions: seedState.route.version,
      nearest: `${nearestEta} min`,
    };
  }, []);
  // The civic loop in five steps — labels reuse the tracker step copy (EN/KN),
  // counts come straight from the seeded scenario.
  const loopSteps = citizenCopy[locale].steps.slice(0, 5);
  const loopCounts = useMemo(() => [
    seedState.signals.length,
    seedState.reports.length,
    seedState.route.routes[0]?.stops.length ?? 0,
    seedState.proofs.length,
    seedState.reports.filter(report => report.status === "confirmed").length,
  ], []);
  return (
    <main className="paper-front" lang={locale === "kn" ? "kn" : "en"}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Bengaluru Smart Waste home">
          <span className="brand-mark" aria-hidden="true">BW</span>
          <span><strong>Bengaluru Smart Waste</strong><small>Mahadevapura pilot</small></span>
        </Link>
        <nav className="landing-nav" aria-label="Landing page navigation">
          <span className="demo-badge"><ShieldCheck size={14} aria-hidden="true" />{copy.badge}</span>
          <button type="button" className="quiet-button" onClick={() => setLocale(locale === "en" ? "kn" : "en")} aria-label={locale === "en" ? "Switch language to Kannada" : "Switch language to English"}>{locale === "en" ? "ಕನ್ನಡ" : "English"}</button>
          <a className="text-link" href="/data-assumptions">{copy.dataLink}</a>
          <a className="text-link" href="/login">{uiCopy[locale].signIn}</a>
        </nav>
      </header>

      {/* Broadsheet masthead: the paper opens with type, not a map. */}
      <section className="mast" id="main-content">
        <div className="mast-rule" aria-hidden="true">
          <span>Mahadevapura pilot</span>
          <span>Wards 28–50 · GBA 2025</span>
          <span>{copy.badge}</span>
        </div>
        <h1 className="mast-headline mast-wipe rise"><HeroHeadline text={copy.hero} /></h1>
        <div className="mast-under">
          <p className="mast-deck rise rise-1">{copy.sub}</p>
          <div className="mast-actions rise rise-2">
            <a className="landing-button landing-button-primary" href="/citizen" data-testid="hero-citizen">
              {copy.primaryAction} <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a className="landing-button landing-button-secondary" href="/bbmp" data-testid="hero-operations">
              {copy.secondaryAction}
            </a>
          </div>
        </div>
        <dl className="mast-board rise rise-3">
          <div><dt>{copy.locations}</dt><dd>{summary.locations}</dd></div>
          <div><dt>{copy.routeRevision}</dt><dd>{summary.revisions}</dd></div>
          <div><dt>{copy.nearest}</dt><dd>{summary.nearest}</dd></div>
          <div className="board-source"><dt>Data</dt><dd><MapPin size={12} aria-hidden="true" /> {LOCATION_SOURCE.label}</dd></div>
        </dl>
      </section>

      {/* The map returns as a captioned figure, the way a report prints one. */}
      <section className="map-figure" aria-label="Live pilot map">
        <div className="map-figure-caption">
          <span className="fig-no">Fig. 01</span>
          <strong>Live operations board</strong>
          <span>{summary.nearest} · nearest collection</span>
          <a className="fig-link" href="/citizen">Open citizen map <ArrowUpRight size={14} aria-hidden="true" /></a>
        </div>
        <div className="map-figure-stage">
          <BengaluruMap markers={landingMarkers} route={landingRoadRoute} vehiclePaths={[{ vehicleId: landingVehicle.id, path: landingRoadRoute }]} userLocation={seedState.userLocation?.location ?? MOCK_USER_LOCATION} height="100%" interactive={false} />
        </div>
      </section>

      {/* The civic loop printed as a numbered ledger with live counts */}
      <section className="ledger" id="loop" aria-label="How the loop works">
        <div className="ledger-head">
          <h2>{copy.truth[2][0]}</h2>
        </div>
        <ol className="ledger-rows">
          {loopSteps.map((label, index) => (
            <li className={`ledger-row rise rise-${Math.min(index + 1, 5)}`} key={label}>
              <i aria-hidden="true">{String(index + 1).padStart(2, "0")}</i>
              <strong>{label}</strong>
              <span className="ledger-count"><b>{loopCounts[index]}</b></span>
            </li>
          ))}
        </ol>
        <p className="loop-note">{copy.footerTag} · seed 4242</p>
      </section>

      {/* Roles as a table-of-contents: full-width index rows, not cards */}
      <section className="role-index" aria-labelledby="choose-role">
        <div className="index-heading">
          <h2 id="choose-role">{copy.chooseTitle}</h2>
          <p>{copy.chooseSub}</p>
        </div>
        <div className="index-rows">
          {roleMeta.map((role, index) => {
            const Icon = role.icon;
            const strings = copy.roles[role.key];
            return (
              <a className={`index-row rise rise-${Math.min(index + 1, 5)}`} href={role.href} key={role.href} style={{ "--card-accent": role.accent } as React.CSSProperties}>
                <span className="index-no" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span className="index-icon" aria-hidden="true"><Icon size={24} /></span>
                <span className="index-copy">
                  <strong>{strings.title}</strong>
                  <p>{strings.copy}</p>
                </span>
                <span className="index-go">{strings.action}<ArrowRight size={16} aria-hidden="true" /></span>
              </a>
            );
          })}
        </div>
      </section>

      <footer className="landing-footer">
        <p>Bengaluru Smart Waste</p>
        <p>{copy.footerTag}</p>
        <a href="/data-assumptions">{copy.footerLink}</a>
      </footer>
    </main>
  );
}
