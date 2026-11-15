import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import prisma from '../../src/config/db';

const login = async (email: string) => {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'TestPassword123!' });
  expect(response.status).toBe(200);
  return response.body.data.token as string;
};

describe('admin notification queue types', () => {
  it('creates a SUPPORT_TICKET notification with the ticket reference', async () => {
    const token = await login('tenant.test@rental.local');
    const suffix = Date.now().toString();
    let ticketId: string | undefined;

    try {
      const response = await request(app)
        .post('/api/v1/support')
        .set('Authorization', `Bearer ${token}`)
        .send({
          category: 'TECHNICAL',
          subject: `Integration support ${suffix}`,
          description: 'Regression test for the admin support notification queue.',
          priority: 'MEDIUM',
        });

      expect(response.status).toBe(201);
      ticketId = response.body.data.id;

      const notifications = await prisma.notification.findMany({
        where: { type: 'SUPPORT_TICKET', referenceId: ticketId },
        select: { referenceId: true, type: true, userId: true },
      });

      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications.every((item) => item.referenceId === ticketId)).toBe(true);
      expect(notifications.every((item) => item.type === 'SUPPORT_TICKET')).toBe(true);
    } finally {
      if (ticketId) {
        await prisma.notification.deleteMany({ where: { referenceId: ticketId } });
        await prisma.supportTicket.delete({ where: { id: ticketId } }).catch(() => undefined);
      }
    }
  });

  it('creates a POST_PENDING notification with the post reference', async () => {
    const token = await login('landlord.test@rental.local');
    const suffix = Date.now().toString();
    let propertyId: string | undefined;
    let roomId: string | undefined;
    let postId: string | undefined;

    try {
      const propertyResponse = await request(app)
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Notification Property ${suffix}`,
          address: '789 Notification Street',
          province: 'Ho Chi Minh City',
          district: 'District 5',
          ward: 'Ward 2',
        });
      expect(propertyResponse.status).toBe(201);
      propertyId = propertyResponse.body.data.id;

      const roomResponse = await request(app)
        .post('/api/v1/rooms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          propertyId,
          roomNumber: `N-${suffix}`,
          priceMonthly: 3500000,
          depositAmount: 3500000,
          area: 18,
        });
      expect(roomResponse.status).toBe(201);
      roomId = roomResponse.body.data.id;

      const postResponse = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: `Integration listing ${suffix}`,
          description: 'Regression test for the admin listing moderation notification queue.',
          postType: 'RENT_OUT',
          propertyId,
          roomId,
          price: 3500000,
        });
      expect(postResponse.status).toBe(201);
      postId = postResponse.body.data.id;

      const notifications = await prisma.notification.findMany({
        where: { type: 'POST_PENDING', referenceId: postId },
        select: { referenceId: true, type: true },
      });

      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications.every((item) => item.referenceId === postId)).toBe(true);
      expect(notifications.every((item) => item.type === 'POST_PENDING')).toBe(true);
    } finally {
      if (postId) {
        await prisma.notification.deleteMany({ where: { referenceId: postId } });
        await prisma.post.delete({ where: { id: postId } }).catch(() => undefined);
      }
      if (roomId) await prisma.room.delete({ where: { id: roomId } }).catch(() => undefined);
      if (propertyId) await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    }
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});