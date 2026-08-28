"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Building2, ChevronDown, MapPin, Recycle, Route, ShieldCheck } from "lucide-react";
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
  { href: "/citizen", key: "citizen" as const, icon: Recycle, accent: "var(--lime)" },
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
  // Live-from-seed numbers: the map strip and the civic loop both read from
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
    <main className="landing-shell" lang={locale === "kn" ? "kn" : "en"}>
      <div className="hero-atmosphere" aria-hidden="true" />
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

      {/* First screen IS the map. Content floats on glass above it. */}
      <section className="landing-hero" id="main-content">
        <div className="hero-map-layer" aria-hidden="false">
          <BengaluruMap markers={landingMarkers} route={landingRoadRoute} vehiclePaths={[{ vehicleId: landingVehicle.id, path: landingRoadRoute }]} userLocation={seedState.userLocation?.location ?? MOCK_USER_LOCATION} height="100%" />
        </div>
        <div className="hero-overlay">
          <div className="hero-overlay-copy">
            <h1 className="rise"><HeroHeadline text={copy.hero} /></h1>
            <p className="rise rise-1">{copy.sub}</p>
            <div className="hero-actions rise rise-2">
              <a className="landing-button landing-button-primary" href="/citizen" data-testid="hero-citizen">
                {copy.primaryAction} <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a className="landing-button landing-button-secondary" href="/bbmp" data-testid="hero-operations">
                {copy.secondaryAction}
              </a>
            </div>
          </div>
          <div className="hero-dock rise rise-3">
            <span className="stat"><strong>{summary.locations}</strong> {copy.locations}</span>
            <span className="stat"><strong>{summary.revisions}</strong> {copy.routeRevision}</span>
            <span className="stat"><strong>{summary.nearest}</strong> {copy.nearest}</span>
            <span className="spacer" />
            <span className="source-chip"><MapPin size={12} aria-hidden="true" /> {LOCATION_SOURCE.label}</span>
            <a className="scroll-cue" href="#loop" aria-label="Scroll to how it works"><ChevronDown size={16} aria-hidden="true" /></a>
          </div>
        </div>
      </section>

      {/* The civic loop, counted live from the seeded scenario */}
      <section className="loop-strip" id="loop" aria-label="How the loop works">
        {loopSteps.map((label, index) => (
          <div className={`loop-step rise rise-${Math.min(index + 1, 5)}`} key={label}>
            <i aria-hidden="true">{String(index + 1).padStart(2, "0")}</i>
            <strong>{label}</strong>
            <b>{loopCounts[index]}</b>
          </div>
        ))}
      </section>
      <p className="muted" style={{ margin: 0, padding: "0 clamp(16px, 4vw, 56px)", textAlign: "center", fontSize: "0.78rem" }}>{copy.footerTag} · seed 4242</p>

      <section className="role-section" aria-labelledby="choose-role">
        <div className="role-heading">
          <h2 id="choose-role">{copy.chooseTitle}</h2>
          <p>{copy.chooseSub}</p>
        </div>
        <div className="role-cards">
          {roleMeta.map((role, index) => {
            const Icon = role.icon;
            const strings = copy.roles[role.key];
            return (
              <a className={`role-card rise rise-${Math.min(index + 1, 5)}`} href={role.href} key={role.href} style={{ "--card-accent": role.accent } as React.CSSProperties}>
                <div className="role-card-head">
                  <span className="role-icon" aria-hidden="true"><Icon size={22} /></span>
                  <span className="role-card-no" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <strong>{strings.title}</strong>
                <p>{strings.copy}</p>
                <span className="role-card-go">{strings.action}<ArrowRight size={16} aria-hidden="true" /></span>
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
