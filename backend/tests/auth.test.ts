import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { normalizePhone } from '../src/phone';
import { OTP, login, makeTestApp } from './helpers';

describe('normalizePhone', () => {
  it('adds the default country code to 10-digit numbers', () => {
    expect(normalizePhone('98765 43210', '91')).toBe('+919876543210');
  });
  it('keeps explicit country codes and strips separators', () => {
    expect(normalizePhone('+91 (98765) 43-210', '91')).toBe('+919876543210');
    expect(normalizePhone('919876543210', '91')).toBe('+919876543210');
  });
  it('rejects junk', () => {
    expect(normalizePhone('abc', '91')).toBeNull();
    expect(normalizePhone('123', '91')).toBeNull();
    expect(normalizePhone('+0123456789012', '91')).toBeNull();
  });
});

describe('phone + OTP login', () => {
  it('prints the OTP to the log and does not leak it in the response', async () => {
    const { app, logs } = await makeTestApp();
    const res = await request(app).post('/auth/request-otp').send({ phone: '9876543210' }).expect(200);
    expect(res.body.phone).toBe('+919876543210');
    expect(JSON.stringify(res.body)).not.toContain(OTP);
    expect(logs.some((l) => l.includes(OTP) && l.includes('+919876543210'))).toBe(true);
  });

  it('rejects an invalid phone number', async () => {
    const { app } = await makeTestApp();
    await request(app).post('/auth/request-otp').send({ phone: '12' }).expect(400);
    await request(app).post('/auth/request-otp').send({}).expect(400);
  });

  it('logs in with the right OTP and the token works', async () => {
    const { app } = await makeTestApp();
    const token = await login(app, '9876543210');
    await request(app).get('/loans').set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('treats differently-formatted numbers as the same account', async () => {
    const { app } = await makeTestApp();
    await request(app).post('/auth/request-otp').send({ phone: '9876543210' });
    const a = await request(app).post('/auth/verify-otp').send({ phone: '9876543210', otp: OTP });
    await request(app).post('/auth/request-otp').send({ phone: '+91 98765 43210' });
    const b = await request(app).post('/auth/verify-otp').send({ phone: '+919876543210', otp: OTP });
    expect(a.body.user.id).toBe(b.body.user.id);
  });

  it('rejects a wrong OTP and a malformed OTP', async () => {
    const { app } = await makeTestApp();
    await request(app).post('/auth/request-otp').send({ phone: '9876543210' });
    await request(app).post('/auth/verify-otp').send({ phone: '9876543210', otp: '000000' }).expect(401);
    await request(app).post('/auth/verify-otp').send({ phone: '9876543210', otp: '12' }).expect(400);
  });

  it('OTP is single-use', async () => {
    const { app } = await makeTestApp();
    await login(app, '9876543210');
    await request(app).post('/auth/verify-otp').send({ phone: '9876543210', otp: OTP }).expect(401);
  });

  it('verifying without requesting an OTP fails', async () => {
    const { app } = await makeTestApp();
    await request(app).post('/auth/verify-otp').send({ phone: '9876543210', otp: OTP }).expect(401);
  });

  it('locks the OTP after too many wrong attempts, even if the right code is then sent', async () => {
    const { app, config } = await makeTestApp();
    await request(app).post('/auth/request-otp').send({ phone: '9876543210' });
    for (let i = 0; i < config.otpMaxAttempts; i++) {
      await request(app).post('/auth/verify-otp').send({ phone: '9876543210', otp: '000000' }).expect(401);
    }
    await request(app).post('/auth/verify-otp').send({ phone: '9876543210', otp: OTP }).expect(429);
  });

  it('enforces a cooldown between OTP requests', async () => {
    const { app } = await makeTestApp({ otpCooldownSeconds: 60 });
    await request(app).post('/auth/request-otp').send({ phone: '9876543210' }).expect(200);
    await request(app).post('/auth/request-otp').send({ phone: '9876543210' }).expect(429);
  });

  it('protects the loan routes', async () => {
    const { app } = await makeTestApp();
    await request(app).get('/loans').expect(401);
    await request(app).get('/loans/summary').expect(401);
    await request(app).get('/loans').set('Authorization', 'Bearer not-a-token').expect(401);
  });
});
