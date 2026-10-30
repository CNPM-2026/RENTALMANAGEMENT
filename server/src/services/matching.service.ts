
import prisma from '../config/db';
import { AppError } from '../utils/AppError';

export const matchingService = {
  // 1. Lấy danh sách câu hỏi khảo sát
  getQuestions: async () => {
    return await prisma.lifestyleQuestion.findMany({
      include: { options: true },
      orderBy: { category: 'asc' }
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
        smokingAllowed,
        petAllowed,
        cleanlinessLevel,
        sleepSchedule,
        occupationPreference,
        note,
      }
    });
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

    if (!myInfo || myInfo.lifestyleAnswers.length === 0) {
      throw new AppError(
        'Bạn cần hoàn thành bài khảo sát thói quen sinh hoạt trước',
        400
      );
    }

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

    // Tổng điểm tối đa có thể đạt được
    let maxPossibleScore = 0;

    myAnswerMap.forEach(answer => {
      maxPossibleScore += answer.weight;
    });

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
      const province = post.property?.province ?? candidatePreferences?.preferredProvince;
      const district = post.property?.district ?? candidatePreferences?.preferredDistrict;
      const ward = post.property?.ward ?? candidatePreferences?.preferredWard;

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
      if (myPreferences?.smokingAllowed !== null && myPreferences?.smokingAllowed !== undefined &&
        candidatePreferences?.smokingAllowed !== null &&
        candidatePreferences?.smokingAllowed !== undefined &&
        myPreferences.smokingAllowed !== candidatePreferences.smokingAllowed) return false;
      if (myPreferences?.petAllowed !== null && myPreferences?.petAllowed !== undefined &&
        candidatePreferences?.petAllowed !== null &&
        candidatePreferences?.petAllowed !== undefined &&
        myPreferences.petAllowed !== candidatePreferences.petAllowed) return false;
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
      let matchScore = 0;

      otherUser.lifestyleAnswers.forEach(otherAnswer => {
        const myAnswer = myAnswerMap.get(otherAnswer.questionId);

        if (myAnswer) {
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
        maxPossibleScore > 0
          ? Math.round((matchScore / maxPossibleScore) * 100)
          : 0;

      const preferenceScore = [
        myPreferences?.budgetMin !== null && myPreferences?.budgetMin !== undefined ||
        myPreferences?.budgetMax !== null && myPreferences?.budgetMax !== undefined
          ? post.price !== null
          : null,
        myPreferences?.preferredGender && myPreferences.preferredGender !== 'ANY'
          ? otherUser.profile?.gender === myPreferences.preferredGender
          : null,
        myPreferences?.preferredProvince && post.property?.province
          ? myPreferences.preferredProvince.toLocaleLowerCase() === post.property.province.toLocaleLowerCase()
          : null,
        myPreferences?.preferredDistrict && post.property?.district
          ? myPreferences.preferredDistrict.toLocaleLowerCase() === post.property.district.toLocaleLowerCase()
          : null,
        myPreferences?.preferredWard && post.property?.ward
          ? myPreferences.preferredWard.toLocaleLowerCase() === post.property.ward.toLocaleLowerCase()
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
        isDealBreaker: false
      };
    });

    // B6. Chỉ lấy bài đăng đạt ngưỡng tương thích và sắp xếp giảm dần
    return results
      .filter(
        result =>
          result.compatibilityPercent >= 40 &&
          !result.isDealBreaker
      )
      .sort(
        (a, b) =>
          b.compatibilityPercent - a.compatibilityPercent
      );
  }
};
