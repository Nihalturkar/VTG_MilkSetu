import { fileURLToPath } from 'node:url';
import path from 'node:path';

// fileURLToPath (not URL.pathname) — on Windows the latter yields "/C:/..."
// which Next cannot canonicalize.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The admin panel is mounted under /admin by the Express server in
  // production, so every route and asset URL needs that prefix.
  basePath: '/admin',

  // Emit a self-contained server bundle (.next/standalone) that Express can
  // boot without the full node_modules tree.
  output: 'standalone',
  // The repo is a monorepo; point tracing at its root so Next collects files
  // from the right place.
  outputFileTracingRoot: repoRoot,

  env: {
    // Server-side base URL for the dairy backend. In production the API lives
    // on the same origin, so a relative path is resolved against PORT.
    API_BASE_URL: process.env.API_BASE_URL ?? 'http://localhost:4000/api',
  },
};
export default nextConfig;
