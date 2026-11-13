import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  FileCheck2,
  HeartHandshake,
  Home,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Về chúng tôi",
  description:
    "5K-Rental Manager kết nối người thuê với chủ trọ minh bạch, hỗ trợ tìm phòng, quản lý hợp đồng và tìm bạn ở ghép dựa trên thói quen sinh hoạt.",
};

const stats = [
  { value: "100%", label: "Tin đăng được kiểm duyệt trước khi hiển thị" },
  { value: "24/7", label: "Kênh hỗ trợ người thuê và chủ trọ" },
  { value: "12+", label: "Tiêu chí đối chiếu thói quen sinh hoạt" },
  { value: "1 nơi", label: "Quản lý phòng, hợp đồng, hóa đơn, sự cố" },
];

const pillars = [
  {
    icon: Search,
    title: "Thông tin rõ ràng",
    description:
      "Giá thuê, diện tích, tiện ích, vị trí và tình trạng phòng được hiển thị nhất quán. Người thuê không phải ghép thông tin từ nhiều nguồn rời rạc.",
  },
  {
    icon: FileCheck2,
    title: "Quy trình trực tuyến",
    description:
      "Đặt lịch xem phòng, gửi yêu cầu thuê, ký hợp đồng số, theo dõi hóa đơn và báo sự cố trên cùng một hệ thống.",
  },
  {
    icon: HeartHandshake,
    title: "Hỗ trợ xuyên suốt",
    description:
      "Đội ngũ hỗ trợ tiếp nhận câu hỏi, tranh chấp và báo cáo vi phạm; ưu tiên xử lý các tình huống ảnh hưởng đến quyền lợi người thuê.",
  },
];

const commitments = [
  "Chủ trọ cung cấp thông tin phòng và giấy tờ pháp lý trung thực, cập nhật khi có thay đổi.",
  "Tin đăng có dấu hiệu trùng lặp, sai giá hoặc yêu cầu đặt cọc bất thường sẽ được rà soát.",
  "Người thuê được khuyến nghị xem phòng trực tiếp và đọc kỹ hợp đồng trước khi chuyển tiền.",
  "Dữ liệu hồ sơ, lịch sử giao dịch và thông tin liên hệ được bảo vệ theo Chính sách bảo mật.",
];

export default function AboutPage() {
  return (
    <div className="w-full bg-[#f7f6f2] text-[#203c37]">
      <section className="border-b border-[#e2e7e1] bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-16 lg:px-10 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#d2e4d7] bg-[#eaf2ed] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#15594f]">
                <Sparkles className="size-3.5" />
                Về 5K-Rental Manager
              </span>
              <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-[#203c37] sm:text-5xl">
                Thuê trọ minh bạch, ở ghép hợp gu, quản lý nhẹ nhàng
              </h1>
              <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-[#74817b]">
                Chúng tôi xây dựng một nền tảng kết nối người thuê với chủ trọ,
                đồng thời giúp người trẻ tìm được bạn cùng phòng phù hợp dựa trên
                ngân sách, khu vực và thói quen sinh hoạt thật của mỗi người.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/rooms"
                  className="inline-flex items-center gap-2 rounded-[8px] bg-[#15594f] px-5 py-3 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-[#124b42]"
                >
                  <Search className="size-4" />
                  Tìm phòng ngay
                </Link>
                <Link
                  href="/roommates"
                  className="inline-flex items-center gap-2 rounded-[8px] border border-[#e2e7e1] bg-white px-5 py-3 text-[14px] font-semibold text-[#203c37] transition-colors hover:border-[#15594f] hover:text-[#15594f]"
                >
                  <Users className="size-4" />
                  Khám phá bạn ở ghép
                </Link>
              </div>
            </div>

            <div className="rounded-[16px] border border-[#e2e7e1] bg-[#f7f6f2] p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-[12px] bg-[#15594f] text-white">
                  <Home className="size-6" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-[#203c37]">
                    Một chốn ở hợp gu
                  </p>
                  <p className="text-[12px] text-[#74817b]">
                    Dành cho người thuê, chủ trọ và cộng đồng ở ghép
                  </p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {stats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[10px] border border-[#e2e7e1] bg-white p-4"
                  >
                    <p className="text-2xl font-bold text-[#15594f]">
                      {item.value}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-[#74817b]">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 py-16 lg:px-10">
        <div className="grid gap-5 md:grid-cols-3">
          {pillars.map((pillar) => (
            <article
              key={pillar.title}
              className="rounded-[14px] border border-[#e2e7e1] bg-white p-6 shadow-sm"
            >
              <div className="flex size-11 items-center justify-center rounded-[10px] bg-[#eaf2ed] text-[#15594f]">
                <pillar.icon className="size-5" />
              </div>
              <h2 className="mt-4 text-[17px] font-bold text-[#203c37]">
                {pillar.title}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-[#74817b]">
                {pillar.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="commitment" className="scroll-mt-24 border-y border-[#e2e7e1] bg-white">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#15594f]">
              Cam kết an tâm
            </span>
            <h2 className="mt-2 text-3xl font-bold text-[#203c37]">
              Chúng tôi đặt tính minh bạch lên trước tốc độ
            </h2>
            <p className="mt-4 text-[14px] leading-relaxed text-[#74817b]">
              Mỗi tin đăng, hồ sơ và giao dịch đều có dấu vết để đối soát. Khi có
              vấn đề, người dùng có thể gửi báo cáo kèm bằng chứng để đội ngũ hỗ
              trợ vào cuộc thay vì phải tự xoay xở.
            </p>
            <Link
              href="/tenant/safety"
              className="mt-6 inline-flex items-center gap-2 text-[14px] font-semibold text-[#15594f] hover:underline"
            >
              Xem cẩm nang an toàn thuê trọ
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {commitments.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-[10px] border border-[#e2e7e1] bg-[#f7f6f2] p-4"
              >
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#15594f]" />
                <p className="text-[14px] leading-relaxed text-[#203c37]">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="rules" className="scroll-mt-24 mx-auto max-w-[1200px] px-6 py-16 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#15594f]">
              Quy chế hoạt động
            </span>
            <h2 className="mt-2 text-3xl font-bold text-[#203c37]">
              Ai cũng có trách nhiệm với cộng đồng thuê trọ
            </h2>
            <p className="mt-4 text-[14px] leading-relaxed text-[#74817b]">
              Người dùng phải cung cấp thông tin đúng, tôn trọng quyền riêng tư
              của người khác và không sử dụng nền tảng để lừa đảo, quấy rối hoặc
              đăng nội dung trái pháp luật. Các hành vi vi phạm có thể bị ẩn tin,
              khóa tính năng hoặc khóa tài khoản tùy mức độ.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: BadgeCheck, title: "Tài khoản", text: "Xác thực email, số điện thoại và cập nhật hồ sơ trung thực." },
              { icon: Building2, title: "Chủ trọ", text: "Công khai giá, tình trạng phòng và điều kiện thuê rõ ràng." },
              { icon: Users, title: "Ở ghép", text: "Tôn trọng thói quen sinh hoạt và không gian riêng của nhau." },
              { icon: ShieldCheck, title: "An toàn", text: "Báo cáo dấu hiệu lừa đảo, đòi cọc bất thường hoặc quấy rối." },
            ].map((item) => (
              <div key={item.title} className="rounded-[10px] border border-[#e2e7e1] bg-white p-4 shadow-sm">
                <item.icon className="size-5 text-[#15594f]" />
                <p className="mt-3 text-[14px] font-semibold text-[#203c37]">{item.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#74817b]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-24 border-y border-[#e2e7e1] bg-white">
        <div className="mx-auto max-w-[1200px] px-6 py-16 lg:px-10">
          <div className="max-w-2xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#15594f]">
              Bảng giá dịch vụ
            </span>
            <h2 className="mt-2 text-3xl font-bold text-[#203c37]">
              Chi phí được nói rõ trước khi bạn quyết định
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-[#74817b]">
              Một số dịch vụ quản lý có thể phát sinh phí theo thỏa thuận với chủ
              trọ hoặc theo bảng giá công bố tại thời điểm sử dụng. Nền tảng không
              tự thu tiền cọc hoặc tiền thuê thay cho chủ trọ nếu không có thông
              báo riêng trong từng luồng giao dịch.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { title: "Người thuê", price: "Miễn phí", text: "Tìm phòng, lưu tin, đặt lịch xem và gửi yêu cầu hỗ trợ." },
              { title: "Chủ trọ", price: "Theo gói", text: "Đăng tin, quản lý phòng, hợp đồng, hóa đơn và nhân sự." },
              { title: "Ở ghép", price: "Miễn phí", text: "Tạo hồ sơ, khảo sát lối sống và gửi lời mời kết nối." },
            ].map((item) => (
              <div key={item.title} className="rounded-[12px] border border-[#e2e7e1] bg-[#f7f6f2] p-5">
                <p className="text-[13px] font-semibold uppercase tracking-wider text-[#74817b]">{item.title}</p>
                <p className="mt-2 text-2xl font-bold text-[#15594f]">{item.price}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-[#74817b]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="moderation" className="scroll-mt-24 mx-auto max-w-[1200px] px-6 py-16 lg:px-10">
        <div className="rounded-[16px] border border-[#d2e4d7] bg-[#eaf2ed] p-8 lg:p-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#15594f]">
                Quy chuẩn kiểm duyệt
              </span>
              <h2 className="mt-2 text-3xl font-bold text-[#203c37]">
                Tin đăng được duyệt trước khi công khai
              </h2>
              <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[#203c37]/80">
                Đội ngũ kiểm duyệt rà soát nội dung, hình ảnh, giá và thông tin
                liên hệ. Tin có dấu hiệu sai lệch có thể bị yêu cầu chỉnh sửa,
                từ chối hoặc gỡ bỏ. Người đăng sẽ nhận thông báo kèm lý do trong
                ứng dụng.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link href="/tenant/safety/report" className="inline-flex items-center gap-2 rounded-[8px] bg-[#15594f] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#124b42]">
                Báo cáo vi phạm
              </Link>
              <Link href="/terms" className="inline-flex items-center gap-2 rounded-[8px] border border-[#15594f]/30 bg-white px-4 py-2.5 text-[13px] font-semibold text-[#15594f] hover:border-[#15594f]">
                Điều khoản sử dụng
              </Link>
            </div>
          </div>
        </div>
      </section>



    </div>
  );
}

