import crypto from 'crypto';
import { env } from '../config/env';

// Khóa mã hóa 32-byte lấy từ JWT_SECRET hoặc fallback
const ALGORITHM = 'aes-256-gcm';
const KEY = crypto.createHash('sha256').update(env.JWT_SECRET || 'fallback-secret-for-encryption-32-chars!').digest();

/**
 * Mã hóa AES-256-GCM bảo vệ thông tin CCCD / Địa chỉ KYC
 */
export function encryptData(plainText: string): string {
  if (!plainText) return plainText;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Giải mã dữ liệu AES-256-GCM (nếu không phải định dạng mã hóa, trả về nguyên bản)
 */
export function decryptData(cipherText: string | null | undefined): string {
  if (!cipherText) return '';
  const parts = cipherText.split(':');
  if (parts.length !== 3) return cipherText; // Chuỗi chưa mã hóa cũ
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return cipherText;
  }
}

/**
 * Băm HMAC-SHA256 phục vụ tra cứu unique chống trùng số CCCD đã duyệt
 */
export function hashIdNumber(idNumber: string): string {
  return crypto.createHmac('sha256', KEY).update(idNumber.trim()).digest('hex');
}

/**
 * Tự động viết hoa chữ cái đầu cho các thành phần địa chỉ
 * (Số, Đường, Phường, Xã, Quận, Huyện, Tỉnh, Thành Phố, Ấp, Làng...)
 */
export function formatVietnameseAddress(address: string | null | undefined): string {
  if (!address) return '';
  return address
    .trim()
    .split(',')
    .map((part) => {
      const trimmed = part.trim();
      return trimmed
        .split(/\s+/)
        .map((word) => {
          if (!word) return '';
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
    })
    .join(', ');
}
