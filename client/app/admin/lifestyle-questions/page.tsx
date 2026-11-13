"use client";

import * as React from "react";
import {
  CheckCircle2,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { LifestyleOptionPayload, LifestyleQuestion, LifestyleQuestionPayload } from "@/types/models";

type OptionForm = {
  id?: string;
  optionText: string;
  scoreValue: string;
};

const emptyOption = (): OptionForm => ({ optionText: "", scoreValue: "0" });

export default function AdminLifestyleQuestionsPage() {
  const [questions, setQuestions] = React.useState<LifestyleQuestion[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [questionText, setQuestionText] = React.useState("");
  const [category, setCategory] = React.useState("Thói quen sinh hoạt");
  const [weight, setWeight] = React.useState("1");
  const [options, setOptions] = React.useState<OptionForm[]>([emptyOption(), emptyOption()]);

  const loadQuestions = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await apiClient.admin.getLifestyleQuestions();
      setQuestions(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể tải danh sách câu hỏi.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadQuestions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadQuestions]);

  const resetForm = () => {
    setEditingId(null);
    setQuestionText("");
    setCategory("Thói quen sinh hoạt");
    setWeight("1");
    setOptions([emptyOption(), emptyOption()]);
  };

  const startEdit = (question: LifestyleQuestion) => {
    setEditingId(question.id);
    setQuestionText(question.questionText);
    setCategory(question.category);
    setWeight(String(question.weight));
    setOptions(
      question.options.map((option) => ({
        id: option.id,
        optionText: option.optionText,
        scoreValue: String(option.scoreValue),
      })),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateOption = (index: number, patch: Partial<OptionForm>) => {
    setOptions((previous) =>
      previous.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...patch } : option
      ),
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanOptions: LifestyleOptionPayload[] = options
      .map((option) => ({
        ...(option.id ? { id: option.id } : {}),
        optionText: option.optionText.trim(),
        scoreValue: Number(option.scoreValue),
      }))
      .filter((option) => option.optionText.length > 0);

    if (questionText.trim().length < 5) {
      setErrorMessage("Câu hỏi phải có ít nhất 5 ký tự.");
      return;
    }
    if (!category.trim()) {
      setErrorMessage("Vui lòng nhập danh mục câu hỏi.");
      return;
    }
    if (cleanOptions.length < 2) {
      setErrorMessage("Cần ít nhất 2 lựa chọn trả lời.");
      return;
    }
    if (cleanOptions.some((option) => !Number.isFinite(option.scoreValue))) {
      setErrorMessage("Điểm của mỗi lựa chọn phải là số hợp lệ.");
      return;
    }

    const payload: LifestyleQuestionPayload = {
      questionText: questionText.trim(),
      category: category.trim(),
      weight: Number(weight) || 1,
      options: cleanOptions,
    };

    setIsSaving(true);
    try {
      if (editingId) {
        await apiClient.admin.updateLifestyleQuestion(editingId, payload);
        setSuccessMessage("Đã cập nhật câu hỏi sinh hoạt.");
      } else {
        await apiClient.admin.createLifestyleQuestion(payload);
        setSuccessMessage("Đã thêm câu hỏi sinh hoạt mới.");
      }
      resetForm();
      await loadQuestions();
      window.setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể lưu câu hỏi.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (question: LifestyleQuestion) => {
    const confirmed = window.confirm(
      `Xóa câu hỏi "${question.questionText}"? Các câu trả lời khảo sát liên quan cũng sẽ bị xóa.`,
    );
    if (!confirmed) return;
    setErrorMessage(null);
    try {
      await apiClient.admin.deleteLifestyleQuestion(question.id);
      setQuestions((previous) => previous.filter((item) => item.id !== question.id));
      if (editingId === question.id) resetForm();
      setSuccessMessage("Đã xóa câu hỏi sinh hoạt.");
      window.setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể xóa câu hỏi.");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] text-[#74817b]">Quản trị tính năng ở ghép</p>
          <h1 className="mt-0.5 text-[26px] font-semibold text-[#203c37]">Câu hỏi thói quen sinh hoạt</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-[#74817b]">
            Thêm câu hỏi để người tìm bạn ở ghép mô tả lối sống. Điểm tương thích được
            tính theo trọng số câu hỏi và điểm của từng lựa chọn.
          </p>
        </div>
        <div className="rounded-[10px] border border-[#e2e7e1] bg-white px-4 py-2 text-[13px] text-[#74817b]">
          Tổng cộng <strong className="text-[#203c37]">{questions.length}</strong> câu hỏi
        </div>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 rounded-[8px] border border-[#b2d3c2] bg-[#eaf2ed] px-4 py-3 text-[13px] font-semibold text-[#15594f]">
          <CheckCircle2 className="size-4" />
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[16px] font-bold text-[#203c37]">
            <ListChecks className="size-4 text-[#15594f]" />
            {editingId ? "Chỉnh sửa câu hỏi" : "Thêm câu hỏi mới"}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#74817b] hover:text-[#203c37]"
            >
              <X className="size-3.5" />
              Hủy chỉnh sửa
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_220px_140px]">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#203c37]">Nội dung câu hỏi</label>
            <input
              type="text"
              value={questionText}
              onChange={(event) => setQuestionText(event.target.value)}
              maxLength={300}
              placeholder="VD: Bạn thường ngủ vào khung giờ nào?"
              className="w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2.5 text-[13px] outline-none focus:border-[#15594f]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#203c37]">Danh mục</label>
            <input
              type="text"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              maxLength={50}
              list="lifestyle-categories"
              className="w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2.5 text-[13px] outline-none focus:border-[#15594f]"
            />
            <datalist id="lifestyle-categories">
              <option value="Giờ giấc" />
              <option value="Vệ sinh" />
              <option value="Thú cưng" />
              <option value="Hút thuốc" />
              <option value="Nấu ăn" />
              <option value="Khách đến chơi" />
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[#203c37]">Trọng số</label>
            <input
              type="number"
              min={1}
              max={10}
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              className="w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2.5 text-[13px] outline-none focus:border-[#15594f]"
            />
            <p className="mt-1 text-[11px] text-[#74817b]">1 = ít quan trọng, 10 = rất quan trọng.</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-medium text-[#203c37]">Các lựa chọn trả lời</label>
            <button
              type="button"
              onClick={() => setOptions((previous) => [...previous, emptyOption()])}
              disabled={options.length >= 10}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#15594f] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              Thêm lựa chọn
            </button>
          </div>
          <p className="text-[12px] text-[#74817b]">
            Điểm càng gần nhau thì hai người càng dễ được ghép. Nên dùng thang 1 - 5 cho dễ hiểu.
          </p>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={option.id ?? `new-${index}`} className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#eaf2ed] text-[11px] font-bold text-[#15594f]">
                  {index + 1}
                </span>
                <input
                  type="text"
                  value={option.optionText}
                  onChange={(event) => updateOption(index, { optionText: event.target.value })}
                  maxLength={200}
                  placeholder="Nội dung lựa chọn"
                  className="min-w-0 flex-1 rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-[13px] outline-none focus:border-[#15594f]"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={option.scoreValue}
                  onChange={(event) => updateOption(index, { scoreValue: event.target.value })}
                  title="Điểm của lựa chọn"
                  className="w-24 rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-[13px] outline-none focus:border-[#15594f]"
                />
                <button
                  type="button"
                  onClick={() => setOptions((previous) => previous.filter((_, optionIndex) => optionIndex !== index))}
                  disabled={options.length <= 2}
                  className="rounded-[8px] p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Xóa lựa chọn"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>

        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-[#e2e7e1] pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-[8px] bg-[#15594f] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#124b42] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {editingId ? "Lưu thay đổi" : "Thêm câu hỏi"}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="rounded-[8px] border border-[#e2e7e1] px-4 py-2.5 text-[13px] font-semibold text-[#74817b] hover:border-[#203c37] hover:text-[#203c37]"
          >
            Làm mới
          </button>
        </div>
      </form>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-[#203c37]">Danh sách câu hỏi hiện có</h2>
          <button
            type="button"
            onClick={() => void loadQuestions()}
            className="text-[12px] font-semibold text-[#15594f] hover:underline"
          >
            Tải lại
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-[12px] border border-[#e2e7e1] bg-white p-8 text-[13px] text-[#74817b]">
            <Loader2 className="size-4 animate-spin text-[#15594f]" />
            Đang tải câu hỏi...
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-[#e2e7e1] bg-white p-8 text-center">
            <ListChecks className="mx-auto size-8 text-[#74817b]" />
            <p className="mt-3 text-[14px] font-semibold text-[#203c37]">Chưa có câu hỏi sinh hoạt nào</p>
            <p className="mt-1 text-[13px] text-[#74817b]">
              Dùng biểu mẫu phía trên để thêm câu hỏi đầu tiên cho tính năng tìm bạn ở ghép.
            </p>
          </div>
        ) : (
          questions.map((question) => (
            <article key={question.id} className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#eaf2ed] px-2.5 py-0.5 text-[11px] font-semibold text-[#15594f]">
                      {question.category}
                    </span>
                    <span className="text-[11px] text-[#74817b]">Trọng số {question.weight}</span>
                    <span className="text-[11px] text-[#74817b]">
                      {question._count?.answers ?? 0} lượt trả lời
                    </span>
                  </div>
                  <h3 className="mt-2 text-[15px] font-semibold text-[#203c37]">{question.questionText}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {question.options.map((option) => (
                      <span
                        key={option.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e7e1] bg-[#f7f6f2] px-3 py-1 text-[12px] text-[#203c37]"
                      >
                        {option.optionText}
                        <span className="font-bold text-[#15594f]">{option.scoreValue}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(question)}
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-[12px] font-semibold text-[#203c37] hover:border-[#15594f] hover:text-[#15594f]"
                  >
                    <Pencil className="size-3.5" />
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(question)}
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-red-200 px-3 py-2 text-[12px] font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" />
                    Xóa
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

    </div>
  );
}
