import type { NextConfig } from "next";

// The NOD backend (../backend) runs on its own port. Proxying /api/* through the
// frontend keeps browser calls same-origin and lets the capture extension keep its
// default endpoint (http://localhost:3000/api/events).
const backendUrl = (process.env.BACKEND_URL ?? "http://localhost:3001").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // AI draft generation can take longer than the default 30 s proxy timeout.
    proxyTimeout: 120_000,
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
