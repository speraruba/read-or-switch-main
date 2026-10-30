import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function nextConfig(phase: string): NextConfig {
  return {
    // Keep production builds from replacing files used by a running dev server.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    output: "standalone",
    experimental: {
      reactCompiler: true,
    },
    ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  };
}
