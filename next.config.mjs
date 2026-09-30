/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
    outputFileTracingIncludes: {
      "/api/**/*": ["./node_modules/pdfjs-dist/**/*"],
    },
  },
  async rewrites() {
    if (!process.env.CLERK_PROXY_DESTINATION) {
      return [];
    }
    return [
      {
        source: "/__clerk/:path*",
        destination: process.env.CLERK_PROXY_DESTINATION,
      },
    ];
  },
  async headers() {
    // Clerk client-side authentication SDK requires 'unsafe-eval' for runtime compilation/widgets
    const scriptSrc =
      "'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev";

    const cspHeader = [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "worker-src 'self' blob:",
      "connect-src 'self' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://generativelanguage.googleapis.com https://*.blob.vercel-storage.com https://vercel.com https://blob.vercel-storage.com",
      "img-src 'self' data: blob: https://img.clerk.com https://images.clerk.dev",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "frame-src 'self' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    const headers = [
      { key: "Content-Security-Policy", value: cspHeader },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
    ];

    return [
      {
        source: "/(.*)",
        headers,
      },
    ];
  },
};

export default nextConfig;
