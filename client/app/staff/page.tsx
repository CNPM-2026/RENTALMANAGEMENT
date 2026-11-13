import { redirect } from "next/navigation";

/**
 * Điểm vào không gian thợ: mở thẳng tab Hồ sơ & kỹ năng.
 * Đăng nhập KHÔNG tự chuyển vào đây — mọi role đều về trang chủ trước.
 */
export default function StaffIndexPage() {
  redirect("/staff/profile");
}
