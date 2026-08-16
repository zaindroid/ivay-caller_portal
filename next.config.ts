import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted on zorc (Coolify/Docker), not Vercel — standalone output
  // keeps the deployed image to just the app + production deps.
  output: "standalone",
  // This dev machine has 16 logical CPUs but little free RAM, so Next's
  // default (cpus - 1) worker pool for page-data collection OOMs. Cap it.
  experimental: {
    cpus: 2,
  },
};

export default nextConfig;
