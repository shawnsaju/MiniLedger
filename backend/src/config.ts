// config.ts is the single place that reads all environment variables (from .env), and check that the important ones exist, and share them with the rest of the app. Other files import `config` instead of reading process.env directly.

import dotenv from 'dotenv';
import path from 'path';

dotenv.config()

// An interface describes the SHAPE of an object: which keys exist and what type each value is. TypeScript will warn you if you misuse it.
export interface Config {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  uploadDir: string;
  timezone: string;
  defaultCountryCode: string;
  otpTtlMinutes: number;
  otpMaxAttempts: number;
  otpCooldownSeconds: number;
  maxReceiptBytes: number;
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  // `??` means "use the right side only if the left side is undefined/null".
  const jwtSecret = process.env.JWT_SECRET ?? 'dev-only-secret-change-me';
  // Refuse to run in production with the insecure secret.
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }

  const port = Number(process.env.PORT ?? 4000);
  // Number.isInteger is false for NaN, so this catches PORT=abc.
  if (!Number.isInteger(port)) {
    throw new Error('PORT must be a number');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set');
  }

  return {
    port,
    databaseUrl,
    jwtSecret,
    uploadDir: path.resolve(process.env.UPLOAD_DIR ?? './uploads'),
    timezone: process.env.APP_TIMEZONE ?? 'Asia/Kolkata',
    defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE ?? '91',
    otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES ?? 5),
    otpMaxAttempts: 5,
    otpCooldownSeconds: 15,
    maxReceiptBytes: 5 * 1024 * 1024, // 5 MB (5 * 1024 * 1024 bytes)
    ...overrides, // anything passed in replaces the values above
  };
}
