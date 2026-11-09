"use client";

import * as React from "react";
import administrativeData from "@/data/vietnam-administrative-hierarchy.json";

export interface AddressValue {
  address: string;
  province: string;
  district: string;
  ward: string;
}

interface AddressFieldsProps {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  required?: boolean;
  showMap?: boolean;
}

export function AddressFields({ value, onChange, required = false, showMap = true }: AddressFieldsProps) {
  const province = administrativeData.data.find((item) => item.name.local === value.province);
  const query = [value.address, value.ward, value.district, value.province].filter(Boolean).join(", ");
  const mapKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
  const update = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4 sm:col-span-2">
      <label className="space-y-1.5 block">
        <span className="text-[13px] font-semibold text-[#203c37]">Địa chỉ chi tiết {required ? "*" : ""}</span>
        <input required={required} minLength={5} maxLength={300} value={value.address}
          onChange={(event) => update({ address: event.target.value })}
          placeholder="Số nhà, tên đường" className="w-full min-h-[46px] rounded-[8px] border border-[#e2e7e1] bg-white px-3.5 py-2.5 text-[14px] text-[#203c37] outline-none focus:border-[#15594f]" />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-[13px] font-semibold text-[#203c37]">Tỉnh / thành phố {required ? "*" : ""}</span>
          <select required={required} value={value.province} onChange={(event) => update({ province: event.target.value, ward: "" })}
            className="w-full min-h-[46px] rounded-[8px] border border-[#e2e7e1] bg-white px-3.5 text-[14px] outline-none focus:border-[#15594f]">
            <option value="">Chọn tỉnh/thành phố</option>
            {administrativeData.data.map((item) => <option key={item.id} value={item.name.local}>{item.name.local}</option>)}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-[13px] font-semibold text-[#203c37]">Quận / huyện cũ</span>
          <input value={value.district} onChange={(event) => update({ district: event.target.value })}
            placeholder="Dùng cho dữ liệu cũ nếu có" className="w-full min-h-[46px] rounded-[8px] border border-[#e2e7e1] bg-white px-3.5 text-[14px] outline-none focus:border-[#15594f]" />
        </label>
        <label className="space-y-1.5">
          <span className="text-[13px] font-semibold text-[#203c37]">Phường / xã / đặc khu {required ? "*" : ""}</span>
          <select required={required} disabled={!province} value={value.ward} onChange={(event) => update({ ward: event.target.value })}
            className="w-full min-h-[46px] rounded-[8px] border border-[#e2e7e1] bg-white px-3.5 text-[14px] outline-none focus:border-[#15594f] disabled:bg-[#f4f6f3]">
            <option value="">Chọn đơn vị cấp xã</option>
            {province?.ward.map((item) => <option key={item.id} value={item.name.local}>{item.name.local}</option>)}
          </select>
        </label>
      </div>
      {showMap && query && (
        <div className="overflow-hidden rounded-[8px] border border-[#e2e7e1]">
          {mapKey ? (
            <iframe title="Vị trí địa chỉ" className="h-52 w-full border-0" loading="lazy"
              src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(mapKey)}&q=${encodeURIComponent(query)}`} />
          ) : (
            <a className="block bg-[#f7f6f2] p-3 text-sm text-[#15594f] hover:underline"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`} target="_blank" rel="noreferrer">
              Mở địa chỉ này trên Google Maps
            </a>
          )}
        </div>
      )}
    </div>
  );
}
