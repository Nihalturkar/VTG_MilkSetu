import express, { RequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import routes from './routes';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

interface AppOptions {
  /** Serves the Next.js admin panel under /admin when provided. */
  adminHandler?: RequestHandler;
}

export function createApp({ adminHandler }: AppOptions = {}) {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      // Next ships inline bootstrap scripts and styles; its own CSP handling
      // is what should govern the admin panel, not helmet's default.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(
    cors({
      origin(origin, cb) {
        // Allow non-browser clients (the RN app sends no Origin).
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
        cb(new Error('Not allowed by CORS'));
      },
      credentials: true,
    }),
  );

  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  // --- Admin panel (Next.js) ------------------------------------------
  // Mounted before the API's body parser and rate limiter: Next reads its own
  // request bodies for server actions, and its asset requests must not eat
  // the API's rate-limit budget.
  if (adminHandler) {
    // Next has basePath '/admin' and so expects the full, unmodified path.
    // app.use('/admin', …) would strip the prefix before Next sees it, so
    // match inside the handler instead.
    app.use((req, res, nextFn) => {
      if (req.path === '/admin' || req.path.startsWith('/admin/') || req.path.startsWith('/_next')) {
        return adminHandler(req, res, nextFn);
      }
      nextFn();
    });
  }

  // --- API --------------------------------------------------------------
  app.use(express.json({ limit: '100kb' }));
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));
  app.use('/api', routes);

  // Bare root goes to the admin panel when it is mounted.
  if (adminHandler) {
    app.get('/', (_req, res) => res.redirect('/admin'));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
