import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import app from './app';
import prisma from './config/db';

describe('authentication and authorization', () => {
  it('rejects missing and malformed authentication', async () => {
    const missing = await request(app).get('/api/v1/auth/me');
    const malformed = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(missing.status).toBe(401);
    expect(missing.body.message).toBe('Bạn chưa đăng nhập');
    expect(malformed.status).toBe(401);
    expect(malformed.body.message).toBe('Token không hợp lệ');
  });

  it('rotates a refresh token atomically', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'tenant.test@rental.local', password: 'TestPassword123!' });
    const refreshToken = login.body.data.refreshToken;

    const responses = await Promise.all([
      request(app).post('/api/v1/auth/refresh').send({ refreshToken }),
      request(app).post('/api/v1/auth/refresh').send({ refreshToken }),
    ]);

    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 401)).toHaveLength(1);
  });

  it('blocks a tenant from landlord-only property APIs', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'tenant.test@rental.local', password: 'TestPassword123!' });

    const response = await request(app)
      .get('/api/v1/properties/my')
      .set('Authorization', `Bearer ${login.body.data.token}`);

    expect(response.status).toBe(403);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
