// Optional Cloudflare bindings. The "cloudflare:workers" module only exists
// inside workerd, so it must never appear as a statically resolvable import -
// Vercel/Next builds fail on it during page-data collection. The specifier is
// kept in a variable so Turbopack/webpack leave it as a runtime import, and
// the failure is swallowed outside Cloudflare (memory-only demo mode).
type CloudflareEnv = {
  FILES?: { put(key: string, value: Uint8Array, options?: unknown): Promise<unknown> };
  DB?: unknown;
};

export async function getCloudflareEnv(): Promise<CloudflareEnv | null> {
  try {
    const specifier = "cloudflare:" + "workers";
    const mod = (await import(/* @vite-ignore */ specifier)) as { env?: CloudflareEnv };
    return mod.env ?? null;
  } catch {
    return null;
  }
}
