/** @type {import('next').NextConfig} */

// Security headers on every response (pre-launch audit S1).
// CSP is kept to the directives that can't break the page: no framing, no plugins, forms/base only to this site.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // No next/image in this app: switch the built-in image optimizer off so its endpoint can't be abused (audit S22).
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
