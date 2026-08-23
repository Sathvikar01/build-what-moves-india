"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type DemoRole = "citizen" | "bbmp" | "collector";
export type DemoUser = { name: string; phone: string; role: DemoRole; loggedInAt: string };

type AuthContextValue = {
  user: DemoUser | null;
  login: (user: Omit<DemoUser, "loggedInAt">) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "bsw-user";

// Mock demo auth: any name + 10-digit phone works; identity lives in
// localStorage only. There are no real credentials in this pilot.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as DemoUser);
    } catch { /* ignore corrupt state */ }
  }, []);

  const login = useCallback((input: Omit<DemoUser, "loggedInAt">) => {
    const next: DemoUser = { ...input, loggedInAt: new Date().toISOString() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setUser(next);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}

// Client-side page guard: redirects to /login when no session exists.
export function useRequireUser() {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (user !== null) { setReady(true); return; }
    // Wait one tick so the localStorage restore effect can run first.
    const timer = setTimeout(() => {
      const next = window.location.pathname;
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
      } else setReady(true);
    }, 150);
    return () => clearTimeout(timer);
  }, [user]);
  return { user, ready: user !== null ? true : ready };
}
