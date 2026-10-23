// ONE place that decides what the user sees when something goes wrong in our backend.
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'Route not found'));
}

// Express recognises error middleware by its 4 arguments - keep `_next`.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res
      .status(tooBig ? 413 : 400)
      .json({ error: tooBig ? 'Receipt image is too large (max 5 MB)' : err.message });
  }
  // body-parser errors (e.g. malformed JSON) carry a 4xx status
  const status = (err as { status?: number })?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return res.status(status).json({ error: 'Invalid request body' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}
