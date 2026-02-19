import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["graphology", "graphology-metrics", "graphology-shortest-path", "typescript"],
};

export default nextConfig;
