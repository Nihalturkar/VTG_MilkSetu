import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';
import { ApiError } from './errors';

type Part = 'body' | 'query' | 'params';

/** Validate+coerce a request part, replacing it with the parsed result. */
export const validate =
  (part: Part, schema: ZodSchema): RequestHandler =>
  (req, _res, next) => {
    const parsed = schema.safeParse(req[part]);
    if (!parsed.success) {
      const details = parsed.error.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return next(new ApiError(400, 'Validation failed', 'validation_error', details));
    }
    // req.query is a getter in Express 5; assign defensively.
    Object.defineProperty(req, part, { value: parsed.data, writable: true, configurable: true });
    next();
  };
