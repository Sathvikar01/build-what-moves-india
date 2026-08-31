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
    <main>
      <h1>{copy.hero}</h1>
      <p>{copy.sub}</p>
      <nav>
        {roleMeta.map((role) => {
          const strings = copy.roles[role.key];
          return (
            <Link key={role.href} href={role.href}>
              <strong>{strings.title}</strong>
              <p>{strings.copy}</p>
              <span>{strings.action}</span>
            </Link>
          );
        })}
      </nav>
      <footer>
        <p>Bengaluru Smart Waste</p>
        <p>{copy.footerTag}</p>
        <a href="/data-assumptions">{copy.footerLink}</a>
      </footer>
    </main>
  );
}
