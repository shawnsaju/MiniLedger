import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { AppDeps } from './app';
import type { Config } from './config';
import { AppError } from './errors';
import { normalizePhone } from './phone';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const requestOtpSchema = z.object({ phone: z.string().min(1, 'Phone number is required') });
const verifyOtpSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

// Only a salted hash of the OTP is stored, never the code itself.
function hashOtp(phone: string, code: string, secret: string): string {
  return createHash('sha256').update(`${secret}:${phone}:${code}`).digest('hex');
}

function sameHash(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

const defaultOtp = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export function authRouter({ db, config, generateOtp = defaultOtp, log = console.log }: AppDeps) {
  const router = Router();

  // Step 1: ask for an OTP. In this mock the "SMS" is a line in the server log.
  router.post('/request-otp', async (req, res) => {
    const body = requestOtpSchema.parse(req.body);
    const phone = normalizePhone(body.phone, config.defaultCountryCode);
    if (!phone) throw new AppError(400, 'Enter a valid phone number');

    const recent = await db.query<{ age: number }>(
      `SELECT EXTRACT(EPOCH FROM (now() - last_sent_at))::float8 AS age FROM otps WHERE phone = $1`,
      [phone],
    );
    if (recent.rows[0] && recent.rows[0].age < config.otpCooldownSeconds) {
      const wait = Math.ceil(config.otpCooldownSeconds - recent.rows[0].age);
      throw new AppError(429, `Please wait ${wait}s before requesting another OTP`);
    }

    const code = generateOtp();
    await db.query(
      `INSERT INTO otps (phone, code_hash, expires_at, attempts, last_sent_at)
       VALUES ($1, $2, now() + make_interval(mins => $3::int), 0, now())
       ON CONFLICT (phone) DO UPDATE
         SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at,
             attempts = 0, last_sent_at = now()`,
      [phone, hashOtp(phone, code, config.jwtSecret), config.otpTtlMinutes],
    );

    log(`[MOCK SMS] OTP for ${phone}: ${code} (valid ${config.otpTtlMinutes} min)`);
    res.json({ message: 'OTP sent', phone, expiresInMinutes: config.otpTtlMinutes });
  });

  // Step 2: exchange phone + OTP for a JWT. First login creates the account.
  router.post('/verify-otp', async (req, res) => {
    const body = verifyOtpSchema.parse(req.body);
    const phone = normalizePhone(body.phone, config.defaultCountryCode);
    if (!phone) throw new AppError(400, 'Enter a valid phone number');

    const found = await db.query<{ code_hash: string; attempts: number; expired: boolean }>(
      `SELECT code_hash, attempts, expires_at < now() AS expired FROM otps WHERE phone = $1`,
      [phone],
    );
    const otp = found.rows[0];
    if (!otp || otp.expired) throw new AppError(401, 'OTP expired or not requested. Request a new one.');
    if (otp.attempts >= config.otpMaxAttempts) {
      throw new AppError(429, 'Too many wrong attempts. Request a new OTP.');
    }

    const submittedHash = hashOtp(phone, body.otp, config.jwtSecret);
    if (!sameHash(otp.code_hash, submittedHash)) {
      await db.query(`UPDATE otps SET attempts = attempts + 1 WHERE phone = $1`, [phone]);
      throw new AppError(401, 'Incorrect OTP');
    }

    // Single use. The DELETE is the atomic check: if two requests race with the
    // right code, only one of them gets a row back.
    const consumed = await db.query(
      `DELETE FROM otps WHERE phone = $1 AND code_hash = $2 RETURNING phone`,
      [phone, otp.code_hash],
    );
    if (!consumed.rows.length) throw new AppError(401, 'OTP already used. Request a new one.');

    const user = await db.query<{ id: string; phone: string }>(
      `INSERT INTO users (phone) VALUES ($1)
       ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
       RETURNING id, phone`,
      [phone],
    );
    const userRow = user.rows[0];
    if (!userRow) throw new Error('User insert did not return a user');
    const { id } = userRow;
    const token = jwt.sign({}, config.jwtSecret, { subject: id, expiresIn: '7d', algorithm: 'HS256' });
    res.json({ token, user: userRow });
  });

  return router;
}

export function requireAuth(config: Config) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return next(new AppError(401, 'Missing bearer token'));
    try {
      const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
      if (typeof payload === 'string' || !payload.sub) throw new Error('bad payload');
      req.userId = payload.sub;
      next();
    } catch {
      next(new AppError(401, 'Invalid or expired token'));
    }
  };
}
