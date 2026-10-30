import bcrypt from 'bcryptjs';
import { PrismaClient, Role, RoomStatus, PostStatus, PostType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('TestPassword123!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin.test@rental.local' },
    update: { passwordHash, isActive: true, role: Role.ADMIN },
    create: {
      email: 'admin.test@rental.local',
      passwordHash,
      fullName: 'Test Admin',
      role: Role.ADMIN,
    },
  });

  const landlord = await prisma.user.upsert({
    where: { email: 'landlord.test@rental.local' },
    update: { passwordHash, isActive: true, role: Role.LANDLORD },
    create: {
      email: 'landlord.test@rental.local',
      passwordHash,
      fullName: 'Test Landlord',
      phone: '0912345678',
      role: Role.LANDLORD,
    },
  });

  const tenant = await prisma.user.upsert({
    where: { email: 'tenant.test@rental.local' },
    update: { passwordHash, isActive: true, role: Role.TENANT },
    create: {
      email: 'tenant.test@rental.local',
      passwordHash,
      fullName: 'Test Tenant',
      phone: '0987654321',
      role: Role.TENANT,
    },
  });

  const property = await prisma.property.findFirst({
    where: { landlordId: landlord.id, name: 'Test Property' },
  }) ?? await prisma.property.create({
    data: {
      landlordId: landlord.id,
      name: 'Test Property',
      address: '123 Test Street',
      province: 'Ho Chi Minh City',
      district: 'District 1',
      ward: 'Ben Nghe',
      description: 'Seed property for integration tests',
    },
  });

  const room = await prisma.room.findFirst({
    where: { propertyId: property.id, roomNumber: 'T-101' },
  }) ?? await prisma.room.create({
    data: {
      propertyId: property.id,
      roomNumber: 'T-101',
      priceMonthly: 5000000,
      depositAmount: 5000000,
      area: 25,
      maxOccupants: 2,
      status: RoomStatus.AVAILABLE,
    },
  });

  const post = await prisma.post.findFirst({
    where: { authorId: landlord.id, title: 'Test Rental Post' },
  }) ?? await prisma.post.create({
    data: {
      authorId: landlord.id,
      propertyId: property.id,
      roomId: room.id,
      title: 'Test Rental Post',
      description: 'Seed post for integration tests',
      price: 5000000,
      postType: PostType.RENT_OUT,
      status: PostStatus.APPROVED,
    },
  });

  await Promise.all([
    prisma.amenity.upsert({
      where: { name: 'Wi-Fi' },
      update: {},
      create: { name: 'Wi-Fi' },
    }),
    prisma.amenity.upsert({
      where: { name: 'Air conditioning' },
      update: {},
      create: { name: 'Air conditioning' },
    }),
  ]);

  console.log(JSON.stringify({
    admin: { id: admin.id, email: admin.email },
    landlord: { id: landlord.id, email: landlord.email },
    tenant: { id: tenant.id, email: tenant.email },
    propertyId: property.id,
    roomId: room.id,
    postId: post.id,
    password: 'TestPassword123!',
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
