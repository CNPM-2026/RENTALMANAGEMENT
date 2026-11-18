/**
 * Bộ lọc từ cấm và từ ngữ nhạy cảm cho tính năng Chat
 * Khi người dùng nhập hoặc gửi từ cấm, từ đó sẽ chuyển thành ****
 * và hiển thị thông báo cho người dùng.
 */

export const BANNED_KEYWORDS = [
  "đm",
  "dcm",
  "vcl",
  "clmm",
  "dmm",
  "vkl",
  "lừa đảo",
  "lua dao",
  "concac",
  "con cac",
  "địt",
  "ditme",
  "dit me",
  "buồi",
  "đụ",
];

export function filterChatMessage(content: string): {
  filteredText: string;
  hasBannedWords: boolean;
  bannedWords: string[];
} {
  if (!content || !content.trim()) {
    return { filteredText: content, hasBannedWords: false, bannedWords: [] };
  }

  let filteredText = content;
  let hasBannedWords = false;
  const bannedWords: string[] = [];

  for (const word of BANNED_KEYWORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    if (regex.test(filteredText)) {
      hasBannedWords = true;
      bannedWords.push(word);
      filteredText = filteredText.replace(regex, "****");
    }
  }

  return { filteredText, hasBannedWords, bannedWords };
}
