import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText, Scale } from "lucide-react";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng",
  description:
    "Điều khoản sử dụng của 5K-Rental Manager: quyền và nghĩa vụ của người thuê, chủ trọ, người tìm bạn ở ghép và quy định xử lý vi phạm.",
};

const sections = [
  {
    title: "1. Chấp nhận điều khoản",
    body: [
      "Khi đăng ký tài khoản, đăng tin, gửi yêu cầu thuê hoặc sử dụng bất kỳ tính năng nào của 5K-Rental Manager, bạn đồng ý bị ràng buộc bởi Điều khoản sử dụng này và Chính sách bảo mật đi kèm.",
      "Nếu bạn không đồng ý với bất kỳ nội dung nào, vui lòng ngừng sử dụng dịch vụ.",
    ],
  },
  {
    title: "2. Định nghĩa",
    body: [
      "Nền tảng là website, ứng dụng và các công cụ do 5K-Rental Manager vận hành. Người dùng là cá nhân hoặc tổ chức có tài khoản trên nền tảng, bao gồm người thuê, chủ trọ, nhân viên được ủy quyền và người tìm bạn ở ghép.",
      "Tin đăng là nội dung do người dùng tạo để giới thiệu phòng, nhu cầu thuê hoặc nhu cầu tìm bạn ở ghép. Giao dịch thuê là thỏa thuận giữa người thuê và chủ trọ, không phải giao dịch mua bán do nền tảng trực tiếp thực hiện.",
    ],
  },
  {
    title: "3. Tài khoản và bảo mật",
    body: [
      "Bạn phải cung cấp thông tin chính xác, duy trì tính cập nhật và chịu trách nhiệm với mọi hoạt động phát sinh từ tài khoản của mình. Không được tạo tài khoản giả, mạo danh người khác hoặc cho người khác sử dụng tài khoản để thực hiện hành vi trái pháp luật.",
      "Hãy bảo vệ mật khẩu, mã xác thực và thiết bị đăng nhập. Nếu phát hiện truy cập trái phép, bạn cần đổi mật khẩu và thông báo ngay cho bộ phận hỗ trợ.",
    ],
  },
  {
    title: "4. Đăng tin và trách nhiệm nội dung",
    body: [
      "Người đăng tin phải có quyền hợp pháp đối với phòng hoặc bất động sản được giới thiệu, mô tả đúng hiện trạng, giá thuê, tiện ích, điều kiện sinh hoạt và các khoản phí. Hình ảnh phải do người đăng sở hữu hoặc có quyền sử dụng.",
      "Nghiêm cấm đăng nội dung sai sự thật, phân biệt đối xử, quấy rối, xâm phạm quyền riêng tư, quảng cáo trái phép, lừa đảo hoặc yêu cầu chuyển tiền bất thường trước khi có thỏa thuận rõ ràng.",
    ],
  },
  {
    title: "5. Giao dịch thuê và đặt cọc",
    body: [
      "Người thuê và chủ trọ tự thương lượng, kiểm tra phòng, xác minh giấy tờ và ký hợp đồng thuê theo quy định pháp luật. Nền tảng hỗ trợ lưu trữ thông tin và quy trình, nhưng không thay thế nghĩa vụ kiểm tra của các bên.",
      "Các khoản đặt cọc chỉ nên được chuyển khi hai bên đã thống nhất bằng văn bản về số tiền, điều kiện hoàn trả và thời điểm giao nhận phòng. Người dùng cần lưu lại biên nhận, hợp đồng và bằng chứng chuyển khoản.",
    ],
  },
  {
    title: "6. Tính năng tìm bạn ở ghép",
    body: [
      "Hồ sơ ở ghép và kết quả gợi ý chỉ mang tính tham khảo, dựa trên thông tin do người dùng tự khai báo và một số tiêu chí đối chiếu. Nền tảng không cam kết tìm được người phù hợp hoàn hảo và không chịu trách nhiệm thay cho quyết định kết nối của bạn.",
      "Khi sử dụng tính năng ở ghép, bạn không được gửi nội dung quấy rối, đe dọa, xúc phạm, mạo danh hoặc yêu cầu tài chính bất chính. Hãy trao đổi công khai về thói quen sinh hoạt, chi phí và trách nhiệm chung trước khi chuyển đến ở cùng.",
    ],
  },
  {
    title: "7. Phí dịch vụ",
    body: [
      "Một số dịch vụ dành cho chủ trọ có thể được cung cấp theo gói trả phí hoặc tỷ lệ hoa hồng được công bố trước. Người dùng có trách nhiệm đọc kỹ bảng giá tại thời điểm sử dụng và chỉ thanh toán qua kênh chính thức của nền tảng.",
      "Nền tảng có thể điều chỉnh phí, nhưng thay đổi sẽ được thông báo trước khi áp dụng cho các gói dịch vụ mới hoặc kỳ gia hạn tiếp theo.",
    ],
  },
  {
    title: "8. Hành vi bị nghiêm cấm",
    body: [
      "Thu thập thông tin người dùng khác khi chưa có sự đồng ý; gửi tin nhắn rác; dùng công cụ tự động để đăng tin hoặc tạo tài khoản hàng loạt; tấn công, dò quét hoặc làm gián đoạn hệ thống; sao chép mã nguồn, dữ liệu hoặc giao diện trái phép.",
      "Đăng tải nội dung vi phạm pháp luật, xâm hại trẻ em, kích động bạo lực, lừa đảo hoặc xúc phạm danh dự, nhân phẩm của người khác.",
    ],
  },
  {
    title: "9. Quyền sở hữu trí tuệ",
    body: [
      "Thương hiệu, giao diện, mã nguồn và tài liệu của nền tảng thuộc quyền sở hữu của 5K-Rental Manager hoặc bên cấp phép. Bạn không được sử dụng cho mục đích thương mại nếu chưa có sự đồng ý bằng văn bản.",
      "Bạn giữ quyền đối với nội dung mình đăng tải, đồng thời cấp cho nền tảng quyền cần thiết để lưu trữ, hiển thị, kiểm duyệt và phân phối nội dung nhằm vận hành dịch vụ.",
    ],
  },
  {
    title: "10. Kiểm duyệt và xử lý vi phạm",
    body: [
      "Chúng tôi có quyền từ chối, ẩn, chỉnh sửa hoặc gỡ bỏ nội dung vi phạm; tạm khóa tính năng hoặc khóa tài khoản; yêu cầu xác minh bổ sung; và phối hợp với cơ quan có thẩm quyền khi cần thiết.",
      "Các biện pháp được áp dụng theo tính chất, mức độ và lịch sử vi phạm. Người dùng có thể gửi yêu cầu hỗ trợ nếu cho rằng quyết định kiểm duyệt chưa thỏa đáng.",
    ],
  },
  {
    title: "11. Giới hạn trách nhiệm",
    body: [
      "Nền tảng được cung cấp trên cơ sở nỗ lực hợp lý. Chúng tôi không bảo đảm dịch vụ luôn liên tục, không có lỗi hoặc mọi thông tin do người dùng cung cấp đều chính xác tuyệt đối.",
      "Trong phạm vi pháp luật cho phép, nền tảng không chịu trách nhiệm cho thiệt hại gián tiếp phát sinh từ việc người dùng tự thương lượng, chuyển tiền hoặc ký kết ngoài nền tảng mà không có bằng chứng đối soát.",
    ],
  },
  {
    title: "12. Giải quyết tranh chấp",
    body: [
      "Các bên ưu tiên đối thoại và cung cấp bằng chứng cho bộ phận hỗ trợ để cùng làm rõ vấn đề. Nếu không đạt được thỏa thuận, tranh chấp sẽ được giải quyết theo pháp luật Việt Nam tại cơ quan có thẩm quyền.",
    ],
  },
  {
    title: "13. Thay đổi điều khoản",
    body: [
      "Chúng tôi có thể cập nhật Điều khoản sử dụng để phù hợp với thay đổi của dịch vụ hoặc pháp luật. Phiên bản mới được công bố trên trang này; việc tiếp tục sử dụng sau ngày cập nhật được hiểu là bạn chấp nhận nội dung mới.",
    ],
  },
  {
    title: "14. Liên hệ",
    body: [
      "Nếu có câu hỏi về Điều khoản sử dụng, vui lòng liên hệ hotro@5krental.vn hoặc mở yêu cầu hỗ trợ trong ứng dụng.",
    ],
  },
];

export default function TermsPage() {
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
              <FileText className="size-6" />
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[#15594f]">Trung tâm pháp lý</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Điều khoản sử dụng</h1>
              <p className="mt-2 text-[14px] text-[#74817b]">Cập nhật lần cuối: 13/11/2026</p>
            </div>
          </div>
          <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-[#74817b]">
            Điều khoản này quy định quyền và nghĩa vụ của người dùng khi tham gia
            nền tảng, bao gồm đăng tin, giao dịch thuê và sử dụng tính năng tìm
            bạn ở ghép.
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-12 lg:grid-cols-[240px_1fr] lg:px-10">
        <nav className="h-fit rounded-[12px] border border-[#e2e7e1] bg-white p-4 lg:sticky lg:top-24">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#74817b]">Mục lục</p>
          <ol className="mt-3 space-y-2 text-[13px] text-[#74817b]">
            {sections.map((section, index) => (
              <li key={section.title}>
                <a href={`#terms-${index + 1}`} className="hover:text-[#15594f]">
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
              id={`terms-${index + 1}`}
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
              <Scale className="mt-0.5 size-5 shrink-0 text-[#15594f]" />
              <div>
                <p className="text-[14px] font-semibold text-[#203c37]">Cần hỗ trợ về quyền và nghĩa vụ?</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#203c37]/80">
                  Gửi yêu cầu đến{" "}
                  <a href="mailto:hotro@5krental.vn" className="font-semibold text-[#15594f] underline">
                    hotro@5krental.vn
                  </a>{" "}
                  để được hướng dẫn thêm.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/privacy" className="text-[13px] font-semibold text-[#15594f] hover:underline">
              Đọc Chính sách bảo mật
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

