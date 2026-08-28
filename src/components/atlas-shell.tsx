"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { AppHeader } from "./app-header";

/** Command Atlas shell: floating glass chrome over a full-height page. */
export function AtlasShell({ role, children }: { role: "citizen" | "bbmp" | "collector"; children: ReactNode }) {
  return <main className="atlas-main">
    <a className="skip-link" href="#atlas-content">Skip to content</a>
    <AppHeader role={role} />
    <div id="atlas-content">{children}</div>
  </main>;
}

/**
 * Why-drawer: the explainability slide-over. Desktop = right slide-over,
 * mobile = bottom sheet. Enter/exit share one path (spatial consistency);
 * the exit animates before unmount so the drawer leaves the way it came.
 */
export function WhyDrawer({ open, onClose, eyebrow, title, children }: {
  open: boolean; onClose: () => void; eyebrow?: string; title: ReactNode; children: ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") requestClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function requestClose() {
    if (closing) return;
    setClosing(true);
    timer.current = setTimeout(() => {
      setClosing(false);
      onClose();
      restoreRef.current?.focus?.();
    }, 240);
  }

  if (!open) return null;
  return <>
    <button type="button" className="drawer-scrim" aria-label="Close details" onClick={requestClose} />
    <section className="drawer" data-closing={closing || undefined} role="dialog" aria-modal="true">
      <header className="drawer-head">
        <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 className="title">{title}</h2></div>
        <button type="button" ref={closeRef} className="drawer-close" onClick={requestClose} aria-label="Close details"><X size={17} /></button>
      </header>
      <div className="drawer-body">{children}</div>
    </section>
  </>;
}
