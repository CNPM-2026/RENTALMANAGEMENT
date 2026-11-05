import Link from "next/link";

export default function AboutPage() {
  return <main className="min-h-screen bg-[#f7f6f2] px-6 py-16 text-[#203c37]">
    <div className="mx-auto max-w-4xl space-y-8">
      <div><p className="text-sm text-[#74817b]">5K-Rental Manager</p><h1 className="mt-2 text-4xl font-bold">Thuê trọ minh bạch và an tâm</h1><p className="mt-4 max-w-2xl text-lg text-[#74817b]">Nền tảng kết nối người thuê với chủ trọ, hỗ trợ tìm phòng, đặt lịch, quản lý hợp đồng, hóa đơn và yêu cầu hỗ trợ trên cùng một hệ thống.</p></div>
      <div className="grid gap-4 md:grid-cols-3">{["Dữ liệu rõ ràng", "Quy trình trực tuyến", "Hỗ trợ xuyên suốt"].map((title) => <section key={title} className="rounded-xl border border-[#e2e7e1] bg-white p-5"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-[#74817b]">Thông tin được lấy từ tài khoản và nghiệp vụ thực tế của bạn.</p></section>)}</div>
      <Link href="/rooms" className="inline-flex rounded-lg bg-[#15594f] px-4 py-2.5 text-sm font-semibold text-white">Tìm phòng ngay</Link>
    </div>
  </main>;
}
