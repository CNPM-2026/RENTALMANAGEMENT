import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Chính sách bảo mật",
  description:
    "Chính sách bảo mật của 5K-Rental Manager: dữ liệu được thu thập, mục đích sử dụng, chia sẻ, lưu trữ và quyền của người dùng.",
};

const sections = [
  {
    title: "1. Phạm vi áp dụng",
    body: [
      "Chính sách này áp dụng khi bạn truy cập hoặc sử dụng website, ứng dụng và các dịch vụ của 5K-Rental Manager, bao gồm tìm phòng, đăng tin cho thuê, quản lý hợp đồng, hóa đơn, báo sự cố và tìm bạn ở ghép.",
      "Bằng việc tiếp tục sử dụng dịch vụ, bạn xác nhận đã đọc và hiểu cách chúng tôi xử lý dữ liệu cá nhân được mô tả dưới đây.",
    ],
  },
  {
    title: "2. Dữ liệu chúng tôi thu thập",
    body: [
      "Thông tin tài khoản: họ tên, email, số điện thoại, ảnh đại diện, vai trò người dùng và trạng thái xác thực.",
      "Thông tin hồ sơ và nhu cầu thuê: giới tính, nghề nghiệp, ngân sách, khu vực mong muốn, ngày dự kiến dọn vào và các tiêu chí tìm bạn ở ghép.",
      "Dữ liệu vận hành: tin đăng, phòng, hợp đồng, hóa đơn, lịch hẹn, yêu cầu hỗ trợ, báo cáo sự cố và lịch sử giao dịch trong nền tảng.",
      "Dữ liệu kỹ thuật: địa chỉ IP, loại thiết bị, trình duyệt, nhật ký truy cập và mã định danh phiên đăng nhập nhằm bảo vệ tài khoản.",
      "Dữ liệu do bạn chủ động gửi: nội dung tin nhắn, hình ảnh, tài liệu xác minh và bằng chứng khi báo cáo vi phạm.",
    ],
  },
  {
    title: "3. Mục đích sử dụng dữ liệu",
    body: [
      "Vận hành tài khoản, xác thực danh tính và bảo vệ tài khoản khỏi truy cập trái phép.",
      "Hiển thị tin đăng, kết nối người thuê với chủ trọ và gợi ý bạn ở ghép phù hợp dựa trên thói quen sinh hoạt.",
      "Xử lý đặt lịch, hợp đồng, hóa đơn, thanh toán, yêu cầu hỗ trợ và tranh chấp phát sinh.",
      "Kiểm duyệt nội dung, phát hiện gian lận, lạm dụng và bảo đảm an toàn cho cộng đồng.",
      "Gửi thông báo vận hành, cập nhật chính sách hoặc thông tin liên quan đến giao dịch của bạn.",
      "Phân tích và cải thiện chất lượng dịch vụ trên cơ sở dữ liệu đã được tổng hợp hoặc ẩn danh hóa khi phù hợp.",
    ],
  },
  {
    title: "4. Cơ sở pháp lý và sự đồng ý",
    body: [
      "Chúng tôi xử lý dữ liệu khi cần thiết để thực hiện hợp đồng hoặc cung cấp dịch vụ bạn yêu cầu, khi có sự đồng ý của bạn, khi phải tuân thủ nghĩa vụ pháp lý hoặc khi có lợi ích hợp pháp chính đáng trong việc bảo vệ nền tảng và người dùng.",
      "Bạn có thể rút lại sự đồng ý đối với các hoạt động dựa trên sự đồng ý, nhưng việc rút lại có thể khiến một số tính năng không thể tiếp tục cung cấp.",
    ],
  },
  {
    title: "5. Chia sẻ dữ liệu",
    body: [
      "Chúng tôi không bán dữ liệu cá nhân. Dữ liệu có thể được chia sẻ ở mức cần thiết với chủ trọ hoặc người thuê trong cùng giao dịch, nhà cung cấp hạ tầng, dịch vụ email, lưu trữ hình ảnh và cơ quan nhà nước có thẩm quyền khi có yêu cầu hợp pháp.",
      "Thông tin bạn chủ động công khai trong hồ sơ ở ghép, tin đăng hoặc nội dung trò chuyện có thể được người dùng khác nhìn thấy. Bạn nên cân nhắc trước khi chia sẻ số điện thoại, địa chỉ chính xác hoặc giấy tờ cá nhân.",
    ],
  },
  {
    title: "6. Thời gian lưu trữ",
    body: [
      "Dữ liệu được lưu trong thời gian cần thiết để cung cấp dịch vụ, giải quyết tranh chấp, phòng chống gian lận và tuân thủ nghĩa vụ pháp lý. Khi hết thời hạn, dữ liệu sẽ được xóa, ẩn danh hóa hoặc lưu trữ theo quy định.",
      "Một số bản ghi như hóa đơn, hợp đồng hoặc nhật ký kiểm duyệt có thể được giữ lâu hơn để phục vụ đối soát và nghĩa vụ chứng minh.",
    ],
  },
  {
    title: "7. Bảo mật dữ liệu",
    body: [
      "Chúng tôi áp dụng các biện pháp kỹ thuật và tổ chức phù hợp như mã hóa đường truyền, phân quyền truy cập, ghi nhật ký thao tác và kiểm soát phiên đăng nhập. Tuy nhiên, không hệ thống nào an toàn tuyệt đối; bạn cần bảo vệ mật khẩu, không chia sẻ mã xác thực và đăng xuất khỏi thiết bị dùng chung.",
    ],
  },
  {
    title: "8. Quyền của bạn",
    body: [
      "Bạn có quyền yêu cầu truy cập, chỉnh sửa, xóa hoặc hạn chế xử lý dữ liệu cá nhân; phản đối một số hoạt động xử lý; rút lại sự đồng ý; và yêu cầu giải thích về cách dữ liệu được sử dụng.",
      "Yêu cầu có thể được gửi đến hotro@5krental.vn. Chúng tôi có thể cần xác minh danh tính trước khi thực hiện để tránh tiết lộ dữ liệu cho người không có quyền.",
    ],
  },
  {
    title: "9. Cookie và công nghệ tương tự",
    body: [
      "Nền tảng có thể sử dụng cookie hoặc lưu trữ cục bộ để duy trì phiên đăng nhập, ghi nhớ tùy chọn và cải thiện trải nghiệm. Bạn có thể kiểm soát cookie trong trình duyệt, nhưng việc tắt một số cookie có thể ảnh hưởng đến chức năng đăng nhập và bảo mật.",
    ],
  },
  {
    title: "10. Trẻ em và người chưa thành niên",
    body: [
      "Dịch vụ không hướng đến trẻ em. Người chưa đủ tuổi theo quy định pháp luật cần có sự đồng ý và giám sát của cha mẹ hoặc người giám hộ khi sử dụng các tính năng liên quan đến giao dịch thuê.",
    ],
  },
  {
    title: "11. Thay đổi chính sách",
    body: [
      "Chúng tôi có thể cập nhật chính sách này để phản ánh thay đổi về dịch vụ, công nghệ hoặc yêu cầu pháp lý. Phiên bản mới sẽ được đăng trên trang này và ghi rõ ngày cập nhật. Nếu thay đổi ảnh hưởng đáng kể đến quyền của bạn, chúng tôi sẽ thông báo qua kênh phù hợp.",
    ],
  },
  {
    title: "12. Liên hệ",
    body: [
      "Mọi câu hỏi hoặc yêu cầu liên quan đến quyền riêng tư và dữ liệu cá nhân, vui lòng liên hệ hotro@5krental.vn hoặc gửi yêu cầu hỗ trợ trong ứng dụng.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="w-full bg-[#f7f6f2] text-[#203c37]">
      <div className="border-b border-[#e2e7e1] bg-white">
        <div className="mx-auto max-w-[980px] px-6 py-12 lg:px-10 lg:py-16">
          <Link href="/" className="inline-flex items-center gap-2 text-[13px] font-medium text-[#74817b] hover:text-[#15594f]">
            <ArrowLeft className="size-4" />
            Về trang chủ
          </Link>
          <div className="mt-5 flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-[12px] bg-[#eaf2ed] text-[#15594f]">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[#15594f]">Trung tâm pháp lý</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Chính sách bảo mật</h1>
              <p className="mt-2 text-[14px] text-[#74817b]">Cập nhật lần cuối: 13/11/2026</p>
            </div>
          </div>
          <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-[#74817b]">
            Chính sách này giải thích cách 5K-Rental Manager thu thập, sử dụng,
            lưu trữ và bảo vệ dữ liệu cá nhân của bạn khi sử dụng nền tảng.
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-12 lg:grid-cols-[240px_1fr] lg:px-10">
        <nav className="h-fit rounded-[12px] border border-[#e2e7e1] bg-white p-4 lg:sticky lg:top-24">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#74817b]">Mục lục</p>
          <ol className="mt-3 space-y-2 text-[13px] text-[#74817b]">
            {sections.map((section, index) => (
              <li key={section.title}>
                <a href={`#privacy-${index + 1}`} className="hover:text-[#15594f]">
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="space-y-4">
          {sections.map((section, index) => (
            <section
              key={section.title}
              id={`privacy-${index + 1}`}
              className="scroll-mt-24 rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-sm"
            >
              <h2 className="text-[18px] font-bold text-[#203c37]">{section.title}</h2>
              <div className="mt-3 space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-[14px] leading-relaxed text-[#74817b]">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}

          <div className="rounded-[12px] border border-[#d2e4d7] bg-[#eaf2ed] p-6">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 size-5 shrink-0 text-[#15594f]" />
              <div>
                <p className="text-[14px] font-semibold text-[#203c37]">Cần hỏi thêm về dữ liệu của bạn?</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#203c37]/80">
                  Gửi email đến{" "}
                  <a href="mailto:hotro@5krental.vn" className="font-semibold text-[#15594f] underline">
                    hotro@5krental.vn
                  </a>{" "}
                  hoặc mở yêu cầu hỗ trợ trong ứng dụng.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/terms" className="text-[13px] font-semibold text-[#15594f] hover:underline">
              Đọc Điều khoản sử dụng
            </Link>
            <Link href="/about" className="text-[13px] font-semibold text-[#15594f] hover:underline">
              Tìm hiểu về nền tảng
            </Link>
          </div>
        </article>

      </div>
    </div>
  );
}

