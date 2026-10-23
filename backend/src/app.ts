import cors from 'cors';
import express from 'express';
import { authRouter, requireAuth } from './auth';
import type { Config } from './config';
import type { Db } from './db.js';
import { errorHandler, notFound } from './errors';
import { loansRouter } from './loans';

export interface AppDeps {
  db: Db;
  config: Config;
  /** Injectable so tests know the OTP. Defaults to a random 6-digit code. */
  generateOtp?: () => string;
  /** Where the mock SMS goes. Defaults to console.log (the server log). */
  log?: (message: string) => void;
}

export function createApp(deps: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/auth', authRouter(deps));
  app.use('/loans', requireAuth(deps.config), loansRouter(deps));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
