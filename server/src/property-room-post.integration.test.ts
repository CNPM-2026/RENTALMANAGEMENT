import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import app from './app';
import prisma from './config/db';

describe('property, room and post ownership', () => {
  it('creates and reads a landlord-owned property and room', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'landlord.test@rental.local', password: 'TestPassword123!' });
    const token = login.body.data.token;
    const suffix = Date.now().toString();

    const propertyResponse = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Integration Property ${suffix}`,
        address: '456 Integration Street',
        province: 'Ho Chi Minh City',
        district: 'District 3',
        ward: 'Ward 1',
      });

    expect(propertyResponse.status).toBe(201);
    const propertyId = propertyResponse.body.data.id;

    const roomResponse = await request(app)
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({
        propertyId,
        roomNumber: `I-${suffix}`,
        priceMonthly: 4000000,
        depositAmount: 4000000,
        area: 20,
      });

    expect(roomResponse.status).toBe(201);
    const roomsResponse = await request(app)
      .get(`/api/v1/rooms/property/${propertyId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(roomsResponse.status).toBe(200);
    expect(roomsResponse.body.data).toHaveLength(1);

    await prisma.property.delete({ where: { id: propertyId } });
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
