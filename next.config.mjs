import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const dev = process.env.NODE_ENV !== "production"

// What the pages are allowed to load. Course videos are YouTube (privacy mode) iframes; images can be data: or https:.
// Next.js needs inline scripts/styles to run, so those two stay allowed. Everything else is locked to this site.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "frame-src https://www.youtube-nocookie.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" }, // internal workspace: keep it out of search engines
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false, // hides the little Next.js circle in the bottom-left corner
  poweredByHeader: false,
  turbopack: { root: here }, // this folder is the project, even if a stray package-lock.json sits in a parent folder
  // The Claude skill zips are read from disk by /api/skills/[name]; make sure Vercel ships them with that function.
  outputFileTracingIncludes: { "/api/skills/[name]": ["./skills/*.zip"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}
export default nextConfig
