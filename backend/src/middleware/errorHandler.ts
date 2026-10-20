import { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from './errors';
import { env } from '../config/env';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Route not found' } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      ok: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }
  // Duplicate key from a unique index (e.g. mobile) that slipped past checks.
  if (err?.code === 11000) {
    res.status(409).json({ ok: false, error: { code: 'duplicate', message: 'Already exists' } });
    return;
  }
  console.error('[error]', err);
  res.status(500).json({
    ok: false,
    error: {
      code: 'server_error',
      message: env.nodeEnv === 'production' ? 'Something went wrong' : String(err?.message ?? err),
    },
  });
};

/** Wrap async handlers so rejections reach errorHandler. */
export const asyncHandler =
  <T extends RequestHandler>(fn: T): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
