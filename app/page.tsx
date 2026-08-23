"use client";

import { ArrowRight, Building2, MapPin, Recycle, Route, ShieldCheck } from "lucide-react";
import { BengaluruMap, MOCK_USER_LOCATION, type MapMarker } from "../src/components/bengaluru-map";
import { routeOnRoads } from "../src/domain/road-graph";
import { LOCATION_SOURCE, MAHADEVAPURA_LOCATIONS } from "../src/data/locations";
import { uiCopy } from "../src/data/copy";
import { useDemo } from "../src/components/demo-provider";
import type { GeoPoint } from "../src/domain/types";

const landingMarkers: MapMarker[] = [
  { id: "vehicle-whitefield", label: "Collection vehicle KA-01-AF-2147", location: { lat: 12.9685, lng: 77.7358 }, kind: "vehicle", detail: "9 min away" },
  { id: "bin-kundalahalli", label: MAHADEVAPURA_LOCATIONS.kundalahalliMarket.label, location: MAHADEVAPURA_LOCATIONS.kundalahalliMarket.location, kind: "bin", detail: "88% full" },
  { id: "report-marathahalli", label: MAHADEVAPURA_LOCATIONS.marathahalliServiceLane.label, location: MAHADEVAPURA_LOCATIONS.marathahalliServiceLane.location, kind: "report", detail: "route updated" },
  { id: "report-whitefield", label: `${MAHADEVAPURA_LOCATIONS.itplGate.label} overflow report`, location: MAHADEVAPURA_LOCATIONS.itplGate.location, kind: "report", detail: "high priority" },
];

const landingRoute: GeoPoint[] = [
  MAHADEVAPURA_LOCATIONS.marathahalliServiceLane.location,
  MAHADEVAPURA_LOCATIONS.kundalahalliMarket.location,
  { lat: 12.9685, lng: 77.7358 },
  MAHADEVAPURA_LOCATIONS.itplGate.location,
];

const roleMeta = [
  { href: "/citizen", key: "citizen" as const, icon: Recycle },
  { href: "/bbmp", key: "bbmp" as const, icon: Building2 },
  { href: "/collector", key: "collector" as const, icon: Route },
];

const landingVehicleLocation: GeoPoint = { lat: 12.9685, lng: 77.7358 };
const landingRoadRoute = routeOnRoads([landingVehicleLocation, ...landingRoute, landingVehicleLocation]);

export default function Home() {
  const { locale, setLocale } = useDemo();
  const copy = uiCopy[locale].landing;
  return (
    <main className="landing-shell" lang={locale === "kn" ? "kn" : "en"}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Bengaluru Smart Waste home">
          <span className="brand-mark" aria-hidden="true">BW</span>
          <span><strong>Bengaluru Smart Waste</strong><small>Mahadevapura pilot</small></span>
        </a>
        <nav className="landing-nav" aria-label="Landing page navigation">
          <span className="demo-badge"><ShieldCheck size={14} aria-hidden="true" />{copy.badge}</span>
          <button type="button" className="quiet-button" onClick={() => setLocale(locale === "en" ? "kn" : "en")} aria-label="Switch language">{locale === "en" ? "ಕನ್ನಡ" : "English"}</button>
          <a className="text-link" href="/data-assumptions">{copy.dataLink}</a>
          <a className="text-link" href="/login">{uiCopy[locale].signIn}</a>
        </nav>
      </header>

      <section className="landing-hero" id="main-content">
        <div className="hero-copy">
          <h1>{copy.hero}</h1>
          <p>{copy.sub}</p>
          <div className="hero-actions" aria-label="Start using the demo">
            <a className="landing-button landing-button-primary" href="/citizen" data-testid="hero-citizen">
              {copy.primaryAction} <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a className="landing-button landing-button-secondary" href="/bbmp" data-testid="hero-operations">
              {copy.secondaryAction}
            </a>
          </div>
        </div>

        <div className="landing-map-panel">
          <div className="map-panel-heading">
            <div>
              <MapPin size={18} aria-hidden="true" />
              <span><strong>{copy.mapTitle}</strong><small>{LOCATION_SOURCE.label} · place geography</small></span>
            </div>
            <span className="map-live-state">{copy.mapState}</span>
          </div>
          <BengaluruMap markers={landingMarkers} route={landingRoadRoute} vehiclePaths={[{ vehicleId: "vehicle-whitefield", path: landingRoadRoute }]} userLocation={MOCK_USER_LOCATION} height="clamp(340px, 44vw, 520px)" />
          <div className="map-summary" aria-label="Map summary">
            <span><strong>{landingMarkers.length}</strong> {copy.locations}</span>
            <span><strong>1</strong> {copy.routeRevision}</span>
            <span><strong>9 min</strong> {copy.nearest}</span>
          </div>
        </div>
      </section>

      <section className="landing-truth-strip" aria-label="Demo data summary">
        {copy.truth.map(([title, detail]) => (
          <p key={title}><strong>{title}</strong><span>{detail}</span></p>
        ))}
      </section>

      <section className="role-section" aria-labelledby="choose-role">
        <div className="role-heading">
          <h2 id="choose-role">{copy.chooseTitle}</h2>
          <p>{copy.chooseSub}</p>
        </div>
        <div className="role-list">
          {roleMeta.map((role) => {
            const Icon = role.icon;
            const strings = copy.roles[role.key];
            return (
              <a className="role-row" href={role.href} key={role.href}>
                <span className="role-icon" aria-hidden="true"><Icon size={21} /></span>
                <span className="role-name"><strong>{strings.title}</strong><small lang="kn">{locale === "kn" ? "Citizen service · BBMP · Collector" : "ನಾಗರಿಕ ಸೇವೆ · ಕಾರ್ಯಾಚರಣೆ · ಸಂಗ್ರಹ"}</small></span>
                <span className="role-copy">{strings.copy}</span>
                <span className="role-action">{strings.action}<ArrowRight size={17} aria-hidden="true" /></span>
              </a>
            );
          })}
        </div>
      </section>

      <footer className="landing-footer">
        <p>Bengaluru Smart Waste Management</p>
        <p>{copy.footerTag}</p>
        <a href="/data-assumptions">{copy.footerLink}</a>
      </footer>
    </main>
  );
}
