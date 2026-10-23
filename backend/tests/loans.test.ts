import fs from 'fs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { PNG_BYTES, dateFromToday, login, makeTestApp, type TestApp } from './helpers';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function addLoan(app: TestApp, token: string, friendName: string, amount: number, dueDate: string) {
  const res = await request(app).post('/loans').set(auth(token)).send({ friendName, amount, dueDate });
  expect(res.status).toBe(201);
  return res.body;
}

describe('POST /loans validation', () => {
  it.each([
    ['empty name', { friendName: '  ', amount: 100, dueDate: dateFromToday(5) }],
    ['missing name', { amount: 100, dueDate: dateFromToday(5) }],
    ['zero amount', { friendName: 'Ravi', amount: 0, dueDate: dateFromToday(5) }],
    ['negative amount', { friendName: 'Ravi', amount: -5, dueDate: dateFromToday(5) }],
    ['non-numeric amount', { friendName: 'Ravi', amount: 'lots', dueDate: dateFromToday(5) }],
    ['bad date format', { friendName: 'Ravi', amount: 100, dueDate: '25/12/2026' }],
    ['impossible date', { friendName: 'Ravi', amount: 100, dueDate: '2026-02-30' }],
    ['missing date', { friendName: 'Ravi', amount: 100 }],
  ])('rejects %s with 400', async (_label, body) => {
    const { app } = await makeTestApp();
    const token = await login(app, '9876543210');
    const res = await request(app).post('/loans').set(auth(token)).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('rejects malformed JSON with 400, not 500', async () => {
    const { app } = await makeTestApp();
    const token = await login(app, '9876543210');
    await request(app)
      .post('/loans')
      .set(auth(token))
      .set('Content-Type', 'application/json')
      .send('{"friendName": ')
      .expect(400);
  });

  it('trims the name and rounds the amount to 2 decimals', async () => {
    const { app } = await makeTestApp();
    const token = await login(app, '9876543210');
    const loan = await addLoan(app, token, '  Ravi  ', 100.456, dateFromToday(5));
    expect(loan.friendName).toBe('Ravi');
    expect(loan.amount).toBe(100.46);
    expect(loan.status).toBe('pending');
    expect(loan.hasReceipt).toBe(false);
  });
});

describe('listing, overdue status and summary', () => {
  it('flags overdue entries, orders them sensibly and computes the summary', async () => {
    const { app } = await makeTestApp();
    const token = await login(app, '9876543210');

    const overdue = await addLoan(app, token, 'Asha', 500.5, dateFromToday(-3));
    const dueToday = await addLoan(app, token, 'Bala', 200, dateFromToday(0));
    const future = await addLoan(app, token, 'Chitra', 1000, dateFromToday(10));
    const repaid = await addLoan(app, token, 'Dev', 300.25, dateFromToday(-20));
    await request(app).post(`/loans/${repaid.id}/repay`).set(auth(token)).expect(200);

    const list = await request(app).get('/loans').set(auth(token)).expect(200);
    const byName = Object.fromEntries(list.body.loans.map((l: any) => [l.friendName, l]));
    expect(byName.Asha.status).toBe('overdue');
    expect(byName.Bala.status).toBe('pending'); // due today is not overdue yet
    expect(byName.Chitra.status).toBe('pending');
    expect(byName.Dev.status).toBe('repaid'); // repaid beats "past due"
    expect(byName.Dev.repaidAt).toBeTruthy();

    // unrepaid first by soonest due date, repaid last
    expect(list.body.loans.map((l: any) => l.friendName)).toEqual(['Asha', 'Bala', 'Chitra', 'Dev']);
    expect([overdue.id, dueToday.id, future.id]).toEqual(
      list.body.loans.slice(0, 3).map((l: any) => l.id),
    );

    const summary = await request(app).get('/loans/summary').set(auth(token)).expect(200);
    expect(summary.body).toEqual({
      totalLent: 2000.75,
      totalRepaid: 300.25,
      outstanding: 1700.5,
      overdueAmount: 500.5,
      entryCount: 4,
      repaidCount: 1,
      overdueCount: 1,
    });
  });

  it('returns zeros for a brand new user', async () => {
    const { app } = await makeTestApp();
    const token = await login(app, '9876543210');
    const summary = await request(app).get('/loans/summary').set(auth(token)).expect(200);
    expect(summary.body).toMatchObject({ totalLent: 0, totalRepaid: 0, overdueAmount: 0, entryCount: 0 });
    const list = await request(app).get('/loans').set(auth(token)).expect(200);
    expect(list.body.loans).toEqual([]);
  });

  it('sums decimals exactly (0.1 + 0.2 style bugs)', async () => {
    const { app } = await makeTestApp();
    const token = await login(app, '9876543210');
    await addLoan(app, token, 'A', 0.1, dateFromToday(5));
    await addLoan(app, token, 'B', 0.2, dateFromToday(5));
    const summary = await request(app).get('/loans/summary').set(auth(token));
    expect(summary.body.totalLent).toBe(0.3);
  });

  it('keeps each user’s data private', async () => {
    const { app } = await makeTestApp();
    const alice = await login(app, '9876543210');
    const bob = await login(app, '9123456780');
    const loan = await addLoan(app, alice, 'Asha', 100, dateFromToday(-1));

    const bobList = await request(app).get('/loans').set(auth(bob)).expect(200);
    expect(bobList.body.loans).toEqual([]);
    const bobSummary = await request(app).get('/loans/summary').set(auth(bob)).expect(200);
    expect(bobSummary.body.totalLent).toBe(0);
    await request(app).post(`/loans/${loan.id}/repay`).set(auth(bob)).expect(404);
  });
});

describe('POST /loans/:id/repay', () => {
  it('marks a loan repaid, then rejects a second repay with 409', async () => {
    const { app } = await makeTestApp();
    const token = await login(app, '9876543210');
    const loan = await addLoan(app, token, 'Asha', 100, dateFromToday(-1));
    expect(loan.status).toBe('overdue');

    const res = await request(app).post(`/loans/${loan.id}/repay`).set(auth(token)).expect(200);
    expect(res.body.status).toBe('repaid');
    await request(app).post(`/loans/${loan.id}/repay`).set(auth(token)).expect(409);

    const summary = await request(app).get('/loans/summary').set(auth(token));
    expect(summary.body).toMatchObject({ totalRepaid: 100, overdueAmount: 0, outstanding: 0 });
  });

  it('404s for unknown or malformed ids', async () => {
    const { app } = await makeTestApp();
    const token = await login(app, '9876543210');
    await request(app)
      .post('/loans/00000000-0000-4000-8000-000000000000/repay')
      .set(auth(token))
      .expect(404);
    await request(app).post('/loans/not-a-uuid/repay').set(auth(token)).expect(404);
  });
});

describe('receipt upload (bonus)', () => {
  const form = (app: TestApp, token: string) =>
    request(app)
      .post('/loans')
      .set(auth(token))
      .field('friendName', 'Asha')
      .field('amount', '250')
      .field('dueDate', dateFromToday(7));

  it('stores a receipt photo and serves it back only to the owner', async () => {
    const { app } = await makeTestApp();
    const alice = await login(app, '9876543210');
    const bob = await login(app, '9123456780');

    const created = await form(app, alice)
      .attach('receipt', PNG_BYTES, { filename: 'receipt.png', contentType: 'image/png' })
      .expect(201);
    expect(created.body.hasReceipt).toBe(true);
    expect(created.body.amount).toBe(250); // multipart strings are coerced

    const img = await request(app)
      .get(`/loans/${created.body.id}/receipt`)
      .set(auth(alice))
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(img.headers['content-type']).toContain('image/png');
    expect(Buffer.compare(img.body, PNG_BYTES)).toBe(0);

    await request(app).get(`/loans/${created.body.id}/receipt`).set(auth(bob)).expect(404);
    await request(app).get(`/loans/${created.body.id}/receipt`).expect(401);
  });

  it('404s when a loan has no receipt', async () => {
    const { app } = await makeTestApp();
    const token = await login(app, '9876543210');
    const loan = await addLoan(app, token, 'Asha', 100, dateFromToday(3));
    await request(app).get(`/loans/${loan.id}/receipt`).set(auth(token)).expect(404);
  });

  it('rejects non-image uploads', async () => {
    const { app, uploadDir } = await makeTestApp();
    const token = await login(app, '9876543210');
    await form(app, token)
      .attach('receipt', Buffer.from('hello'), { filename: 'x.txt', contentType: 'text/plain' })
      .expect(400);
    expect(fs.readdirSync(uploadDir)).toEqual([]);
  });

  it('rejects a file that claims to be an image but is not, and cleans it up', async () => {
    const { app, uploadDir } = await makeTestApp();
    const token = await login(app, '9876543210');
    const res = await form(app, token)
      .attach('receipt', Buffer.from('definitely not a png'), { filename: 'x.png', contentType: 'image/png' })
      .expect(400);
    expect(res.body.error).toMatch(/valid image/);
    expect(fs.readdirSync(uploadDir)).toEqual([]);
  });

  it('removes the uploaded file when the form fields are invalid', async () => {
    const { app, uploadDir } = await makeTestApp();
    const token = await login(app, '9876543210');
    await request(app)
      .post('/loans')
      .set(auth(token))
      .field('friendName', 'Asha')
      .field('amount', '-1')
      .field('dueDate', dateFromToday(7))
      .attach('receipt', PNG_BYTES, { filename: 'r.png', contentType: 'image/png' })
      .expect(400);
    expect(fs.readdirSync(uploadDir)).toEqual([]);
  });

  it('rejects oversized receipts with 413', async () => {
    const { app, uploadDir } = await makeTestApp({ maxReceiptBytes: 1024 });
    const token = await login(app, '9876543210');
    const big = Buffer.concat([PNG_BYTES, Buffer.alloc(4096)]);
    await form(app, token).attach('receipt', big, { filename: 'big.png', contentType: 'image/png' }).expect(413);
    expect(fs.readdirSync(uploadDir)).toEqual([]);
  });
});
