"use client";

import Link from "next/link";
import { uiCopy } from "../src/data/copy";
import { useDemo } from "../src/components/demo-provider";

const roleMeta = [
  { href: "/citizen", key: "citizen" as const },
  { href: "/bbmp", key: "bbmp" as const },
  { href: "/collector", key: "collector" as const },
];

export default function Home() {
  const { locale, setLocale } = useDemo();
  const copy = uiCopy[locale].landing;

  return (
    <main className="paper-front">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Bengaluru Smart Waste home">
          <span className="brand-mark" aria-hidden="true">BW</span>
          <span><strong>Bengaluru Smart Waste</strong><small>Mahadevapura pilot</small></span>
        </Link>
        <nav className="landing-nav" aria-label="Landing page navigation">
          <a className="text-link" href="/data-assumptions">{copy.footerLink}</a>
        </nav>
      </header>
      <section className="mast" id="main-content">
        <div>
          <p className="eyebrow">{copy.badge}</p>
          <h1 className="display-1">{copy.hero}</h1>
          <p className="title" style={{ marginTop: "var(--space-3)", color: "var(--ink-mid)" }}>{copy.sub}</p>
          <div className="hero-actions" style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-5)", flexWrap: "wrap" }}>
            {roleMeta.map((role) => {
              const strings = copy.roles[role.key];
              return (
                <Link key={role.href} href={role.href} className="landing-button landing-button-primary">
                  <strong>{strings.title}</strong>
                  <span>{strings.action}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      <section className="role-index" aria-label="How the loop works">
        <div className="index-heading">
          <p className="eyebrow">{copy.badge}</p>
          <h2 className="display-2">From signal to cleanup</h2>
        </div>
        <ul className="ledger-rows">
          {roleMeta.map((role, i) => {
            const strings = copy.roles[role.key];
            return (
              <li key={role.href} className="ledger-row">
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div className="index-copy">
                  <strong>{strings.title}</strong>
                  <p>{strings.copy}</p>
                </div>
                <Link href={role.href} className="landing-button landing-button-secondary">{strings.action}</Link>
              </li>
            );
          })}
        </ul>
      </section>
      <footer className="landing-footer">
        <p>Bengaluru Smart Waste</p>
        <p>Real Bengaluru geography. Simulated operational data.</p>
        <a href="/data-assumptions">{copy.footerLink}</a>
      </footer>
    </main>
  );
}
