'use strict';

/**
 * CHỐT AN TOÀN TARGET cho mọi script DDL.
 *
 * Vì sao cần: các script chỉ đọc `DB_URL` từ `server/.env`. Một `.env` bị trỏ
 * nhầm (staging/production/DB của người khác) sẽ được chấp nhận âm thầm, và
 * `NODE_ENV` không đặt thì guard `NODE_ENV=production` không có tác dụng.
 *
 * Quy tắc:
 *  - Từ chối khi `NODE_ENV=production`.
 *  - Chỉ chấp nhận host nằm trong allowlist. Mặc định là Supabase DEV đã xác
 *    nhận ở docs/BATCH-2 §7/§11.3.
 *  - Có thể mở rộng allowlist tường minh bằng `DB_HOST_ALLOWLIST` (phẩy phân
 *    cách) — KHÔNG có biến "tắt kiểm tra" để tránh vô hiệu hoá guard do nhầm.
 */

/** Host Supabase DEV đã xác nhận. */
const DEFAULT_ALLOWED_HOSTS = ['aws-0-ap-northeast-1.pooler.supabase.com'];

const parseUrl = (rawUrl) => {
  try {
    const parsed = new URL(rawUrl);
    return {
      host: parsed.hostname,
      database: parsed.pathname.replace(/^\//, '') || 'unknown',
      port: parsed.port || '5432',
    };
  } catch {
    return { host: 'unknown', database: 'unknown', port: 'unknown' };
  }
};

const allowedHosts = () => {
  const extra = String(process.env.DB_HOST_ALLOWLIST || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_HOSTS, ...extra])];
};

/**
 * @param {string|undefined} rawUrl
 * @returns {{ host: string, database: string, port: string, allowed: boolean, allowlist: string[] }}
 */
const inspectTarget = (rawUrl) => {
  const target = parseUrl(rawUrl);
  const allowlist = allowedHosts();
  return { ...target, allowed: allowlist.includes(target.host), allowlist };
};

/**
 * Ném lỗi nếu target không an toàn. Trả về thông tin target để script in ra.
 * @param {string|undefined} rawUrl
 */
const assertDeploymentTarget = (rawUrl) => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NODE_ENV=production — từ chối chạy DDL trên production.');
  }

  const target = inspectTarget(rawUrl);
  if (!target.allowed) {
    throw new Error(
      `Host "${target.host}" không nằm trong allowlist (${target.allowlist.join(', ')}). ` +
        'Kiểm tra DB_URL trong server/.env hoặc thêm host DEV vào DB_HOST_ALLOWLIST.',
    );
  }

  return target;
};

module.exports = {
  DEFAULT_ALLOWED_HOSTS,
  parseUrl,
  inspectTarget,
  assertDeploymentTarget,
};
