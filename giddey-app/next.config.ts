import type { NextConfig } from "next";

// Static export: the whole game runs in the browser, so it ships as plain files
// (served free by GitHub Pages — see .github/workflows/deploy-pages.yml).
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
