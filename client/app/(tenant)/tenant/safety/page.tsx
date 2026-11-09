"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Lock,
  PhoneCall,
  FileCheck2,
  Users,
  Flag,
  ArrowRight,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { Report } from "@/types/models";

function ReportStatusBadge({ status }: { status: string }) {
  if (status === "RESOLVED") {
    return (
      <Badge variant="success" size="sm">
        Đã xử lý
      </Badge>
    );
  }
  return (
    <Badge variant="warning" size="sm">
      Đang xử lý
    </Badge>
  );
}

function MyReportsList() {
  const [reports, setReports] = React.useState<Report[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    apiClient.reports
      .getMy()
      .then((data) => {
        if (!cancelled) setReports(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể tải danh sách báo cáo."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setRefreshKey((prev) => prev + 1);
  };

  const targetTypeLabel = (type: string) => {
    if (type === "POST") return "Bài đăng";
    if (type === "USER") return "Người dùng";
    if (type === "ROOM") return "Phòng trọ";
    return type;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-[#74817b] text-[13px]">
        <RefreshCw className="size-4 animate-spin" />
        Đang tải danh sách báo cáo...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-[10px] bg-red-50 border border-red-200 flex items-center gap-3 text-[13px] text-red-700">
        <AlertTriangle className="size-4 shrink-0" />
        <span>{error}</span>
        <button
          onClick={handleRetry}
          className="ml-auto text-red-600 underline font-medium hover:text-red-800"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="py-8 text-center text-[#74817b] text-[13px]">
        <Flag className="size-8 mx-auto mb-2 opacity-30" />
        <p>Bạn chưa gửi báo cáo vi phạm nào.</p>
        <Link
          href="/tenant/safety/report"
          className="mt-2 inline-block text-[#15594f] font-semibold hover:underline text-[13px]"
        >
          Gửi báo cáo đầu tiên →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => {
        const isExpanded = expandedId === report.id;
        // Parse violation category and description from reason string
        // Format: "[CATEGORY] description (URL: ...) (Liên hệ xác minh: ...)"
        const reasonMatch = report.reason.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
        const category = reasonMatch?.[1] ?? "";
        const description = reasonMatch?.[2] ?? report.reason;

        return (
          <div
            key={report.id}
            className="bg-white rounded-[12px] border border-[#e2e7e1] shadow-sm overflow-hidden"
          >
            {/* Header row */}
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : report.id)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#f7f6f2]/50 transition-colors cursor-pointer"
            >
              <div
                className={`size-9 rounded-[8px] flex items-center justify-center shrink-0 ${
                  report.status === "RESOLVED"
                    ? "bg-[#eaf2ed]"
                    : "bg-amber-50"
                }`}
              >
                {report.status === "RESOLVED" ? (
                  <CheckCircle2 className="size-4.5 text-[#15594f]" />
                ) : (
                  <Clock className="size-4.5 text-amber-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-[#203c37] truncate">
                    {targetTypeLabel(report.targetType)}: {report.targetId.slice(0, 8)}...
                  </span>
                  <ReportStatusBadge status={report.status} />
                </div>
                <p className="text-[11px] text-[#74817b] mt-0.5">
                  Gửi lúc{" "}
                  {new Date(report.createdAt).toLocaleDateString("vi-VN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {isExpanded ? (
                <ChevronUp className="size-4 text-[#74817b] shrink-0" />
              ) : (
                <ChevronDown className="size-4 text-[#74817b] shrink-0" />
              )}
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-[#e2e7e1] pt-3">
                {category && (
                  <div>
                    <p className="text-[11px] font-semibold text-[#74817b] uppercase tracking-wide mb-1">
                      Loại vi phạm
                    </p>
                    <span className="text-[12px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full inline-block">
                      {category.replace(/_/g, " ")}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-[11px] font-semibold text-[#74817b] uppercase tracking-wide mb-1">
                    Nội dung báo cáo
                  </p>
                  <p className="text-[13px] text-[#203c37] leading-relaxed whitespace-pre-wrap break-words">
                    {description}
                  </p>
                </div>

                {/* Admin resolution panel */}
                <div
                  className={`rounded-[10px] p-3 border ${
                    report.status === "RESOLVED"
                      ? "bg-[#eaf2ed] border-[#d2e4d7]"
                      : "bg-[#f7f6f2] border-[#e2e7e1]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <ShieldCheck
                      className={`size-4 shrink-0 ${
                        report.status === "RESOLVED"
                          ? "text-[#15594f]"
                          : "text-[#74817b]"
                      }`}
                    />
                    <p
                      className={`text-[12px] font-semibold ${
                        report.status === "RESOLVED"
                          ? "text-[#15594f]"
                          : "text-[#74817b]"
                      }`}
                    >
                      Phương án xử lý của Admin
                    </p>
                  </div>
                  {report.status === "RESOLVED" ? (
                    <p className="text-[12px] text-[#203c37] leading-relaxed">
                      Báo cáo của bạn đã được xem xét và xử lý. Nội dung vi phạm đã được xử lý theo quy định của nền tảng. Cảm ơn bạn đã góp phần bảo vệ cộng đồng.
                    </p>
                  ) : (
                    <p className="text-[12px] text-[#74817b] leading-relaxed">
                      Báo cáo đang được đội ngũ kiểm duyệt xem xét. Chúng tôi sẽ xử lý trong vòng 2 giờ làm việc và thông báo kết quả qua hệ thống thông báo.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TenantSafetyCenterPage() {
  const safetyPillars = [
    {
      icon: <FileCheck2 className="size-6 text-[#15594f]" />,
      title: "Xác thực danh tính chủ trọ",
      description:
        "Mọi tin đăng trên 5K-Rental Manager đều phải qua kiểm duyệt giấy chứng nhận quyền sở hữu nhà hoặc hợp đồng ủy quyền quản lý kèm CCCD gắn chip.",
    },
    {
      icon: <Lock className="size-6 text-[#15594f]" />,
      title: "Bảo vệ tiền đặt cọc trung gian",
      description:
        "Tiền cọc của bạn được giữ an toàn trong tài khoản đảm bảo và chỉ chuyển cho chủ trọ sau khi bạn nhận phòng thực tế đúng như cam kết.",
    },
    {
      icon: <Users className="size-6 text-[#15594f]" />,
      title: "Bộ quy tắc ở ghép minh bạch",
      description:
        "Khảo sát thói quen sinh hoạt và đối soát chéo số điện thoại đảm bảo bạn luôn tìm được người bạn cùng phòng văn minh, đáng tin cậy.",
    },
    {
      icon: <ShieldAlert className="size-6 text-[#15594f]" />,
      title: "Tiếp nhận vi phạm & Danh sách cảnh báo",
      description:
        "Báo cáo được tiếp nhận để kiểm tra theo mức độ nghiêm trọng. Tài khoản có hành vi gian lận có thể bị hạn chế hoặc khóa.",
    },
  ];

  const scamTips = [
    {
      tag: "Cảnh báo 1",
      title: "Yêu cầu chuyển tiền cọc giữ chỗ trước khi xem phòng",
      content:
        "Tuyệt đối không chuyển khoản bất kỳ khoản phí nào (phí xem phòng, phí giữ chỗ) khi chưa đến tận nơi và gặp trực tiếp chủ nhà hoặc người được ủy quyền hợp pháp.",
    },
    {
      tag: "Cảnh báo 2",
      title: "Giá thuê rẻ bất thường so với khu vực",
      content:
        "Các tin đăng chung cư mini tiện nghi đầy đủ tại các quận trung tâm nhưng giá chỉ 1 - 2 triệu thường là bẫy câu kéo khách hoặc lừa tiền cọc qua mạng xã hội.",
    },
    {
      tag: "Cảnh báo 3",
      title: "Chủ trọ từ chối ký hợp đồng chuẩn",
      content:
        "Mọi thỏa thuận thuê phòng phải được lập thành văn bản hoặc hợp đồng điện tử có đầy đủ chữ ký của hai bên theo mẫu chuẩn của 5K-Rental Manager.",
    },
    {
      tag: "Cảnh báo 4",
      title: "Yêu cầu giao dịch ngoài nền tảng",
      content:
        "Cẩn trọng khi đối phương yêu cầu chuyển hướng sang trò chuyện qua các kênh mạng xã hội ẩn danh hoặc chuyển tiền vào số tài khoản không trùng tên chủ nhà.",
    },
  ];

  return (
    <div className="space-y-8 max-w-[1204px]">
      {/* 1. Header Banner with Quick Report CTA */}
      <div className="bg-gradient-to-r from-[#15594f] to-[#203c37] rounded-[16px] p-8 text-white space-y-4 shadow-md">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#eaf2ed] text-[12px] font-semibold">
          <ShieldCheck className="size-4 text-emerald-300" />
          Hệ thống bảo vệ người thuê 5K-Rental Manager
        </div>
        <h1 className="text-[28px] md:text-[34px] font-bold tracking-tight">
          Trung tâm An toàn & Phòng tránh Lừa đảo
        </h1>
        <p className="text-[15px] text-[#e3ece6] max-w-2xl leading-relaxed">
          Chúng tôi xây dựng môi trường thuê trọ và ở ghép an toàn, minh bạch. Hãy trang bị những kiến thức thiết yếu để tự bảo vệ quyền lợi của bản thân.
        </p>
        <div className="pt-2 flex flex-wrap gap-4">
          <Link href="/tenant/safety/report">
            <Button
              variant="secondary"
              size="md"
              className="bg-white text-[#15594f] hover:bg-[#eaf2ed]"
              leftIcon={<Flag className="size-4" />}
            >
              Báo cáo vi phạm ngay
            </Button>
          </Link>
          <a href="tel:19005858">
            <Button
              variant="outline"
              size="md"
              className="border-white/30 text-white hover:bg-white/10"
              leftIcon={<PhoneCall className="size-4" />}
            >
              Hotline khẩn cấp: 1900 5858
            </Button>
          </a>
        </div>
      </div>

      {/* 2. Four Safety Pillars */}
      <div>
        <h2 className="text-[20px] font-bold text-[#203c37] tracking-tight mb-4">
          4 Trụ cột bảo vệ quyền lợi người thuê tại 5K-Rental Manager
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {safetyPillars.map((pillar, idx) => (
            <Card key={idx} className="border border-[#e2e7e1] bg-white rounded-[12px] p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-[10px] bg-[#eaf2ed] flex items-center justify-center shrink-0">
                  {pillar.icon}
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-[16px] font-bold text-[#203c37]">{pillar.title}</h3>
                  <p className="text-[13px] text-[#74817b] leading-relaxed">{pillar.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* 3. Scam Warnings and Prevention Tips */}
      <div>
        <h2 className="text-[20px] font-bold text-[#203c37] tracking-tight mb-4">
          Nhận diện 4 thủ đoạn lừa đảo thuê phòng trọ phổ biến
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {scamTips.map((tip, idx) => (
            <Card key={idx} className="border border-[#e2e7e1] bg-white rounded-[12px] p-6 shadow-sm space-y-2">
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full inline-block">
                {tip.tag}
              </span>
              <h3 className="text-[16px] font-bold text-[#203c37]">{tip.title}</h3>
              <p className="text-[13px] text-[#74817b] leading-relaxed">{tip.content}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* 4. My Submitted Reports */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[20px] font-bold text-[#203c37] tracking-tight">
              Báo cáo vi phạm đã gửi
            </h2>
            <p className="text-[13px] text-[#74817b] mt-0.5">
              Theo dõi trạng thái xử lý các báo cáo bạn đã gửi đến đội ngũ kiểm duyệt.
            </p>
          </div>
          <Link href="/tenant/safety/report" className="shrink-0">
            <Button variant="outline" size="sm" leftIcon={<Flag className="size-3.5" />}>
              Gửi báo cáo mới
            </Button>
          </Link>
        </div>
        <MyReportsList />
      </div>

      {/* 5. Investigation Commitment Banner */}
      <div className="bg-[#f2ede3] border border-[#e2e7e1] rounded-[16px] p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <h3 className="text-[18px] font-bold text-[#203c37]">Phát hiện đối tượng nghi vấn hoặc bài đăng lừa đảo?</h3>
          <p className="text-[13px] text-[#74817b] max-w-xl">
            Báo cáo của bạn sẽ được tiếp nhận để đối soát, xác minh và xử lý theo quy định của nền tảng.
          </p>
        </div>
        <Link href="/tenant/safety/report" className="shrink-0">
          <Button variant="primary" size="md" rightIcon={<ArrowRight className="size-4" />}>
            Gửi báo cáo điều tra
          </Button>
        </Link>
      </div>
    </div>
  );
}
