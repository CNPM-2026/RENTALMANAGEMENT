import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostStatus, PostType, Role } from '@prisma/client';
import prisma from './config/db';
import { matchingService } from './services/matching.service';

describe('roommate post matching', () => {
  let seekerId = '';
  let candidateId = '';
  let questionId = '';
  let optionId = '';
  let postId = '';

  beforeAll(async () => {
    const suffix = Date.now();
    const passwordHash = 'test-hash';
    const seeker = await prisma.user.create({
      data: { email: `matching-seeker-${suffix}@rental.local`, passwordHash, fullName: 'Matching Seeker', role: Role.TENANT },
    });
    const candidate = await prisma.user.create({
      data: { email: `matching-candidate-${suffix}@rental.local`, passwordHash, fullName: 'Matching Candidate', role: Role.TENANT },
    });
    seekerId = seeker.id;
    candidateId = candidate.id;

    await prisma.userProfile.create({ data: { userId: candidateId, gender: 'MALE' } });
    await prisma.roommatePreference.create({
      data: {
        userId: seekerId,
        budgetMin: 1000000,
        budgetMax: 5000000,
        preferredGender: 'MALE',
        preferredProvince: 'Ho Chi Minh City',
        smokingAllowed: false,
        petAllowed: false,
      },
    });
    await prisma.roommatePreference.create({
      data: {
        userId: candidateId,
        preferredProvince: 'Ho Chi Minh City',
        smokingAllowed: false,
        petAllowed: false,
      },
    });

    const question = await prisma.lifestyleQuestion.create({
      data: {
        questionText: `Matching question ${suffix}`,
        category: 'Test',
        weight: 1,
        options: { create: [{ optionText: 'Same', scoreValue: 1 }] },
      },
      include: { options: true },
    });
    questionId = question.id;
    optionId = question.options[0].id;
    await prisma.userLifestyleAnswer.createMany({
      data: [
        { userId: seekerId, questionId, optionId },
        { userId: candidateId, questionId, optionId },
      ],
    });
    const post = await prisma.post.create({
      data: {
        authorId: candidateId,
        title: `Find roommate ${suffix}`,
        description: 'A matching integration test post',
        price: 3000000,
        postType: PostType.FIND_ROOMMATE,
        status: PostStatus.APPROVED,
      },
    });
    postId = post.id;
  });

  it('returns approved roommate posts matching the seeker criteria', async () => {
    const results = await matchingService.getSuggestedRoommates(seekerId);

    expect(results).toHaveLength(1);
    expect(results[0].post.id).toBe(postId);
    expect(results[0].compatibilityPercent).toBe(100);
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { id: postId } });
    await prisma.userLifestyleAnswer.deleteMany({ where: { userId: { in: [seekerId, candidateId] } } });
    await prisma.lifestyleQuestion.deleteMany({ where: { id: questionId } });
    await prisma.roommatePreference.deleteMany({ where: { userId: { in: [seekerId, candidateId] } } });
    await prisma.userProfile.deleteMany({ where: { userId: candidateId } });
    await prisma.user.deleteMany({ where: { id: { in: [seekerId, candidateId] } } });
    await prisma.$disconnect();
  });
});
