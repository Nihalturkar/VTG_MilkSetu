import path from 'node:path';
import fs from 'node:fs';
import type { RequestHandler } from 'express';
import { createApp } from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';

/**
 * Load the built Next.js admin panel so one Node process serves both the API
 * and the panel.
 *
 * Only used when SERVE_ADMIN is on (the default in production). In
 * development the panel runs separately via `npm run dev` in admin/, which
 * keeps fast refresh working.
 */
async function loadAdminHandler(): Promise<RequestHandler | undefined> {
  if (!env.serveAdmin) return undefined;

  const adminDir = path.resolve(__dirname, '../../admin');
  if (!fs.existsSync(path.join(adminDir, '.next'))) {
    console.warn('[admin] .next not found — run `npm run build` in admin/. Serving API only.');
    return undefined;
  }

  try {
    // Required lazily: the backend must still boot if admin/ is absent.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const next = require('next');
    const nextApp = next({ dev: false, dir: adminDir });
    await nextApp.prepare();
    const handle = nextApp.getRequestHandler();
    console.log('[admin] Next.js panel mounted at /admin');
    return (req, res) => handle(req, res);
  } catch (err) {
    console.error('[admin] failed to start, serving API only:', (err as Error).message);
    return undefined;
  }
}

async function main() {
  await connectDatabase();
  const adminHandler = await loadAdminHandler();

  createApp({ adminHandler }).listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port} (${env.nodeEnv})`);
    if (adminHandler) console.log(`[server] admin panel: http://localhost:${env.port}/admin`);
  });
}

main().catch(err => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
