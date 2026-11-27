"use client";

import * as React from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { useParams } from "next/navigation";
import {
  Download,
  Printer,
  FileCheck,
  ShieldCheck,
  AlertTriangle,
  Info,
  Users,
  ExternalLink,
  Phone,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { Contract } from "@/types/models";
import { ContractLifecyclePanel } from "@/components/contracts/contract-lifecycle-panel";
import { getCurrentUser } from "@/lib/auth";
import { Avatar } from "@/components/ui/avatar";

function TenantContractDetailContent() {
  const params = useParams();
  const contractId = params?.id as string;
  const [contract, setContract] = React.useState<Contract | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [currentUser, setCurrentUser] = React.useState<ReturnType<typeof getCurrentUser>>(null);

  const [isSigned, setIsSigned] = React.useState<boolean>(false);
  const [signing, setSigning] = React.useState<boolean>(false);
  const [signatureTimestamp, setSignatureTimestamp] = React.useState<string | null>(null);
  const landlord = contract?.room?.property?.landlord;
  const tenant = contract?.tenant;
  const property = contract?.room?.property;
  const room = contract?.room;
  const landlordName = landlord?.fullName ?? "Chủ trọ";
  const tenantName = tenant?.fullName ?? "Khách thuê";
  const contractTimestamp = contract?.createdAt
    ? new Date(contract.createdAt).toLocaleString("vi-VN")
    : "Chưa cập nhật";

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCurrentUser(getCurrentUser());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const isPrimaryTenant = Boolean(contract && currentUser && contract.tenantId === currentUser.id);
  const isRoommate = Boolean(contract && currentUser && contract.tenantId !== currentUser.id);
  const isAdminObserver = Boolean(currentUser?.role === "ADMIN" && contract && contract.tenantId !== currentUser.id);
  const isTerminated = Boolean(
    contract &&
      (contract.status === "TERMINATED" ||
        (contract.status as string) === "CANCELLED" ||
        contract.status === "EXPIRED" ||
        contract.status === "SUSPENDED" ||
        contract.terminationRequests?.some(
          (r) => r.status === "PENDING" || r.status === "APPROVED"
        ))
  );
  const cannotSign = isTerminated || isAdminObserver;

  React.useEffect(() => {
    apiClient.contracts.getMyContracts("tenant")
      .then((items) => {
        const found = items.find((item) => item.id === contractId);
        if (!found) throw new Error("Không tìm thấy hợp đồng.");
        setContract(found);
        setIsSigned(found.status === "ACTIVE");
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Không tải được hợp đồng."));
  }, [contractId]);

  // Sau khi gửi / phản hồi yêu cầu vòng đời, tải lại để header và trạng thái hợp
  // đồng phản ánh dữ liệu server (ví dụ hợp đồng đã TERMINATED hoặc đã ký tiếp).
  const reloadContract = React.useCallback(() => {
    void apiClient.contracts
      .getMyContracts("tenant")
      .then((items) => {
        const found = items.find((item) => item.id === contractId);
        if (!found) return;
        setContract(found);
        setIsSigned(found.status === "ACTIVE");
        setLoadError(null);
      })
      .catch((error) =>
        setLoadError(error instanceof Error ? error.message : "Không tải được hợp đồng."),
      );
  }, [contractId]);

  function handleSignContract() {
    if (!contract) return;
    setSigning(true);
    apiClient.contracts.updateStatus(contract.id, { status: "ACTIVE" })
      .then((updated) => {
        setContract(updated);
        setIsSigned(true);
        setSignatureTimestamp(new Date().toLocaleString("vi-VN"));
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Không thể ký hợp đồng."))
      .finally(() => setSigning(false));
  }

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  return (
    <div className="space-y-6">
      {loadError && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</p>}
      {isAdminObserver && (
        <div className="p-3.5 rounded-[12px] bg-amber-50 border border-amber-200 flex items-center gap-2.5 text-[13px] text-amber-900 font-medium shadow-xs">
          <ShieldCheck className="size-5 text-amber-600 shrink-0" />
          <span>
            <strong>Chế độ Quản trị viên (Chỉ xem):</strong> Bạn đang xem hợp đồng của người dùng với quyền Quản trị viên. Toàn bộ thao tác ký số, chỉnh sửa hoặc gửi yêu cầu đều bị vô hiệu hóa.
          </span>
        </div>
      )}
      {/* =======================================================================
          1. HEADER & ACTION TOOLBAR (Figma Node 44:65135)
      ======================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-[12px] text-[#74817b]">
            <Link href="/" className="hover:text-[#15594f]">
              Trang chủ
            </Link>
            <span>/</span>
            <Link href="/tenant/rental-requests" className="hover:text-[#15594f]">
              Hợp đồng
            </Link>
            <span>/</span>
            <span className="text-[#203c37] font-medium">{contract?.id ?? contractId}</span>
          </nav>
          <div className="flex items-center gap-3 pt-0.5">
            <h1 className="text-2xl font-bold text-[#203c37] tracking-tight">
              Hợp đồng thuê phòng điện tử
            </h1>
            {contract?.status === "SUSPENDED" ? (
              <Badge variant="error" size="md">
                TẠM ĐÌNH CHỈ (CHỜ KHÁNG CÁO)
              </Badge>
            ) : isSigned ? (
              <Badge variant="success" size="md">
                ĐANG CÓ HIỆU LỰC
              </Badge>
            ) : (
              <Badge variant="warning" size="md">
                CHỜ KHÁCH THUÊ KÝ SỐ
              </Badge>
            )}
          </div>
          {contract?.status === "SUSPENDED" && (
            <div className="mt-2 p-3.5 rounded-[10px] bg-red-50 border border-red-200 text-red-900 space-y-1">
              <div className="flex items-center gap-2 font-bold text-[13px]">
                <AlertTriangle className="size-4 text-red-600" />
                <span>Hợp đồng đang tạm đình chỉ (Người thuê bị khóa tài khoản & chờ kháng cáo)</span>
              </div>
              <p className="text-[12px] text-red-700">
                {contract.suspendedReason || "Tài khoản của người thuê chính đã bị khóa. Toàn bộ thao tác và bổ sung người ở ghép bị ngưng lại cho đến khi kháng cáo thành công hoặc thanh lý hợp đồng."}
              </p>
            </div>
          )}
          <p className="text-[13px] text-[#74817b]">
            Văn bản pháp lý điện tử có giá trị ràng buộc quyền và nghĩa vụ hai bên theo quy định pháp luật
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 text-[13px] text-[#203c37] sm:grid-cols-3">
            <div className="rounded-[8px] border border-[#d2e4d7] bg-[#eaf2ed] px-3 py-2">
              <span className="block text-[11px] text-[#74817b]">Nhà trọ / cơ sở</span>
              <strong>{property?.name ?? "Chưa cập nhật"}</strong>
            </div>
            <div className="rounded-[8px] border border-[#d2e4d7] bg-[#eaf2ed] px-3 py-2 flex items-center justify-between">
              <div>
                <span className="block text-[11px] text-[#74817b]">Số phòng</span>
                <strong>Phòng {room?.roomNumber ?? "Chưa cập nhật"}</strong>
              </div>
              {(room?.id ?? contract?.roomId) && (
                <Link
                  href={`/rooms/${room?.id ?? contract?.roomId}`}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#15594f] hover:underline"
                  target="_blank"
                >
                  Xem phòng <ExternalLink className="size-3" />
                </Link>
              )}
            </div>
            <div className="rounded-[8px] border border-[#d2e4d7] bg-[#eaf2ed] px-3 py-2 sm:col-span-1">
              <span className="block text-[11px] text-[#74817b]">Địa chỉ</span>
              <strong className="truncate block" title={property?.address}>{property?.address ?? "Chưa cập nhật"}</strong>
            </div>
          </div>
        </div>

        {/* Print / Download PDF Toolbar */}
        <div className="flex items-center gap-2.5 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            leftIcon={<Printer className="size-4 text-[#15594f]" />}
            className="font-medium bg-white"
          >
            In hợp đồng
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            leftIcon={<Download className="size-4 text-[#15594f]" />}
            className="font-medium bg-white"
          >
            Tải bản PDF
          </Button>
        </div>
      </div>

      {isRoommate && (
        <div className="rounded-[12px] border border-[#a2c8b8] bg-[#f0f8f4] p-4 flex items-start gap-3 shadow-xs">
          <Info className="size-5 text-[#15594f] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-[14px] font-bold text-[#15594f]">
              Bạn đang xem hợp đồng với tư cách Bạn ở ghép
            </h4>
            <p className="text-[13px] text-[#203c37] leading-relaxed">
              Hợp đồng này được xác lập giữa Bên thuê chính (người đầu tiên thuê phòng): <strong>{tenantName}</strong> và Chủ nhà: <strong>{landlordName}</strong>. Bạn đã được liên kết thông tin phòng trọ, danh sách thành viên cư trú, hợp đồng và hoá đơn liên quan.
            </p>
          </div>
        </div>
      )}

      {contract && (
        <ContractLifecyclePanel
          contract={contract}
          role="TENANT"
          currentUserId={contract.tenantId}
          onChanged={reloadContract}
        />
      )}

      {/* =======================================================================
          2. TWO-COLUMN CONTRACT VIEWER (Figma Node 44:65148)
      ======================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* -------------------------------------------------------------------
            LEFT COLUMN: TABLE OF CONTENTS & CONTRACT METADATA (250px)
        -------------------------------------------------------------------- */}
        <aside className="lg:col-span-4 xl:col-span-3 space-y-5 print:hidden">
          {/* Table of Contents */}
          <div className="bg-white p-5 rounded-[14px] border border-[#e2e7e1] shadow-xs space-y-3">
            <h3 className="text-[14px] font-bold text-[#203c37] border-b border-[#e2e7e1] pb-2">
              Mục lục văn bản
            </h3>
            <nav className="space-y-1.5 text-[12px] text-[#74817b]">
              <a href="#parties" className="block hover:text-[#15594f] py-1">
                1. Thông tin các bên ký kết
              </a>
              <a href="#article1" className="block hover:text-[#15594f] py-1">
                2. Điều 1: Đối tượng thuê
              </a>
              <a href="#article2" className="block hover:text-[#15594f] py-1">
                3. Điều 2: Thời hạn & Tiền thuê
              </a>
              <a href="#article3" className="block hover:text-[#15594f] py-1">
                4. Điều 3: Tiền đặt cọc giữ phòng
              </a>
              <a href="#article4" className="block hover:text-[#15594f] py-1">
                5. Điều 4: Quyền & Nghĩa vụ Bên A
              </a>
              <a href="#article5" className="block hover:text-[#15594f] py-1">
                6. Điều 5: Quyền & Nghĩa vụ Bên B
              </a>
              <a href="#article6" className="block hover:text-[#15594f] py-1">
                7. Điều 6: Điều khoản chung
              </a>
              <a href="#signatures" className="block hover:text-[#15594f] py-1 font-semibold text-[#15594f]">
                8. Chữ ký số các bên ↗
              </a>
            </nav>
          </div>

          {/* Metadata Card */}
          <div className="bg-white p-5 rounded-[14px] border border-[#e2e7e1] shadow-xs space-y-3 text-[12px]">
            <h3 className="text-[13px] font-bold text-[#203c37] border-b border-[#e2e7e1] pb-2">
              Thông tin tóm tắt
            </h3>
            <div className="divide-y divide-[#e2e7e1] space-y-2">
              <div className="pt-2 flex justify-between">
                <span className="text-[#74817b]">Mã hợp đồng:</span>
                <span className="font-bold text-[#203c37]">{contract?.id ?? contractId}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-[#74817b]">Ngày bắt đầu:</span>
                <span className="font-semibold text-[#203c37]">{contract ? new Date(contract.startDate).toLocaleDateString("vi-VN") : "—"}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-[#74817b]">Ngày kết thúc:</span>
                <span className="font-semibold text-[#203c37]">{contract?.endDate ? new Date(contract.endDate).toLocaleDateString("vi-VN") : "—"}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-[#74817b]">Tiền thuê phòng:</span>
                <span className="font-bold text-[#15594f]">{contract ? `${formatCurrency(contract.monthlyRent, { showUnit: false })} đ/tháng` : "—"}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-[#74817b]">Tiền đặt cọc:</span>
                <span className="font-bold text-[#203c37]">{contract ? `${formatCurrency(contract.depositPaid, { showUnit: false })} đ` : "—"}</span>
              </div>
            </div>

            {!isSigned && isPrimaryTenant && (
              <Button
                variant={cannotSign ? "outline" : "primary"}
                size="md"
                disabled={cannotSign}
                onClick={cannotSign ? undefined : handleSignContract}
                loading={signing}
                className={`w-full font-bold shadow-md mt-3 ${
                  cannotSign
                    ? "opacity-60 cursor-not-allowed bg-gray-100 text-gray-500 border-gray-300 pointer-events-none"
                    : ""
                }`}
                leftIcon={<FileCheck className="size-4" />}
              >
                {isTerminated
                  ? "Hợp đồng đã chấm dứt (Không thể ký)"
                  : isAdminObserver
                    ? "Chế độ Quản trị viên (Chỉ xem)"
                    : "Ký số hợp đồng ngay"}
              </Button>
            )}

            {isRoommate && (
              <div className="p-3 rounded-[8px] bg-[#f7f6f2] border border-[#e2e7e1] text-[12px] text-[#74817b] text-center mt-3">
                Hợp đồng đứng tên người thuê chính: <strong className="text-[#203c37]">{tenantName}</strong>
              </div>
            )}
          </div>

          {/* Legal Compliance Badge */}
          <div className="p-3.5 rounded-[12px] bg-[#f2ede3]/70 border border-[#e2e7e1] flex items-start gap-2.5 text-[12px] text-[#203c37]">
            <ShieldCheck className="size-4.5 text-[#15594f] shrink-0 mt-0.5" />
            <span>
              <strong>Chứng thư số pháp lý:</strong> Bản điện tử được chứng thực bởi 5K-Rental Manager và tuân thủ Luật Giao dịch điện tử số 20/2023/QH15.
            </span>
          </div>
        </aside>

        {/* -------------------------------------------------------------------
            RIGHT COLUMN: FORMAL LEGAL DOCUMENT SHEET (858px) (Figma Node 44:65178)
        -------------------------------------------------------------------- */}
        <main className="lg:col-span-8 xl:col-span-9 bg-white p-8 sm:p-12 rounded-[16px] border border-[#e2e7e1] shadow-lg space-y-8 font-serif leading-relaxed text-[#203c37]">
          {/* Document Legal Header */}
          <div className="text-center space-y-1">
            <p className="text-[13px] font-bold uppercase tracking-widest text-[#203c37]">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </p>
            <p className="text-[12px] font-bold text-[#74817b]">
              Độc lập — Tự do — Hạnh phúc
            </p>
            <div className="w-24 h-0.5 bg-[#203c37] mx-auto mt-2" />
          </div>

          <div className="text-center space-y-1 pt-4">
            <h2 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-[#15594f]">
              HỢP ĐỒNG THUÊ PHÒNG TRỌ & CĂN HỘ
            </h2>
            <p className="text-[12px] text-[#74817b] italic font-sans">
              Số: {contract?.id ?? "—"} • Lập ngày {contract ? new Date(contract.createdAt).toLocaleDateString("vi-VN") : "—"}
            </p>
          </div>

          {/* Parties Information */}
          <section id="parties" className="space-y-4 pt-4 border-t border-[#e2e7e1] font-sans text-[13px]">
            <div className="space-y-1.5 p-4 rounded-[10px] bg-[#f7f6f2] border border-[#e2e7e1]">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#15594f] text-[14px]">
                  BÊN A (BÊN CHO THUÊ - CHỦ TRỌ):
                </h3>
                <span className="text-[11px] font-semibold text-[#15594f] bg-[#eaf2ed] px-2 py-0.5 rounded">
                  Chủ trọ / Đại diện
                </span>
              </div>
              <p>Họ và tên: <strong>{landlord?.fullName ?? "Chưa cập nhật"}</strong></p>
              <p>Số điện thoại liên hệ: <strong>{landlord?.phone ?? "Chưa cập nhật"}</strong></p>
              {landlord?.email && <p>Email: <strong>{landlord.email}</strong></p>}
              <p>Địa chỉ: {property?.address ?? "Chưa cập nhật"}</p>
            </div>

            <div className="space-y-1.5 p-4 rounded-[10px] bg-[#f7f6f2] border border-[#e2e7e1]">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#15594f] text-[14px]">
                  BÊN B (BÊN THUÊ CHÍNH - NGƯỜI ĐỨNG TÊN HỢP ĐỒNG):
                </h3>
                <span className="text-[11px] font-semibold text-[#15594f] bg-[#eaf2ed] px-2 py-0.5 rounded">
                  Người thuê đầu tiên
                </span>
              </div>
              <p>Họ và tên: <strong>{tenant?.fullName ?? "Chưa cập nhật"}</strong></p>
              <p>Số điện thoại liên hệ: <strong>{tenant?.phone ?? "Chưa cập nhật"}</strong></p>
              {tenant?.email && <p>Email: <strong>{tenant.email}</strong></p>}
              <p>Vai trò trong phòng: <strong>Người thuê chính (Chủ hợp đồng)</strong></p>
            </div>
          </section>

          {/* Co-tenants / Roommates Section */}
          <section id="co-tenants" className="space-y-3 pt-4 border-t border-[#e2e7e1] font-sans">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[15px] text-[#15594f] flex items-center gap-2">
                <Users className="size-4 text-[#15594f]" /> DANH SÁCH THÀNH VIÊN Ở CÙNG PHÒNG ({contract?.coTenants?.length ?? 1})
              </h3>
              {(room?.id ?? contract?.roomId) && (
                <Link
                  href={`/rooms/${room?.id ?? contract?.roomId}`}
                  className="text-[12px] font-semibold text-[#15594f] hover:underline inline-flex items-center gap-1"
                >
                  Xem thông tin phòng &rarr;
                </Link>
              )}
            </div>
            <p className="text-[12px] text-[#74817b]">
              Các thành viên hiện đang cùng cư trú hợp pháp tại Phòng {room?.roomNumber ?? "—"} theo hợp đồng và khai báo cư trú:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {(contract?.coTenants && contract.coTenants.length > 0) ? (
                contract.coTenants.map((member) => (
                  <div
                    key={member.id}
                    className={`p-3.5 rounded-[10px] border flex items-start gap-3 transition-colors ${
                      member.isPrimary
                        ? "bg-[#f4f8f5] border-[#b8dbc6]"
                        : "bg-white border-[#e2e7e1] hover:border-[#15594f]/40"
                    }`}
                  >
                    <div className="size-11 rounded-full overflow-hidden bg-[#eaf2ed] shrink-0 border border-[#d2e4d7]">
                      <Avatar src={member.avatarUrl ?? "/images/default-avatar.svg"} alt={member.fullName} className="size-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[14px] text-[#203c37] truncate">{member.fullName}</span>
                        {member.isPrimary ? (
                          <Badge variant="success" size="sm">Người thuê chính</Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">Bạn ở ghép</Badge>
                        )}
                      </div>
                      <div className="text-[12px] text-[#74817b] space-y-0.5">
                        <p className="flex items-center gap-1.5 truncate">
                          <Phone className="size-3 text-[#15594f] shrink-0" />
                          <span>{member.phone || "Chưa có SĐT"}</span>
                        </p>
                        {member.email && (
                          <p className="flex items-center gap-1.5 truncate">
                            <Mail className="size-3 text-[#15594f] shrink-0" />
                            <span>{member.email}</span>
                          </p>
                        )}
                        {member.joinedAt && (
                          <p className="text-[11px] text-[#74817b]">
                            Vào ở từ: {new Date(member.joinedAt).toLocaleDateString("vi-VN")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-[10px] border border-[#e2e7e1] bg-[#f7f6f2] col-span-2 text-center text-[13px] text-[#74817b]">
                  Chưa có bạn ở ghép nào được thêm vào phòng này.
                </div>
              )}
            </div>
          </section>

          {/* Terms Articles */}
          <div className="space-y-6 font-sans text-[13.5px] leading-relaxed text-[#203c37]">
            {/* Article 1 */}
            <section id="article1" className="space-y-2">
              <h3 className="font-bold text-[15px] text-[#15594f]">
                ĐIỀU 1: ĐỐI TƯỢNG VÀ MỤC ĐÍCH THUÊ
              </h3>
              <p>
                1.1. Bên A đồng ý cho Bên B thuê căn phòng số <strong>{room?.roomNumber ?? contract?.roomId ?? "Chưa cập nhật"}</strong> thuộc cơ sở <strong>{property?.name ?? "Chưa cập nhật"}</strong> tại địa chỉ: <strong>{property?.address ?? "Chưa cập nhật"}</strong>.
              </p>
              <p>
                1.2. Diện tích sử dụng riêng: <strong>{room?.area ?? "Chưa cập nhật"} m²</strong>. Hiện trạng bàn giao theo biên bản bàn giao thực tế.
              </p>
              <p>
                1.3. Mục đích thuê: Dùng làm nơi ở sinh hoạt văn minh, hợp pháp. Số lượng người ở tối đa là 02 người.
              </p>
            </section>

            {/* Article 2 */}
            <section id="article2" className="space-y-2">
              <h3 className="font-bold text-[15px] text-[#15594f]">
                ĐIỀU 2: THỜI HẠN THUÊ VÀ GIÁ THUÊ
              </h3>
              <p>
                2.1. Thời hạn thuê bắt đầu từ ngày <strong>{contract ? new Date(contract.startDate).toLocaleDateString("vi-VN") : "—"}</strong> đến hết ngày <strong>{contract?.endDate ? new Date(contract.endDate).toLocaleDateString("vi-VN") : "—"}</strong>.
              </p>
              <p>
                2.2. Giá thuê phòng theo hợp đồng: <strong>{contract ? formatCurrency(contract.monthlyRent, { showUnit: false }) : "—"} VNĐ / tháng</strong>.
              </p>
              <p>
                2.3. Chi phí dịch vụ sinh hoạt:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Tiền điện: <strong>3.500 VNĐ / kWh</strong> (tính theo chỉ số công tơ riêng của phòng).</li>
                <li>Tiền nước: <strong>15.000 VNĐ / m³</strong> (tính theo chỉ số đồng hồ nước riêng).</li>
                <li>Phí dịch vụ chung (Thang máy, rác, vệ sinh hành lang, chiếu sáng): <strong>120.000 VNĐ / phòng / tháng</strong>.</li>
                <li>Internet Wifi cáp quang tốc độ cao: <strong>100.000 VNĐ / phòng / tháng</strong>.</li>
              </ul>
              <p>
                2.4. Phương thức thanh toán: Thanh toán định kỳ hàng tháng từ ngày 01 đến ngày 05 qua mã QR VietQR hoặc chuyển khoản ngân hàng trên ứng dụng 5K-Rental Manager.
              </p>
            </section>

            {/* Article 3 */}
            <section id="article3" className="space-y-2">
              <h3 className="font-bold text-[15px] text-[#15594f]">
                ĐIỀU 3: TIỀN ĐẶT CỌC GIỮ PHÒNG VÀ HOÀN CỌC
              </h3>
              <p>
                3.1. Bên B đặt cọc cho Bên A số tiền: <strong>{contract ? formatCurrency(contract.depositPaid, { showUnit: false }) : "—"} VNĐ</strong> để bảo đảm thực hiện đúng các điều khoản hợp đồng.
              </p>
              <p>
                3.2. Tiền đặt cọc được giữ an toàn trên hệ thống đối soát của 5K-Rental Manager. Khi hợp đồng kết thúc đúng hạn, Bên A có trách nhiệm hoàn trả 100% tiền cọc cho Bên B sau khi trừ các khoản chi phí điện, nước hoặc hư hại tài sản (nếu có do lỗi của Bên B).
              </p>
            </section>

            {/* Article 4 */}
            <section id="article4" className="space-y-2">
              <h3 className="font-bold text-[15px] text-[#15594f]">
                ĐIỀU 4: QUYỀN VÀ TRÁCH NHIỆM CỦA BÊN CHO THUÊ (BÊN A)
              </h3>
              <p>
                4.1. Bàn giao phòng và trang thiết bị theo hiện trạng cam kết vào ngày {contract ? new Date(contract.startDate).toLocaleDateString("vi-VN") : "—"}.
              </p>
              <p>
                4.2. Bảo đảm quyền sử dụng riêng tư, an toàn cho Bên B. Chịu trách nhiệm bảo trì, sửa chữa các hư hỏng kết cấu lớn và hệ thống cấp thoát nước, nguồn điện chung của tòa nhà.
              </p>
            </section>

            {/* Article 5 */}
            <section id="article5" className="space-y-2">
              <h3 className="font-bold text-[15px] text-[#15594f]">
                ĐIỀU 5: QUYỀN VÀ TRÁCH NHIỆM CỦA BÊN THUÊ (BÊN B)
              </h3>
              <p>
                5.1. Sử dụng phòng đúng mục đích cư trú văn minh; tuân thủ nghiêm ngặt các quy định về Phòng cháy chữa cháy (PCCC) và an ninh trật tự khu phố.
              </p>
              <p>
                5.2. Giữ gìn vệ sinh chung, không gây ồn ào sau 23h00 đêm; không tự ý thay đổi kết cấu xây dựng của căn phòng khi chưa có sự đồng ý bằng văn bản của Bên A.
              </p>
            </section>

            {/* Article 6 */}
            <section id="article6" className="space-y-2">
              <h3 className="font-bold text-[15px] text-[#15594f]">
                ĐIỀU 6: ĐIỀU KHOẢN CHUNG & HIỆU LỰC
              </h3>
              <p>
                6.1. Hợp đồng điện tử này có giá trị pháp lý ràng buộc kể từ thời điểm cả hai bên hoàn tất việc ký số xác thực.
              </p>
              <p>
                6.2. Mọi tranh chấp phát sinh trong quá trình thực hiện hợp đồng sẽ được ưu tiên hòa giải qua Trung tâm hỗ trợ 5K-Rental Manager. Nếu không hòa giải được, vụ việc sẽ được đưa ra Tòa án nhân dân có thẩm quyền tại TP. Hồ Chí Minh để giải quyết.
              </p>
            </section>
          </div>

          {/* ===================================================================
              DIGITAL SIGNATURES BLOCK (Figma Node 44:65210)
          ==================================================================== */}
          <section id="signatures" className="pt-8 border-t-2 border-[#e2e7e1] font-sans">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-center">
              {/* Landlord Signature */}
              <div className="space-y-3 p-4 rounded-[12px] bg-[#f7f6f2] border border-[#e2e7e1]">
                <p className="text-[13px] font-bold text-[#74817b] uppercase">
                  ĐẠI DIỆN BÊN CHO THUÊ (BÊN A)
                </p>
                <div className="h-16 flex items-center justify-center">
                  <div className="p-2 rounded-[8px] bg-white border border-[#15594f]/30 inline-block text-left shadow-xs">
                    <p className="text-[12px] font-bold text-[#15594f]">
                      ✓ ĐÃ KÝ SỐ ĐIỆN TỬ
                    </p>
                    <p className="text-[10px] text-[#74817b]">
                      Chủ trọ: {landlordName}
                    </p>
                    <p className="text-[9px] text-[#74817b]">
                      Thời gian: {contractTimestamp}
                    </p>
                  </div>
                </div>
                <p className="text-[14px] font-bold text-[#203c37]">
                  {landlordName}
                </p>
              </div>

              {/* Tenant Signature */}
              <div className="space-y-3 p-4 rounded-[12px] bg-[#f7f6f2] border border-[#e2e7e1]">
                <p className="text-[13px] font-bold text-[#74817b] uppercase">
                  ĐẠI DIỆN BÊN THUÊ (BÊN B)
                </p>
                <div className="h-16 flex items-center justify-center">
                  {isSigned ? (
                    <div className="p-2 rounded-[8px] bg-[#eaf2ed] border border-[#15594f] inline-block text-left shadow-xs animate-in zoom-in-95 duration-200">
                      <p className="text-[12px] font-bold text-[#15594f]">
                        ✓ ĐÃ KÝ SỐ ĐIỆN TỬ
                      </p>
                      <p className="text-[10px] text-[#74817b]">
                        Khách thuê: {tenantName}
                      </p>
                      <p className="text-[9px] text-[#74817b]">
                        Thời gian: {signatureTimestamp ?? contractTimestamp}
                      </p>
                    </div>
                  ) : (
                    <Button
                      variant={cannotSign ? "outline" : "primary"}
                      size="sm"
                      disabled={cannotSign}
                      onClick={cannotSign ? undefined : handleSignContract}
                      loading={signing}
                      className={`font-bold shadow-xs ${
                        cannotSign
                          ? "opacity-60 cursor-not-allowed bg-gray-100 text-gray-500 border-gray-300 pointer-events-none"
                          : ""
                      }`}
                      leftIcon={<FileCheck className="size-4" />}
                    >
                      {isTerminated
                        ? "Hợp đồng đã chấm dứt"
                        : isAdminObserver
                          ? "Chế độ chỉ xem"
                          : "Bấm để ký số điện tử"}
                    </Button>
                  )}
                </div>
                <p className="text-[14px] font-bold text-[#203c37]">
                  {tenantName}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-center text-[#74817b] italic pt-6">
              Văn bản được tạo và lưu trữ bảo mật trên hệ thống 5K-Rental Manager (Mã hợp đồng: {contract?.id ?? contractId})
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}

export default function TenantContractDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-8 text-center text-[#74817b]">
          Đang tải thông tin hợp đồng...
        </div>
      }
    >
      <TenantContractDetailContent />
    </React.Suspense>
  );
}
