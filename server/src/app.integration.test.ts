import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import app from './app';
import prisma from './config/db';

describe('backend smoke tests', () => {
  it('exposes a health endpoint', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('logs in a seeded test tenant', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'tenant.test@rental.local', password: 'TestPassword123!' });

    expect(response.status).toBe(200);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
