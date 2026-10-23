import fs from 'fs';
import os from 'os';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { createApp } from '../src/app';
import { loadConfig, type Config } from '../src/config';
import { schemaSql, type Db } from '../src/db';

export const OTP = '123456';

// One engine per test file (booting Postgres-in-WASM is the slow part); tables are wiped per test.
let pgReady: Promise<PGlite> | undefined;
async function getPg(): Promise<PGlite> {
  pgReady ??= (async () => {
    const pg = new PGlite();
    await pg.exec(schemaSql());
    return pg;
  })();
  const pg = await pgReady;
  await pg.exec('TRUNCATE users, otps, loans CASCADE');
  return pg;
}

/** Real Postgres engine running in-process, so the actual SQL is exercised (no mocks). */
export async function makeTestApp(overrides: Partial<Config> = {}) {
  const pg = await getPg();
  const db: Db = {
    query: async (text, params) => {
      const r = await pg.query(text, params as any[]);
      return { rows: r.rows as any[], rowCount: r.affectedRows ?? null };
    },
  };
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'miniledger-uploads-'));
  const config = loadConfig({ uploadDir, otpCooldownSeconds: 0, timezone: 'Asia/Kolkata', ...overrides });
  const logs: string[] = [];
  const app = createApp({ db, config, generateOtp: () => OTP, log: (m) => logs.push(m) });
  return { app, db, config, uploadDir, logs };
}

export type TestApp = Awaited<ReturnType<typeof makeTestApp>>['app'];

export async function login(app: TestApp, phone: string): Promise<string> {
  await request(app).post('/auth/request-otp').send({ phone }).expect(200);
  const res = await request(app).post('/auth/verify-otp').send({ phone, otp: OTP }).expect(200);
  return res.body.token as string;
}

/** YYYY-MM-DD for "today + offsetDays" in the app timezone. */
export function dateFromToday(offsetDays: number, tz = 'Asia/Kolkata'): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

// 1x1 transparent PNG
export const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
