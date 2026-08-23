import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root so the lockfile/git-root inference
  // warning never fails a clean CI/Vercel checkout.
  turbopack: { root: process.cwd() },
  async headers(){return [{source:"/(.*)",headers:[
    {key:"X-Content-Type-Options",value:"nosniff"},{key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},{key:"X-Frame-Options",value:"DENY"},{key:"Permissions-Policy",value:"geolocation=(self), camera=(self), microphone=()"},
    {key:"Content-Security-Policy",value:"default-src 'self'; img-src 'self' data: blob: https://*.tile.openstreetmap.org; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://*.tile.openstreetmap.org; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"}
  ]}]}
};

export default nextConfig;
