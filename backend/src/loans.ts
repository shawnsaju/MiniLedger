import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { AppDeps } from './app';
import { AppError } from './errors';

// "Today" is evaluated in the app timezone so a loan due today isn't overdue at 00:30 UTC.
const TODAY = `(now() AT TIME ZONE $2::text)::date`;

const LOAN_SELECT = `
  SELECT id,
         friend_name                       AS "friendName",
         amount::float8                    AS amount,
         to_char(due_date, 'YYYY-MM-DD')   AS "dueDate",
         repaid_at                         AS "repaidAt",
         (receipt_path IS NOT NULL)        AS "hasReceipt",
         created_at                        AS "createdAt",
         CASE WHEN repaid_at IS NOT NULL THEN 'repaid'
              WHEN due_date < ${TODAY}     THEN 'overdue'
              ELSE 'pending' END           AS status
  FROM loans`;

const isRealDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

const createLoanSchema = z.object({
  friendName: z.string().trim().min(1, 'Friend name is required').max(100, 'Friend name is too long'),
  // multipart bodies arrive as strings, so coerce
  amount: z.coerce
    .number()
    .positive('Amount must be greater than 0')
    .max(999_999_999, 'Amount is too large')
    .transform((n) => Math.round(n * 100) / 100),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD')
    .refine(isRealDate, 'Due date is not a real calendar date'),
});

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
};

// The client-declared MIME type can lie, so also check the file's first bytes.
async function looksLikeImage(file: string): Promise<boolean> {
  const fh = await fs.promises.open(file, 'r');
  try {
    const buf = Buffer.alloc(12);
    await fh.read(buf, 0, 12, 0);
    const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const png = buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const webp = buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
    const heic = buf.toString('ascii', 4, 8) === 'ftyp';
    return jpeg || png || webp || heic;
  } finally {
    await fh.close();
  }
}

const discard = (file?: Express.Multer.File) =>
  file ? fs.promises.unlink(file.path).catch(() => undefined) : Promise.resolve();

export function loansRouter({ db, config }: AppDeps) {
  const router = Router();
  fs.mkdirSync(config.uploadDir, { recursive: true });

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, config.uploadDir),
      // never trust the client's filename: random name + extension from the MIME type
      filename: (_req, file, cb) => cb(null, `${randomUUID()}${EXT_BY_MIME[file.mimetype]}`),
    }),
    limits: { fileSize: config.maxReceiptBytes, files: 1 },
    fileFilter: (_req, file, cb) =>
      EXT_BY_MIME[file.mimetype]
        ? cb(null, true)
        : cb(new AppError(400, 'Receipt must be a JPEG, PNG, WEBP or HEIC image')),
  });

  const parseId = (raw: unknown): string => {
    const parsed = z.uuid().safeParse(raw);
    if (!parsed.success) throw new AppError(404, 'Loan not found');
    return parsed.data;
  };

  const findLoan = async (userId: string, id: string) => {
    const { rows } = await db.query(`${LOAN_SELECT} WHERE user_id = $1 AND id = $3`, [
      userId,
      config.timezone,
      id,
    ]);
    return rows[0];
  };

  // Add a loan entry. Accepts JSON, or multipart/form-data when a receipt photo is attached.
  router.post('/', upload.single('receipt'), async (req, res) => {
    const userId = req.userId!;
    const file = req.file;
    try {
      const parsed = createLoanSchema.safeParse(req.body ?? {});
      if (!parsed.success) throw parsed.error;
      if (file && !(await looksLikeImage(file.path))) {
        throw new AppError(400, 'Receipt file is not a valid image');
      }
      const { friendName, amount, dueDate } = parsed.data;
      const inserted = await db.query<{ id: string }>(
        `INSERT INTO loans (user_id, friend_name, amount, due_date, receipt_path)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [userId, friendName, amount, dueDate, file?.filename ?? null],
      );
      const insertedLoan = inserted.rows[0];
      if (!insertedLoan) throw new Error('Loan insert did not return an id');
      res.status(201).json(await findLoan(userId, insertedLoan.id));
    } catch (err) {
      await discard(file); // don't leave orphaned uploads behind on a failed request
      throw err;
    }
  });

  // Unrepaid first (soonest due on top), repaid entries at the bottom.
  router.get('/', async (req, res) => {
    const { rows } = await db.query(
      `${LOAN_SELECT} WHERE user_id = $1
       ORDER BY (repaid_at IS NOT NULL), due_date ASC, created_at DESC`,
      [req.userId, config.timezone],
    );
    res.json({ loans: rows });
  });

  // NOTE: declared before '/:id' routes so "summary" isn't parsed as an id.
  router.get('/summary', async (req, res) => {
    const unpaid = `repaid_at IS NULL`;
    const overdue = `${unpaid} AND due_date < ${TODAY}`;
    // SUM runs on exact NUMERIC; only the final total is cast to a JS-friendly number.
    const { rows } = await db.query(
      `SELECT COALESCE(SUM(amount), 0)::float8                                   AS "totalLent",
              COALESCE(SUM(amount) FILTER (WHERE repaid_at IS NOT NULL), 0)::float8 AS "totalRepaid",
              COALESCE(SUM(amount) FILTER (WHERE ${unpaid}), 0)::float8          AS outstanding,
              COALESCE(SUM(amount) FILTER (WHERE ${overdue}), 0)::float8         AS "overdueAmount",
              COUNT(*)::int                                                      AS "entryCount",
              (COUNT(*) FILTER (WHERE repaid_at IS NOT NULL))::int               AS "repaidCount",
              (COUNT(*) FILTER (WHERE ${overdue}))::int                          AS "overdueCount"
       FROM loans WHERE user_id = $1`,
      [req.userId, config.timezone],
    );
    res.json(rows[0]);
  });

  router.post('/:id/repay', async (req, res) => {
    const id = parseId(req.params.id);
    // Conditional UPDATE = atomic: only an unrepaid loan owned by this user matches.
    const updated = await db.query(
      `UPDATE loans SET repaid_at = now()
       WHERE id = $1 AND user_id = $2 AND repaid_at IS NULL RETURNING id`,
      [id, req.userId],
    );
    if (!updated.rows.length) {
      const existing = await findLoan(req.userId!, id);
      if (!existing) throw new AppError(404, 'Loan not found');
      throw new AppError(409, 'Loan is already marked as repaid');
    }
    res.json(await findLoan(req.userId!, id));
  });

  // Receipts are private: served only to the owner, never from a public static folder.
  router.get('/:id/receipt', async (req, res, next) => {
    const id = parseId(req.params.id);
    const { rows } = await db.query<{ receipt_path: string | null }>(
      `SELECT receipt_path FROM loans WHERE id = $1 AND user_id = $2`,
      [id, req.userId],
    );
    const file = rows[0]?.receipt_path;
    if (!file) throw new AppError(404, 'No receipt for this loan');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(path.join(config.uploadDir, file), (err) => err && next(err));
  });

  // Delete a repaid loan. Only repaid entries can be removed so the summary history stays intact
  // until the user explicitly clears them.
  router.delete('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const { rows } = await db.query<{ receipt_path: string | null }>(
      `DELETE FROM loans
       WHERE id = $1 AND user_id = $2 AND repaid_at IS NOT NULL
       RETURNING receipt_path`,
      [id, req.userId],
    );
    const deletedLoan = rows[0];
    if (!deletedLoan) {
      // Distinguish "not found / wrong user" from "found but not yet repaid".
      const existing = await findLoan(req.userId!, id);
      if (!existing) throw new AppError(404, 'Loan not found');
      throw new AppError(409, 'Only repaid loans can be deleted');
    }
    // Best-effort receipt cleanup; a missing file is not fatal.
    if (deletedLoan.receipt_path) {
      await fs.promises.unlink(path.join(config.uploadDir, deletedLoan.receipt_path)).catch(() => undefined);
    }
    res.status(204).end();
  });

  return router;
}
