
import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { Prisma } from '@prisma/client';

type RoommatePostQuery = {
  keyword?: string;
  province?: string;
  district?: string;
  ward?: string;
  minPrice?: number;
  maxPrice?: number;
  gender?: string;
  hasRoom?: boolean;
  sleepSchedule?: string;
  smokingAllowed?: boolean;
  petAllowed?: boolean;
  minCleanliness?: number;
  sortBy?: 'best_match' | 'newest' | 'price_asc' | 'price_desc';
  limit?: number;
  /** Dùng nội bộ cho trang chi tiết hồ sơ; không nhận trực tiếp từ query công khai. */
  authorId?: string;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const calculateAge = (dob: Date | null) => {
  if (!dob) return 0;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
  return Math.max(age, 0);
};

export const matchingService = {
  // 1. Lấy danh sách câu hỏi khảo sát
  getQuestions: async () => {
    return await prisma.lifestyleQuestion.findMany({
      include: { options: true },
      orderBy: { category: 'asc' }
    });
  },

  /** Câu trả lời khảo sát hiện tại của người dùng (để prefill form). */
  getMyAnswers: async (userId: string) => {
    return prisma.userLifestyleAnswer.findMany({
      where: { userId },
      include: {
        question: true,
        option: true,
      },
    });
  },

  // 2. User nộp bài khảo sát
  submitAnswers: async (
    userId: string,
    answers: { questionId: string; optionId: string }[]
  ) => {
    const questionIds = answers.map((answer) => answer.questionId);
    if (new Set(questionIds).size !== questionIds.length) {
      throw new AppError('Mỗi câu hỏi chỉ được trả lời một lần', 400);
    }

    const optionIds = answers.map((answer) => answer.optionId);
    const validOptions = await prisma.lifestyleOption.findMany({
      where: { id: { in: optionIds }, questionId: { in: answers.map((answer) => answer.questionId) } },
      select: { id: true, questionId: true },
    });
    const validAnswerKeys = new Set(validOptions.map((option) => `${option.questionId}:${option.id}`));
    if (answers.some((answer) => !validAnswerKeys.has(`${answer.questionId}:${answer.optionId}`))) {
      throw new AppError('Câu trả lời khảo sát không hợp lệ', 400);
    }

    // Xóa các câu trả lời cũ nếu user làm lại
    await prisma.$transaction(async (tx) => {
      await tx.userLifestyleAnswer.deleteMany({ where: { userId } });
      await tx.userLifestyleAnswer.createMany({
        data: answers.map(ans => ({
          userId,
          questionId: ans.questionId,
          optionId: ans.optionId
        })),
      });
    });

    return { message: 'Lưu bài khảo sát thành công' };
  },

  // 3. Cập nhật tiêu chí tìm bạn ghép
  updatePreferences: async (userId: string, data: any) => {
    const {
      budgetMin,
      budgetMax,
      preferredGender,
      preferredProvince,
      preferredDistrict,
      preferredWard,
      hasRoom,
      currentProvince,
      currentDistrict,
      currentWard,
      currentAddress,
      currentRent,
      currentArea,
      currentOccupants,
      roommateSlots,
      moveInDate,
      smokingAllowed,
      petAllowed,
      cleanlinessLevel,
      sleepSchedule,
      occupationPreference,
      note,
    } = data;

    return await prisma.roommatePreference.upsert({
      where: { userId },
      update: {
        budgetMin,
        budgetMax,
        preferredGender,
        preferredProvince,
        preferredDistrict,
        preferredWard,
        hasRoom,
        currentProvince,
        currentDistrict,
        currentWard,
        currentAddress,
        currentRent,
        currentArea,
        currentOccupants,
        roommateSlots,
        moveInDate,
        smokingAllowed,
        petAllowed,
        cleanlinessLevel,
        sleepSchedule,
        occupationPreference,
        note,
      },
      create: {
        userId,
        budgetMin,
        budgetMax,
        preferredGender,
        preferredProvince,
        preferredDistrict,
        preferredWard,
        hasRoom,
        currentProvince,
        currentDistrict,
        currentWard,
        currentAddress,
        currentRent,
        currentArea,
        currentOccupants,
        roommateSlots,
        moveInDate,
        smokingAllowed,
        petAllowed,
        cleanlinessLevel,
        sleepSchedule,
        occupationPreference,
        note,
      }
    });
  },

  getPreferences: async (userId: string) => {
    return prisma.roommatePreference.findUnique({ where: { userId } });
  },

  /**
   * Danh sách bài đăng tìm bạn ở ghép đã được duyệt.
   * Khác `getSuggestedRoommates`: không bắt buộc người xem phải có hồ sơ gu sống
   * và hỗ trợ bộ lọc công khai (khu vực, ngân sách, giới tính, thói quen).
   * Điểm tương thích chỉ được tính khi người xem đã đăng nhập và có dữ liệu.
   */
  getRoommatePosts: async (query: RoommatePostQuery = {}, viewerId?: string) => {
    const andConditions: Prisma.PostWhereInput[] = [
      { OR: [{ expiredAt: null }, { expiredAt: { gt: new Date() } }] },
    ];

    const authorWhere: Prisma.UserWhereInput = { isActive: true };
    const preferenceWhere: Prisma.RoommatePreferenceWhereInput = {};

    if (query.gender) {
      authorWhere.profile = { is: { gender: query.gender } };
    }
    if (query.hasRoom !== undefined) preferenceWhere.hasRoom = query.hasRoom;
    if (query.sleepSchedule) preferenceWhere.sleepSchedule = query.sleepSchedule;
    if (query.smokingAllowed !== undefined) preferenceWhere.smokingAllowed = query.smokingAllowed;
    if (query.petAllowed !== undefined) preferenceWhere.petAllowed = query.petAllowed;
    if (query.minCleanliness !== undefined) {
      preferenceWhere.cleanlinessLevel = { gte: query.minCleanliness };
    }
    if (Object.keys(preferenceWhere).length > 0) {
      authorWhere.roommatePreference = { is: preferenceWhere };
    }

    if (query.keyword) {
      andConditions.push({
        OR: [
          { title: { contains: query.keyword, mode: 'insensitive' } },
          { description: { contains: query.keyword, mode: 'insensitive' } },
          { author: { fullName: { contains: query.keyword, mode: 'insensitive' } } },
          { author: { profile: { is: { occupation: { contains: query.keyword, mode: 'insensitive' } } } } },
        ],
      });
    }

    if (query.province || query.district || query.ward) {
      const propertyLocation: Prisma.PropertyWhereInput = {
        ...(query.province && { province: { contains: query.province, mode: 'insensitive' } }),
        ...(query.district && { district: { contains: query.district, mode: 'insensitive' } }),
        ...(query.ward && { ward: { contains: query.ward, mode: 'insensitive' } }),
      };
      const currentLocation: Prisma.RoommatePreferenceWhereInput = {
        hasRoom: true,
        ...(query.province && { currentProvince: { contains: query.province, mode: 'insensitive' } }),
        ...(query.district && { currentDistrict: { contains: query.district, mode: 'insensitive' } }),
        ...(query.ward && { currentWard: { contains: query.ward, mode: 'insensitive' } }),
      };
      const preferredLocation: Prisma.RoommatePreferenceWhereInput = {
        ...(query.province && { preferredProvince: { contains: query.province, mode: 'insensitive' } }),
        ...(query.district && { preferredDistrict: { contains: query.district, mode: 'insensitive' } }),
        ...(query.ward && { preferredWard: { contains: query.ward, mode: 'insensitive' } }),
      };
      andConditions.push({
        OR: [
          { property: propertyLocation },
          { room: { property: propertyLocation } },
          { author: { roommatePreference: { is: currentLocation } } },
          { author: { roommatePreference: { is: preferredLocation } } },
        ],
      });
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const postPriceRange = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
      andConditions.push({
        OR: [
          {
            author: {
              roommatePreference: {
                is: {
                  budgetMin: { not: null },
                  budgetMax: { not: null },
                  ...(query.minPrice !== undefined ? { budgetMax: { gte: query.minPrice } } : {}),
                  ...(query.maxPrice !== undefined ? { budgetMin: { lte: query.maxPrice } } : {}),
                },
              },
            },
          },
          { price: postPriceRange },
        ],
      });
    }

    const where: Prisma.PostWhereInput = {
      status: 'APPROVED',
      postType: 'FIND_ROOMMATE',
      ...(viewerId ? { authorId: { not: viewerId } } : {}),
      ...(query.authorId ? { authorId: query.authorId } : {}),
      author: authorWhere,
      AND: andConditions,
    };

    const orderBy: Prisma.PostOrderByWithRelationInput =
      query.sortBy === 'price_asc'
        ? { price: 'asc' }
        : query.sortBy === 'price_desc'
          ? { price: 'desc' }
          : { createdAt: 'desc' };

    const posts = await prisma.post.findMany({
      where,
      include: {
        images: { orderBy: { isPrimary: 'desc' } },
        property: { select: { name: true, province: true, district: true, ward: true } },
        room: {
          select: {
            id: true,
            roomNumber: true,
            maxOccupants: true,
            area: true,
            status: true,
            property: { select: { name: true, province: true, district: true, ward: true } },
          },
        },
        author: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            role: true,
            profile: { select: { gender: true, occupation: true, dob: true, bio: true } },
            roommatePreference: true,
            lifestyleAnswers: {
              include: {
                option: {
                  include: { question: { select: { id: true, weight: true } } },
                },
              },
            },
          },
        },
      },
      orderBy,
      take: query.limit ?? 60,
    });

    const viewer = viewerId
      ? await prisma.user.findUnique({
          where: { id: viewerId },
          include: {
            profile: true,
            roommatePreference: true,
            lifestyleAnswers: {
              include: {
                option: {
                  include: { question: { select: { id: true, weight: true } } },
                },
              },
            },
          },
        })
      : null;

    const myPreferences = viewer?.roommatePreference;
    const myAnswerMap = new Map(
      (viewer?.lifestyleAnswers ?? []).map((answer) => [
        answer.questionId,
        {
          score: answer.option.scoreValue,
          weight: answer.option.question.weight,
        },
      ]),
    );

    const items = posts.map((post) => {
      const candidate = post.author;
      const preference = candidate.roommatePreference;
      const price = toNumberOrNull(post.price);
      const postLocation = post.property ?? post.room?.property ?? null;
      const province = postLocation?.province
        ?? (preference?.hasRoom ? preference.currentProvince : null)
        ?? preference?.preferredProvince
        ?? null;
      const district = postLocation?.district
        ?? (preference?.hasRoom ? preference.currentDistrict : null)
        ?? preference?.preferredDistrict
        ?? null;
      const ward = postLocation?.ward
        ?? (preference?.hasRoom ? preference.currentWard : null)
        ?? preference?.preferredWard
        ?? null;

      let matchScore = 0;
      let matchedPossibleScore = 0;
      candidate.lifestyleAnswers.forEach((answer) => {
        const myAnswer = myAnswerMap.get(answer.questionId);
        if (!myAnswer) return;
        matchedPossibleScore += myAnswer.weight;
        const diff = Math.abs(myAnswer.score - answer.option.scoreValue);
        if (diff === 0) matchScore += myAnswer.weight;
        else if (diff === 1) matchScore += myAnswer.weight * 0.5;
      });

      let compatibilityPercent = matchedPossibleScore > 0
        ? Math.round((matchScore / matchedPossibleScore) * 100)
        : 0;

      const preferenceChecks: boolean[] = [];
      if (myPreferences?.budgetMin != null || myPreferences?.budgetMax != null) {
        preferenceChecks.push(
          price !== null
          && (myPreferences?.budgetMin == null || price >= Number(myPreferences.budgetMin))
          && (myPreferences?.budgetMax == null || price <= Number(myPreferences.budgetMax)),
        );
      }
      if (myPreferences?.preferredGender && myPreferences.preferredGender !== 'ANY') {
        preferenceChecks.push(candidate.profile?.gender === myPreferences.preferredGender);
      }
      if (myPreferences?.preferredProvince) {
        preferenceChecks.push(
          province?.toLocaleLowerCase() === myPreferences.preferredProvince.toLocaleLowerCase(),
        );
      }
      if (myPreferences?.preferredDistrict) {
        preferenceChecks.push(
          district?.toLocaleLowerCase() === myPreferences.preferredDistrict.toLocaleLowerCase(),
        );
      }
      if (myPreferences?.preferredWard) {
        preferenceChecks.push(
          ward?.toLocaleLowerCase() === myPreferences.preferredWard.toLocaleLowerCase(),
        );
      }
      if (myPreferences?.cleanlinessLevel != null && preference?.cleanlinessLevel != null) {
        preferenceChecks.push(
          Math.abs(myPreferences.cleanlinessLevel - preference.cleanlinessLevel) <= 1,
        );
      }
      if (myPreferences?.sleepSchedule && preference?.sleepSchedule) {
        preferenceChecks.push(myPreferences.sleepSchedule === preference.sleepSchedule);
      }
      if (myPreferences?.occupationPreference && candidate.profile?.occupation) {
        preferenceChecks.push(
          candidate.profile.occupation
            .toLocaleLowerCase()
            .includes(myPreferences.occupationPreference.toLocaleLowerCase()),
        );
      }
      if (preferenceChecks.length > 0) {
        const preferencePercent = Math.round(
          (preferenceChecks.filter(Boolean).length / preferenceChecks.length) * 100,
        );
        compatibilityPercent = Math.round(compatibilityPercent * 0.7 + preferencePercent * 0.3);
      }

      return {
        post: {
          id: post.id,
          title: post.title,
          description: post.description,
          price,
          createdAt: post.createdAt,
          expiredAt: post.expiredAt,
          images: post.images,
          property: post.property ?? post.room?.property ?? null,
          room: post.room
            ? {
                id: post.room.id,
                roomNumber: post.room.roomNumber,
                maxOccupants: post.room.maxOccupants,
                area: post.room.area,
                status: post.room.status,
              }
            : null,
        },
        user: {
          id: candidate.id,
          fullName: candidate.fullName,
          avatarUrl: candidate.avatarUrl,
          role: candidate.role,
          gender: candidate.profile?.gender ?? null,
          occupation: candidate.profile?.occupation ?? null,
          bio: candidate.profile?.bio ?? null,
          age: calculateAge(candidate.profile?.dob ?? null),
        },
        preference: preference
          ? {
              budgetMin: toNumberOrNull(preference.budgetMin),
              budgetMax: toNumberOrNull(preference.budgetMax),
              preferredGender: preference.preferredGender,
              preferredProvince: preference.preferredProvince,
              preferredDistrict: preference.preferredDistrict,
              preferredWard: preference.preferredWard,
              hasRoom: preference.hasRoom,
              currentProvince: preference.currentProvince,
              currentDistrict: preference.currentDistrict,
              currentWard: preference.currentWard,
              roommateSlots: preference.roommateSlots,
              moveInDate: preference.moveInDate,
              smokingAllowed: preference.smokingAllowed,
              petAllowed: preference.petAllowed,
              cleanlinessLevel: preference.cleanlinessLevel,
              sleepSchedule: preference.sleepSchedule,
              note: preference.note,
            }
          : null,
        location: { province, district, ward },
        compatibilityPercent,
        isDealBreaker: false,
      };
    });

    const resultsByUser = new Map<string, (typeof items)[number]>();
    items.forEach((item) => {
      const current = resultsByUser.get(item.user.id);
      const isBetter = !current
        || item.compatibilityPercent > current.compatibilityPercent
        || (
          item.compatibilityPercent === current.compatibilityPercent
          && new Date(item.post.createdAt).getTime() > new Date(current.post.createdAt).getTime()
        );
      if (isBetter) resultsByUser.set(item.user.id, item);
    });

    const results = Array.from(resultsByUser.values());
    if (query.sortBy === 'best_match' || !query.sortBy) {
      results.sort((a, b) => {
        if (b.compatibilityPercent !== a.compatibilityPercent) {
          return b.compatibilityPercent - a.compatibilityPercent;
        }
        return new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime();
      });
    }
    return results;
  },

  // 4. Thuật toán tính điểm tương thích bạn cùng phòng
  getSuggestedRoommates: async (myId: string) => {
    // B1. Lấy thông tin bản thân, câu trả lời và tiêu chí tìm kiếm
    const myInfo = await prisma.user.findUnique({
      where: { id: myId },
      include: {
        profile: true,
        roommatePreference: true,
        lifestyleAnswers: {
          include: {
            option: {
              include: {
                question: true
              }
            }
          }
        }
      }
    });

    if (!myInfo) throw new AppError('Không tìm thấy người dùng', 404);

    // B2. Map đáp án của mình theo questionId
    // Map: questionId -> { score, weight }
    const myAnswerMap = new Map(
      myInfo.lifestyleAnswers.map(answer => [
        answer.questionId,
        {
          score: answer.option.scoreValue,
          weight: answer.option.question.weight
        }
      ])
    );

    // B3. Chỉ lấy các bài đăng tìm bạn ở ghép đang được duyệt
    const roommatePosts = await prisma.post.findMany({
      where: {
        status: 'APPROVED',
        postType: 'FIND_ROOMMATE',
        authorId: { not: myId },
        OR: [{ expiredAt: null }, { expiredAt: { gt: new Date() } }],
        author: { isActive: true, role: 'TENANT' },
      },
      include: {
        property: { select: { province: true, district: true, ward: true } },
        author: {
          include: {
            profile: true,
            roommatePreference: true,
            lifestyleAnswers: { include: { option: true } },
          },
        },
      }
    });

    // B4. Lọc theo tiêu chí của người đang tìm
    const myPreferences = myInfo.roommatePreference;
    const eligiblePosts = roommatePosts.filter((post) => {
      const candidate = post.author;
      const candidatePreferences = candidate.roommatePreference;
      const price = post.price === null ? null : Number(post.price);
      const province = post.property?.province ?? (candidatePreferences?.hasRoom ? candidatePreferences.currentProvince : undefined) ?? candidatePreferences?.preferredProvince;
      const district = post.property?.district ?? (candidatePreferences?.hasRoom ? candidatePreferences.currentDistrict : undefined) ?? candidatePreferences?.preferredDistrict;
      const ward = post.property?.ward ?? (candidatePreferences?.hasRoom ? candidatePreferences.currentWard : undefined) ?? candidatePreferences?.preferredWard;

      if (myPreferences?.budgetMin !== null && myPreferences?.budgetMin !== undefined &&
        (price === null || price < Number(myPreferences.budgetMin))) return false;
      if (myPreferences?.budgetMax !== null && myPreferences?.budgetMax !== undefined &&
        (price === null || price > Number(myPreferences.budgetMax))) return false;
      if (myPreferences?.preferredProvince &&
        province?.toLocaleLowerCase() !== myPreferences.preferredProvince.toLocaleLowerCase()) return false;
      if (myPreferences?.preferredDistrict &&
        district?.toLocaleLowerCase() !== myPreferences.preferredDistrict.toLocaleLowerCase()) return false;
      if (myPreferences?.preferredWard &&
        ward?.toLocaleLowerCase() !== myPreferences.preferredWard.toLocaleLowerCase()) return false;
      if (myPreferences?.preferredGender &&
        myPreferences.preferredGender !== 'ANY' &&
        candidate.profile?.gender !== myPreferences.preferredGender) return false;
      // These fields describe the seeker's acceptance policy. They are not
      // candidate attributes, so they cannot exclude a post until the schema
      // stores the candidate's actual smoking/pet attributes.
      if (myPreferences?.cleanlinessLevel !== null && myPreferences?.cleanlinessLevel !== undefined &&
        candidatePreferences?.cleanlinessLevel !== null &&
        candidatePreferences?.cleanlinessLevel !== undefined &&
        Math.abs(myPreferences.cleanlinessLevel - candidatePreferences.cleanlinessLevel) > 1) return false;
      if (myPreferences?.sleepSchedule &&
        candidatePreferences?.sleepSchedule &&
        myPreferences.sleepSchedule !== candidatePreferences.sleepSchedule) return false;
      if (myPreferences?.occupationPreference &&
        candidate.profile?.occupation &&
        !candidate.profile.occupation.toLocaleLowerCase().includes(myPreferences.occupationPreference.toLocaleLowerCase())) return false;
      return true;
    });

    // B5. Tính điểm tương thích cho từng bài đăng
    const results = eligiblePosts.map(post => {
      const otherUser = post.author;
      const candidatePreferences = otherUser.roommatePreference;
      const province = post.property?.province ?? (candidatePreferences?.hasRoom ? candidatePreferences.currentProvince : undefined) ?? candidatePreferences?.preferredProvince;
      const district = post.property?.district ?? (candidatePreferences?.hasRoom ? candidatePreferences.currentDistrict : undefined) ?? candidatePreferences?.preferredDistrict;
      const ward = post.property?.ward ?? (candidatePreferences?.hasRoom ? candidatePreferences.currentWard : undefined) ?? candidatePreferences?.preferredWard;
      let matchScore = 0;
      let matchedPossibleScore = 0;

      otherUser.lifestyleAnswers.forEach(otherAnswer => {
        const myAnswer = myAnswerMap.get(otherAnswer.questionId);

        if (myAnswer) {
          matchedPossibleScore += myAnswer.weight;
          const otherScore = otherAnswer.option.scoreValue;
          const diff = Math.abs(myAnswer.score - otherScore);

          // Giống nhau: nhận 100% trọng số
          if (diff === 0) {
            matchScore += myAnswer.weight;
          }
          // Lệch một bậc: nhận 50% trọng số
          else if (diff === 1) {
            matchScore += myAnswer.weight * 0.5;
          }
          // Lệch từ hai bậc trở lên: 0 điểm
        }
      });

      let compatibilityPercent =
        matchedPossibleScore > 0
          ? Math.round((matchScore / matchedPossibleScore) * 100)
          : 0;

      const price = post.price === null ? null : Number(post.price);
      const budgetMatches =
        price !== null &&
        (myPreferences?.budgetMin === null ||
          myPreferences?.budgetMin === undefined ||
          price >= Number(myPreferences.budgetMin)) &&
        (myPreferences?.budgetMax === null ||
          myPreferences?.budgetMax === undefined ||
          price <= Number(myPreferences.budgetMax));
      const preferenceScore = [
        myPreferences?.budgetMin !== null && myPreferences?.budgetMin !== undefined ||
        myPreferences?.budgetMax !== null && myPreferences?.budgetMax !== undefined
          ? budgetMatches
          : null,
        myPreferences?.preferredGender && myPreferences.preferredGender !== 'ANY'
          ? otherUser.profile?.gender === myPreferences.preferredGender
          : null,
        myPreferences?.preferredProvince && province
          ? myPreferences.preferredProvince.toLocaleLowerCase() === province.toLocaleLowerCase()
          : null,
        myPreferences?.preferredDistrict && district
          ? myPreferences.preferredDistrict.toLocaleLowerCase() === district.toLocaleLowerCase()
          : null,
        myPreferences?.preferredWard && ward
          ? myPreferences.preferredWard.toLocaleLowerCase() === ward.toLocaleLowerCase()
          : null,
        myPreferences?.cleanlinessLevel !== null && myPreferences?.cleanlinessLevel !== undefined &&
        otherUser.roommatePreference?.cleanlinessLevel !== null &&
        otherUser.roommatePreference?.cleanlinessLevel !== undefined
          ? Math.abs(myPreferences.cleanlinessLevel - otherUser.roommatePreference.cleanlinessLevel) <= 1
          : null,
        myPreferences?.sleepSchedule && otherUser.roommatePreference?.sleepSchedule
          ? myPreferences.sleepSchedule === otherUser.roommatePreference.sleepSchedule
          : null,
        myPreferences?.occupationPreference && otherUser.profile?.occupation
          ? otherUser.profile.occupation.toLocaleLowerCase().includes(myPreferences.occupationPreference.toLocaleLowerCase())
          : null,
      ].filter((value): value is boolean => value !== null);
      if (preferenceScore.length > 0) {
        const preferencePercent = Math.round(
          (preferenceScore.filter(Boolean).length / preferenceScore.length) * 100
        );
        compatibilityPercent = Math.round(compatibilityPercent * 0.7 + preferencePercent * 0.3);
      }

      return {
        post: {
          id: post.id,
          title: post.title,
          description: post.description,
          price: post.price,
          createdAt: post.createdAt,
          expiredAt: post.expiredAt,
          property: post.property,
        },
        user: {
          id: otherUser.id,
          fullName: otherUser.fullName,
          avatarUrl: otherUser.avatarUrl,
          role: otherUser.role,
          gender: otherUser.profile?.gender,
          occupation: otherUser.profile?.occupation
        },
        compatibilityPercent,
        // Deal-breakers are represented by the hard filters above until the
        // schema stores explicit candidate attributes for them.
        isDealBreaker: false
      };
    });

    // B6. Chỉ lấy bài đăng đạt ngưỡng tương thích và sắp xếp giảm dần
    return results
      .filter(
        result =>
          (result.compatibilityPercent >= 40 || myInfo.lifestyleAnswers.length === 0) &&
          !result.isDealBreaker
      )
      .sort(
        (a, b) =>
          b.compatibilityPercent - a.compatibilityPercent
      );
  }
};
