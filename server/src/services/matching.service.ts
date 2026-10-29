
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
    // Xóa các câu trả lời cũ nếu user làm lại
    await prisma.userLifestyleAnswer.deleteMany({
      where: { userId }
    });

    // Lưu đáp án mới vào DB
    const dataToInsert = answers.map(ans => ({
      userId,
      questionId: ans.questionId,
      optionId: ans.optionId
    }));

    await prisma.userLifestyleAnswer.createMany({
      data: dataToInsert
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
      smokingAllowed,
      petAllowed
    } = data;

    return await prisma.roommatePreference.upsert({
      where: { userId },
      update: {
        budgetMin,
        budgetMax,
        preferredGender,
        preferredProvince,
        smokingAllowed,
        petAllowed
      },
      create: {
        userId,
        budgetMin,
        budgetMax,
        preferredGender,
        preferredProvince,
        smokingAllowed,
        petAllowed
      }
    });
  },

  // 4. Thuật toán tính điểm tương thích bạn cùng phòng
  getSuggestedRoommates: async (myId: string) => {
    // B1. Lấy thông tin bản thân và đáp án khảo sát
    const myInfo = await prisma.user.findUnique({
      where: { id: myId },
      include: {
        profile: true,
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

    // B3. Lấy danh sách user khác
    const otherUsers = await prisma.user.findMany({
      where: {
        id: { not: myId },
        role: { in: ['TENANT', 'LANDLORD'] },
        isActive: true
      },
      include: {
        profile: true,
        roommatePreference: true,
        lifestyleAnswers: {
          include: {
            option: true
          }
        }
      }
    });

    // B4. Tính điểm tương thích cho từng user
    const results = otherUsers.map(otherUser => {
      let matchScore = 0;
      let isDealBreaker = false;

      // 4.1. Kiểm tra tiêu chí loại trừ giới tính
      const prefs = otherUser.roommatePreference;

      if (
        prefs?.preferredGender &&
        prefs.preferredGender !== 'ANY' &&
        prefs.preferredGender !== myInfo.profile?.gender
      ) {
        isDealBreaker = true;
      }

      // 4.2. Tính điểm dựa trên độ lệch scoreValue
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

      // 4.3. Tính phần trăm tương thích
      let compatibilityPercent =
        maxPossibleScore > 0
          ? Math.round((matchScore / maxPossibleScore) * 100)
          : 0;

      // Vi phạm tiêu chí loại trừ: điểm bằng 0
      if (isDealBreaker) {
        compatibilityPercent = 0;
      }

      return {
        user: {
          id: otherUser.id,
          fullName: otherUser.fullName,
          avatarUrl: otherUser.avatarUrl,
          role: otherUser.role,
          gender: otherUser.profile?.gender,
          occupation: otherUser.profile?.occupation
        },
        compatibilityPercent,
        isDealBreaker
      };
    });

    // B5. Chỉ lấy người tương thích từ 40% trở lên,
    // không vi phạm tiêu chí loại trừ và sắp xếp giảm dần
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
