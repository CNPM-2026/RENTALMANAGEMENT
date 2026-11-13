#!/usr/bin/env node
'use strict';

/**
 * BATCH 2.2 (M2) — chuyển ảnh hiện trạng bảo trì cũ từ Cloudinary CÔNG KHAI
 * (`type: upload`) sang RIÊNG TƯ (`type: authenticated`) và trỏ lại DB.
 *
 * Vì sao: trước Batch 2.1, `maintenance_request_images.image_url` và
 * `maintenance_task_images.image_url` lưu `secure_url` công khai. Batch 2.1 đã
 * làm ảnh MỚI riêng tư và đặt proxy có phân quyền trước mọi đường dẫn, nhưng
 * các object đã upload trước đó vẫn đọc được công khai tại Cloudinary.
 *
 * Chiến lược (copy → verify → trỏ DB → dọn bản công khai), chạy lại được:
 *   1. `uploader.explicit(..., type: 'authenticated')` đăng ký object sẵn có cho
 *      delivery riêng tư mà KHÔNG upload lại bytes. Nếu Cloudinary từ chối
 *      (asset chưa thuộc delivery type đó) thì tải bytes rồi upload lại với
 *      ĐÚNG `public_id` đó — public_id được namespace theo delivery type nên hai
 *      bản có thể cùng tồn tại trong lúc chuyển đổi.
 *   2. So SHA-256 giữa bản công khai và bản riêng tư — phải TRÙNG BYTE trước khi
 *      ghi bất cứ thứ gì vào DB.
 *   3. Chỉ sau đó mới trỏ lại `maintenance_request_images` /
 *      `maintenance_task_images` (tất cả hàng dùng chung URL đó, vì
 *      `createFromIssue` copy ref của sự cố sang ref của công việc).
 *   4. Xoá object công khai rồi xác nhận URL công khai cũ KHÔNG còn trả asset.
 *
 * Không in secret, không in URL có chữ ký. Trạng thái lưu ở `scripts/reports/`
 * (đã git-ignore) nên lần chạy lại sẽ tiếp tục đúng chỗ đã dừng.
 *
 * Cách dùng:
 *   node scripts/maintenance-evidence-migration.js inventory
 *   node scripts/maintenance-evidence-migration.js migrate --confirm [--limit=N]
 *   node scripts/maintenance-evidence-migration.js verify
 *   node scripts/maintenance-evidence-migration.js selftest
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { v2: cloudinary } = require('cloudinary');

const REPORT_DIR = path.join(__dirname, 'reports');
const STATE_FILE = path.join(REPORT_DIR, 'maintenance-evidence-migration-state.json');
const INVENTORY_FILE = path.join(REPORT_DIR, 'maintenance-evidence-inventory.json');
const RESULT_FILE = path.join(REPORT_DIR, 'maintenance-evidence-migration-result.json');

const CLOUDINARY_HOST = 'res.cloudinary.com';
const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic', 'heif', 'bmp', 'tif', 'tiff', 'svg',
]);

/** Hạn mức an toàn khi tải bytes bằng chứng (bằng với service, không nới rộng). */
const MAX_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;

const requireEnv = (names) => {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    // Chỉ in TÊN biến, không bao giờ in giá trị.
    console.error(`❌ Thiếu biến môi trường: ${missing.join(', ')}`);
    process.exit(1);
  }
};

requireEnv(['DB_URL', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']);

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/** Chỉ in host + tên DB — không bao giờ in user, mật khẩu hay chuỗi kết nối. */
const describeTarget = () => {
  let host = 'unknown';
  let database = 'unknown';
  try {
    const parsed = new URL(process.env.DB_URL);
    host = parsed.hostname;
    database = parsed.pathname.replace(/^\//, '') || 'unknown';
  } catch {
    /* DB_URL sai định dạng: Prisma sẽ báo lỗi rõ ràng hơn. */
  }
  return { host, database, cloudName: CLOUD_NAME };
};

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

/** Ghi nguyên tử: một lần chạy bị ngắt không để lại JSON hỏng. */
const writeJson = (file, value) => {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
};

const loadState = () =>
  readJson(STATE_FILE, { version: 1, startedAt: new Date().toISOString(), assets: {} });

const saveState = (state) => writeJson(STATE_FILE, { ...state, updatedAt: new Date().toISOString() });

/**
 * Phân loại một `image_url`:
 *  - `private-id`     : `public_id` của asset riêng tư (dữ liệu sau Batch 2.1)
 *  - `cloudinary-url` : URL Cloudinary công khai (dữ liệu cũ, cần migrate)
 *  - `local`          : file trong `server/uploads` (không phải Cloudinary)
 *  - `foreign-host`   : URL của host khác — không tự ý tải (chống SSRF)
 *  - `unsupported-path` / `malformed` / `empty`
 */
const parseCloudinaryRef = (value) => {
  if (!value) return { kind: 'empty' };
  if (value.startsWith('/uploads/')) return { kind: 'local' };
  if (!value.includes('://')) return { kind: 'private-id' };

  let url;
  try {
    url = new URL(value);
  } catch {
    return { kind: 'malformed' };
  }
  if (url.hostname !== CLOUDINARY_HOST) return { kind: 'foreign-host', host: url.hostname };

  const segments = url.pathname.split('/').filter(Boolean);
  const [cloud, resourceType, deliveryType] = segments;
  if (resourceType !== 'image' || (deliveryType !== 'upload' && deliveryType !== 'authenticated')) {
    return { kind: 'unsupported-path', cloud, resourceType, deliveryType };
  }

  let rest = segments.slice(3);
  const versionIndex = rest.findIndex((segment) => /^v\d+$/.test(segment));
  if (versionIndex >= 0) rest = rest.slice(versionIndex + 1);
  if (rest.length === 0) return { kind: 'malformed' };

  // Chỉ bỏ phần mở rộng khi nó là định dạng ảnh đã biết: `public_id` có thể chứa
  // dấu chấm nên không được cắt mù.
  const last = rest[rest.length - 1];
  const dot = last.lastIndexOf('.');
  if (dot > 0 && IMAGE_EXTENSIONS.has(last.slice(dot + 1).toLowerCase())) {
    rest[rest.length - 1] = last.slice(0, dot);
  }

  return { kind: 'cloudinary-url', cloud, deliveryType, publicId: rest.join('/') };
};

const fetchBytes = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) {
    throw new Error(`Kích thước asset bất thường: ${buffer.byteLength} bytes`);
  }
  return buffer;
};

const signedPrivateUrl = (publicId) =>
  cloudinary.url(publicId, {
    resource_type: 'image',
    type: 'authenticated',
    sign_url: true,
    secure: true,
  });

const isNotFound = (error) =>
  Boolean(error) &&
  (error.http_code === 404 || (error.error && error.error.http_code === 404) || error.status === 404);

const assetExists = async (publicId, type) => {
  try {
    await cloudinary.api.resource(publicId, { resource_type: 'image', type });
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
};

const prisma = new PrismaClient();

/**
 * Hai thư mục Cloudinary dành riêng cho bằng chứng bảo trì (không bao giờ chứa
 * KYC/avatar/ảnh phòng). Bất kỳ asset CÔNG KHAI nào trong đây đều phải được
 * chuyển sang `authenticated`, kể cả khi DB không còn hàng tham chiếu (orphan).
 */
const MAINTENANCE_FOLDERS = [
  'rental-management/maintenance-requests',
  'rental-management/maintenance-tasks',
];

/** Liệt kê toàn bộ asset (phân trang) của một prefix + delivery type. */
const listCloudinaryAssets = async (prefix, type) => {
  const assets = [];
  let nextCursor = null;
  do {
    const response = await cloudinary.api.resources({
      resource_type: 'image',
      type,
      prefix: `${prefix}/`,
      max_results: 100,
      ...(nextCursor ? { next_cursor: nextCursor } : {}),
    });
    for (const resource of response.resources || []) {
      assets.push({
        publicId: resource.public_id,
        format: resource.format,
        bytes: resource.bytes,
        createdAt: resource.created_at,
        secureUrl: resource.secure_url,
        type,
      });
    }
    nextCursor = response.next_cursor;
  } while (nextCursor);
  return assets;
};

/** Mọi asset trong hai thư mục bảo trì, cả công khai và riêng tư. */
const collectCloudinaryFolderAssets = async () => {
  const out = [];
  for (const folder of MAINTENANCE_FOLDERS) {
    for (const type of ['upload', 'authenticated']) {
      const assets = await listCloudinaryAssets(folder, type);
      for (const asset of assets) out.push({ ...asset, folder });
    }
  }
  return out;
};

/**
 * Kiểm chứng phạm vi: đếm asset dưới `rental-management/` theo delivery type và
 * thư mục con. Mục đích là chứng minh bộ lọc bảo trì không bỏ sót/không lan
 * sang KYC, avatar, ảnh bài đăng (những thứ KHÔNG được đụng tới).
 */
const auditRootFolders = async () => {
  const byFolder = {};
  const totals = { upload: 0, authenticated: 0 };
  for (const type of ['upload', 'authenticated']) {
    const assets = await listCloudinaryAssets('rental-management', type);
    totals[type] += assets.length;
    for (const asset of assets) {
      const folder = asset.publicId.split('/').slice(0, 2).join('/');
      byFolder[folder] = byFolder[folder] || { upload: 0, authenticated: 0 };
      byFolder[folder][type] += 1;
    }
  }
  return { totals, byFolder };
};

/** Hàng ảnh bảo trì + quan hệ nghiệp vụ (để báo cáo ai sở hữu bằng chứng). */
const loadMaintenanceImageRows = async () => {
  const issueRows = await prisma.maintenanceRequestImage.findMany({
    select: {
      id: true,
      requestId: true,
      imageUrl: true,
      request: { select: { tenantId: true, landlordId: true, status: true, triageStatus: true } },
    },
  });
  const taskRows = await prisma.maintenanceTaskImage.findMany({
    select: {
      id: true,
      taskId: true,
      imageUrl: true,
      task: { select: { landlordId: true, status: true, sourceIssueId: true } },
    },
  });
  return { issueRows, taskRows };
};

/**
 * Ảnh dùng chung với tính năng KHÁC: so `public_id` (không so URL) với các cột
 * ảnh ngoài bảo trì. Trùng nghĩa là không được migrate/xoá tự động.
 */
const loadForeignPublicIds = async () => {
  const map = new Map(); // publicId -> Set<cột nguồn>
  const add = (source, value) => {
    if (!value) return;
    const parsed = parseCloudinaryRef(value);
    const publicId =
      parsed.kind === 'cloudinary-url' ? parsed.publicId : parsed.kind === 'private-id' ? value : null;
    if (!publicId) return;
    if (!map.has(publicId)) map.set(publicId, new Set());
    map.get(publicId).add(source);
  };

  const users = await prisma.user.findMany({
    where: { avatarUrl: { not: null } },
    select: { avatarUrl: true },
  });
  for (const row of users) add('users.avatar_url', row.avatarUrl);

  const propertyImages = await prisma.propertyImage.findMany({ select: { imageUrl: true } });
  for (const row of propertyImages) add('property_images.image_url', row.imageUrl);

  const postImages = await prisma.postImage.findMany({ select: { imageUrl: true } });
  for (const row of postImages) add('post_images.image_url', row.imageUrl);

  const kycSubmissions = await prisma.kycSubmission.findMany({
    select: { frontIdUrl: true, backIdUrl: true },
  });
  for (const row of kycSubmissions) {
    add('kyc_submissions.front_id_url', row.frontIdUrl);
    add('kyc_submissions.back_id_url', row.backIdUrl);
  }

  return map;
};

const emptyKinds = () => ({
  'private-id': 0,
  'cloudinary-url': 0,
  local: 0,
  'foreign-host': 0,
  'unsupported-path': 0,
  malformed: 0,
  empty: 0,
});

/** Tập hợp asset cần xử lý + số liệu theo loại tham chiếu. */
const collectLegacyAssets = async () => {
  const { issueRows, taskRows } = await loadMaintenanceImageRows();
  const foreignIds = await loadForeignPublicIds();

  const issueKinds = emptyKinds();
  const taskKinds = emptyKinds();
  const assets = new Map();

  const collect = (row, table) => {
    const parsed = parseCloudinaryRef(row.imageUrl);
    const counter = table === 'issue' ? issueKinds : taskKinds;
    counter[parsed.kind] = (counter[parsed.kind] ?? 0) + 1;
    if (parsed.kind !== 'cloudinary-url') return;

    if (!assets.has(parsed.publicId)) {
      assets.set(parsed.publicId, {
        publicId: parsed.publicId,
        cloud: parsed.cloud,
        deliveryType: parsed.deliveryType,
        legacyUrls: new Set(),
        issueRowIds: [],
        taskRowIds: [],
      });
    }
    const asset = assets.get(parsed.publicId);
    asset.legacyUrls.add(row.imageUrl);
    if (table === 'issue') asset.issueRowIds.push(row.id);
    else asset.taskRowIds.push(row.id);
  };

  for (const row of issueRows) collect(row, 'issue');
  for (const row of taskRows) collect(row, 'task');

  // Asset CÔNG KHAI còn nằm trong thư mục bảo trì nhưng không hàng DB nào trỏ
  // tới (ví dụ: hàng đã bị xoá) vẫn là bằng chứng nhà ở đọc được công khai.
  const folderAssets = await collectCloudinaryFolderAssets();
  const orphans = [];
  for (const asset of folderAssets) {
    if (asset.type !== 'upload') continue;
    if (assets.has(asset.publicId)) continue;
    orphans.push(asset.publicId);
    assets.set(asset.publicId, {
      publicId: asset.publicId,
      cloud: CLOUD_NAME,
      deliveryType: 'upload',
      legacyUrls: new Set([asset.secureUrl]),
      issueRowIds: [],
      taskRowIds: [],
      orphan: true,
      format: asset.format,
      bytes: asset.bytes,
      folder: asset.folder,
    });
  }

  const rootAudit = await auditRootFolders();

  const annotated = [];
  for (const asset of assets.values()) {
    const [existsPublic, existsPrivate] = await Promise.all([
      assetExists(asset.publicId, 'upload'),
      assetExists(asset.publicId, 'authenticated'),
    ]);
    const sharedWith = foreignIds.has(asset.publicId) ? [...foreignIds.get(asset.publicId)] : [];
    annotated.push({
      publicId: asset.publicId,
      cloud: asset.cloud,
      cloudMatches: asset.cloud === CLOUD_NAME,
      deliveryType: asset.deliveryType,
      legacyUrlCount: asset.legacyUrls.size,
      legacyUrls: [...asset.legacyUrls],
      issueRowIds: asset.issueRowIds,
      taskRowIds: asset.taskRowIds,
      orphan: Boolean(asset.orphan),
      format: asset.format ?? null,
      bytes: asset.bytes ?? null,
      folder: asset.folder ?? null,
      existsPublic,
      existsPrivate,
      sharedWith,
      // Chỉ migrate khi: đúng cloud, asset công khai còn tồn tại, không dùng chung.
      migratable: asset.cloud === CLOUD_NAME && existsPublic && sharedWith.length === 0,
    });
  }

  return {
    issueRows: issueRows.length,
    taskRows: taskRows.length,
    issueKinds,
    taskKinds,
    cloudFolderAssets: {
      total: folderAssets.length,
      public: folderAssets.filter((asset) => asset.type === 'upload').length,
      authenticated: folderAssets.filter((asset) => asset.type === 'authenticated').length,
      orphanPublic: orphans.length,
    },
    rootAudit,
    assets: annotated,
  };
};

const assetStatus = (asset) => {
  if (asset.sharedWith.length > 0) return 'shared-skip';
  if (!asset.cloudMatches) return 'foreign-cloud-skip';
  if (!asset.existsPublic && !asset.existsPrivate) return 'asset-missing';
  if (!asset.existsPublic && asset.existsPrivate) return 'db-only-repoint';
  return 'migratable';
};

const printInventory = (inventory) => {
  console.log('📊 KIỂM KÊ ẢNH BẢO TRÌ');
  console.log(`  maintenance_request_images: ${inventory.issueRows} hàng`);
  console.log(`  maintenance_task_images   : ${inventory.taskRows} hàng`);
  const render = (label, kinds) => {
    const entries = Object.entries(kinds).filter(([, count]) => count > 0);
    console.log(`  ${label}: ${entries.length ? entries.map(([k, v]) => `${k}=${v}`).join(', ') : 'không có'}`);
  };
  render('phân loại ref (issue)', inventory.issueKinds);
  render('phân loại ref (task) ', inventory.taskKinds);
  const cloud = inventory.cloudFolderAssets;
  console.log(
    `  Cloudinary (${MAINTENANCE_FOLDERS.length} thư mục bảo trì): ${cloud.total} asset — public=${cloud.public}, authenticated=${cloud.authenticated}, public-không-tham-chiếu=${cloud.orphanPublic}`,
  );
  const audit = inventory.rootAudit;
  console.log(`  Phạm vi rental-management/: public=${audit.totals.upload}, authenticated=${audit.totals.authenticated}`);
  for (const [folder, counts] of Object.entries(audit.byFolder)) {
    console.log(`    - ${folder}: public=${counts.upload}, authenticated=${counts.authenticated}`);
  }

  const byStatus = new Map();
  for (const asset of inventory.assets) {
    const status = assetStatus(asset);
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
  }
  console.log(`  asset công khai duy nhất: ${inventory.assets.length}`);
  for (const [status, count] of byStatus) console.log(`    - ${status}: ${count}`);
  for (const asset of inventory.assets) {
    const rows = asset.issueRowIds.length + asset.taskRowIds.length;
    console.log(
      `    · ${asset.publicId} [${assetStatus(asset)}]${asset.orphan ? ' ORPHAN' : ''} rows=${rows} public=${asset.existsPublic} private=${asset.existsPrivate}`,
    );
  }
};

const commandInventory = async () => {
  const target = describeTarget();
  console.log(`🎯 DEV target: db=${target.database} host=${target.host} cloud=${target.cloudName}`);
  const inventory = await collectLegacyAssets();
  printInventory(inventory);
  writeJson(INVENTORY_FILE, {
    generatedAt: new Date().toISOString(),
    target: { database: target.database, host: target.host, cloudName: target.cloudName },
    summary: {
      issueRows: inventory.issueRows,
      taskRows: inventory.taskRows,
      issueKinds: inventory.issueKinds,
      taskKinds: inventory.taskKinds,
      cloudFolderAssets: inventory.cloudFolderAssets,
      assets: inventory.assets.length,
    },
    assets: inventory.assets.map((asset) => ({ ...asset, status: assetStatus(asset) })),
  });
  console.log(`💾 ${path.relative(process.cwd(), INVENTORY_FILE)}`);
  return inventory;
};


/** Upload bytes với ĐÚNG `public_id` nhưng ở delivery type `authenticated`. */
const uploadAuthenticatedCopy = (publicId, bytes) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: 'image',
        type: 'authenticated',
        overwrite: false,
        invalidate: true,
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary không trả về kết quả upload'));
        resolve(result);
      },
    );
    stream.end(bytes);
  });

/**
 * Đảm bảo tồn tại bản `authenticated` TRÙNG BYTE với bản công khai.
 * Trả về các bước đã làm (để báo cáo); ném lỗi nếu không chứng minh được.
 */
const ensurePrivateCopy = async (asset, legacyBytesHash, legacyUrl) => {
  const notes = [];

  if (await assetExists(asset.publicId, 'authenticated')) {
    notes.push('authenticated-exists');
  } else {
    // (a) Đăng ký object sẵn có cho delivery riêng tư — không upload lại bytes.
    let registered = false;
    try {
      await cloudinary.uploader.explicit(asset.publicId, {
        resource_type: 'image',
        type: 'authenticated',
        overwrite: false,
        invalidate: true,
      });
      registered = await assetExists(asset.publicId, 'authenticated');
      notes.push(registered ? 'explicit-registered' : 'explicit-noop');
    } catch (error) {
      const code = error?.error?.http_code ?? error?.http_code ?? 'err';
      notes.push(`explicit-failed(${code})`);
    }

    // (b) Cloudinary không đăng ký được → copy bytes với ĐÚNG public_id.
    if (!registered) {
      const bytes = await fetchBytes(legacyUrl);
      await uploadAuthenticatedCopy(asset.publicId, bytes);
      if (!(await assetExists(asset.publicId, 'authenticated'))) {
        throw new Error('Bản riêng tư vẫn không tồn tại sau khi upload');
      }
      notes.push('copy-uploaded');
    }
  }

  const privateBytes = await fetchBytes(signedPrivateUrl(asset.publicId));
  const privateHash = sha256(privateBytes);
  if (privateHash !== legacyBytesHash) {
    throw new Error(
      `Bytes KHÔNG khớp (public=${legacyBytesHash.slice(0, 8)}… private=${privateHash.slice(0, 8)}…)`,
    );
  }
  notes.push('bytes-verified');
  return notes;
};

/** Trỏ mọi hàng đang dùng URL cũ sang `public_id` (giữ nguyên id hàng). */
const repointRows = async (asset) => {
  let issueUpdated = 0;
  let taskUpdated = 0;
  for (const legacyUrl of asset.legacyUrls) {
    const issueResult = await prisma.maintenanceRequestImage.updateMany({
      where: { imageUrl: legacyUrl },
      data: { imageUrl: asset.publicId },
    });
    const taskResult = await prisma.maintenanceTaskImage.updateMany({
      where: { imageUrl: legacyUrl },
      data: { imageUrl: asset.publicId },
    });
    issueUpdated += issueResult.count;
    taskUpdated += taskResult.count;
  }
  return { issueUpdated, taskUpdated };
};

/** Xoá bản công khai + xác nhận URL công khai cũ không còn trả asset. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cloudinary huỷ cache CDN BẤT ĐỒNG BỘ: `destroy` trả `ok` trước khi mọi POP
 * ngừng phục vụ URL công khai. Vì vậy phải HỎI LẠI nhiều lần thay vì kết luận
 * ngay từ lần probe đầu (một lần 200 không có nghĩa là asset còn tồn tại).
 */
const waitForPublicDeliveryToStop = async (url, { attempts = 4, delayMs = 5_000 } = {}) => {
  let status = null;
  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      const probe = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      status = probe.status;
      if (!probe.ok) return { cleared: true, status, elapsedMs: attempt * delayMs };
    } catch (error) {
      status = error?.status ?? 'network-error';
      if (status === 404) return { cleared: true, status, elapsedMs: attempt * delayMs };
    }
    if (attempt < attempts) await sleep(delayMs);
  }
  return { cleared: false, status, elapsedMs: attempts * delayMs };
};

const destroyPublicCopy = async (asset) => {
  const result = await cloudinary.uploader.destroy(asset.publicId, {
    resource_type: 'image',
    type: 'upload',
    invalidate: true,
  });
  const outcome = (result && result.result) || 'unknown';
  const probe = await waitForPublicDeliveryToStop(asset.legacyUrls[0]);
  return {
    outcome,
    probeStatus: probe.status,
    stillPublic: !probe.cleared,
    clearedAfterMs: probe.elapsedMs,
  };
};

/** Một asset: verify bytes → (tuỳ chọn) trỏ DB → (tuỳ chọn) xoá bản công khai. */
const migrateOne = async (asset, { dryRun }) => {
  const status = assetStatus(asset);
  if (status === 'shared-skip' || status === 'foreign-cloud-skip' || status === 'asset-missing') {
    return { publicId: asset.publicId, status, notes: [] };
  }

  const notes = [];
  let legacyHash = null;
  if (asset.existsPublic) {
    const legacyBytes = await fetchBytes(asset.legacyUrls[0]);
    legacyHash = sha256(legacyBytes);
  }

  if (legacyHash) {
    notes.push(...(await ensurePrivateCopy(asset, legacyHash, asset.legacyUrls[0])));
  } else {
    if (!(await assetExists(asset.publicId, 'authenticated'))) {
      throw new Error('Không có bản công khai, cũng không có bản riêng tư');
    }
    notes.push('private-only');
  }

  if (dryRun) {
    return { publicId: asset.publicId, status: 'would-migrate', notes, dryRun: true };
  }

  const repointed = await repointRows(asset);
  notes.push(`repointed(issue=${repointed.issueUpdated},task=${repointed.taskUpdated})`);

  let cleanup = { outcome: 'not-needed', probeStatus: null, stillPublic: false };
  if (asset.existsPublic) {
    cleanup = await destroyPublicCopy(asset);
    notes.push(`public-destroyed(${cleanup.outcome},probe=${cleanup.probeStatus})`);
  }

  return {
    publicId: asset.publicId,
    status: cleanup.stillPublic ? 'public-still-reachable' : 'done',
    notes,
    repointed,
    cleanup,
  };
};

/** Hàng nào của asset này vẫn còn giữ URL công khai cũ? */
const countLegacyRows = async (asset) => {
  const [issue, task] = await Promise.all([
    prisma.maintenanceRequestImage.count({ where: { imageUrl: { in: asset.legacyUrls } } }),
    prisma.maintenanceTaskImage.count({ where: { imageUrl: { in: asset.legacyUrls } } }),
  ]);
  return issue + task;
};

const commandMigrate = async (options) => {
  const target = describeTarget();
  console.log(`🎯 DEV target: db=${target.database} host=${target.host} cloud=${target.cloudName}`);
  if (!options.confirm) {
    console.log('⚠️  KHÔNG có --confirm → chế độ chỉ-đọc: verify bytes nhưng KHÔNG ghi DB/Cloudinary.');
  }

  const state = loadState();
  const inventory = await commandInventory();
  const actionable = inventory.assets.filter((asset) => {
    const status = assetStatus(asset);
    return status === 'migratable' || status === 'db-only-repoint';
  });
  const queue = options.limit ? actionable.slice(0, options.limit) : actionable;
  console.log(`\n🔧 XỬ LÝ ${queue.length}/${actionable.length} asset`);

  const results = [];
  for (const asset of queue) {
    const previous = state.assets[asset.publicId];
    if (options.confirm && previous && previous.status === 'done') {
      const remaining = await countLegacyRows(asset);
      if (remaining === 0) {
        results.push({ publicId: asset.publicId, status: 'already-done', notes: ['resumed-skip'] });
        console.log(`  ⏭️  ${asset.publicId}: đã xong ở lần chạy trước`);
        continue;
      }
      console.log(`  ↻ ${asset.publicId}: trạng thái cũ "done" nhưng còn ${remaining} hàng — làm lại`);
    }

    try {
      const result = await migrateOne(asset, { dryRun: !options.confirm });
      results.push(result);
      if (options.confirm) {
        state.assets[asset.publicId] = {
          status: result.status,
          notes: result.notes,
          repointed: result.repointed ?? null,
          migratedAt: new Date().toISOString(),
        };
        // Ghi NGAY sau mỗi asset → lần chạy sau tiếp tục đúng chỗ đã dừng.
        saveState(state);
      }
      console.log(`  ${result.status === 'done' ? '✅' : '⚠️ '} ${asset.publicId}: ${result.status} [${result.notes.join(', ')}]`);
    } catch (error) {
      const message = error?.message ?? String(error);
      results.push({ publicId: asset.publicId, status: 'failed', error: message });
      if (options.confirm) {
        state.assets[asset.publicId] = {
          status: 'failed',
          error: message,
          failedAt: new Date().toISOString(),
        };
        saveState(state);
      }
      console.log(`  ❌ ${asset.publicId}: ${message}`);
    }
  }

  const counts = results.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  const skipped = inventory.assets.filter((asset) => {
    const status = assetStatus(asset);
    return status !== 'migratable' && status !== 'db-only-repoint';
  });

  const summary = {
    finishedAt: new Date().toISOString(),
    dryRun: !options.confirm,
    target: { database: target.database, host: target.host, cloudName: target.cloudName },
    counts,
    processed: results.length,
    skipped: skipped.map((asset) => ({ publicId: asset.publicId, status: assetStatus(asset) })),
    results,
  };
  writeJson(RESULT_FILE, summary);

  console.log('\n📈 KẾT QUẢ');
  if (Object.keys(counts).length === 0) console.log('  không có asset nào cần xử lý');
  for (const [status, count] of Object.entries(counts)) console.log(`  ${status}: ${count}`);
  if (skipped.length > 0) {
    console.log('  bỏ qua:');
    for (const asset of skipped) console.log(`    - ${asset.publicId} → ${assetStatus(asset)}`);
  }
  console.log(`💾 ${path.relative(process.cwd(), RESULT_FILE)}`);
  return summary;
};


/** Nạp service THẬT (TypeScript) để kiểm tra proxy bằng dữ liệu thật. */
const loadEvidenceRuntime = () => {
  require('ts-node').register({
    transpileOnly: true,
    project: path.join(__dirname, '..', 'tsconfig.json'),
  });
  const service = require(path.join(__dirname, '..', 'src', 'services', 'maintenanceEvidence.service'));
  const storage = require(path.join(__dirname, '..', 'src', 'services', 'storage.service'));
  const dbModule = require(path.join(__dirname, '..', 'src', 'config', 'db'));
  return { service, storage, servicePrisma: dbModule.default ?? dbModule };
};

/** Token giả lập hết hạn: cùng thuật toán HMAC, `e` ở quá khứ. */
const mintExpiredToken = (kind, imageId, viewer) => {
  const claims = {
    k: kind,
    i: imageId,
    u: viewer.id,
    r: viewer.role,
    e: Math.floor(Date.now() / 1000) - 60,
  };
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.JWT_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

/**
 * `mintEvidenceUrl` trả ĐƯỜNG DẪN đầy đủ; `loadAuthorizedEvidence` nhận TOKEN
 * trần. Tách token ra để kiểm tra đúng thứ client thực sự gửi lên.
 */
const mintToken = (service, kind, imageId, viewer) => {
  const url = service.mintEvidenceUrl(kind, imageId, viewer);
  const marker = 'token=';
  const index = url.indexOf(marker);
  return index >= 0 ? url.slice(index + marker.length) : '';
};

const expectThrows = async (expectedCode, fn) => {
  try {
    await fn();
    return { ok: false, detail: `không ném lỗi, mong đợi ${expectedCode}` };
  } catch (error) {
    const code = error?.code ?? error?.statusCode ?? 'unknown';
    return { ok: code === expectedCode, detail: `nhận ${code}` };
  }
};

const runProxyChecks = async (issueRows, taskRows) => {
  const checks = [];
  let runtime;
  try {
    runtime = loadEvidenceRuntime();
  } catch (error) {
    return [{ name: 'proxy-runtime', ok: false, detail: `không nạp được service: ${error?.message}` }];
  }

  const { service } = runtime;
  try {
    const stranger = await prisma.user.findFirst({
      where: { role: 'TENANT' },
      select: { id: true, role: true },
      orderBy: { createdAt: 'asc' },
    });

    const issue = issueRows[0];
    if (issue) {
      const owner = { id: issue.request.tenantId, role: 'TENANT' };
      const landlord = { id: issue.request.landlordId, role: 'LANDLORD' };

      const ownerToken = mintToken(service, 'issue', issue.id, owner);
      try {
        const bytes = await service.loadAuthorizedEvidence('issue', issue.id, ownerToken);
        checks.push({
          name: 'issue-owner-tenant',
          ok: bytes.buffer.byteLength > 0 && bytes.contentType.startsWith('image/'),
          detail: `${bytes.buffer.byteLength} bytes, ${bytes.contentType}`,
        });
      } catch (error) {
        checks.push({ name: 'issue-owner-tenant', ok: false, detail: `lỗi: ${error?.code ?? error?.message}` });
      }

      const landlordToken = mintToken(service, 'issue', issue.id, landlord);
      try {
        const bytes = await service.loadAuthorizedEvidence('issue', issue.id, landlordToken);
        checks.push({ name: 'issue-owner-landlord', ok: bytes.buffer.byteLength > 0, detail: `${bytes.buffer.byteLength} bytes` });
      } catch (error) {
        checks.push({ name: 'issue-owner-landlord', ok: false, detail: `lỗi: ${error?.code ?? error?.message}` });
      }

      if (stranger && stranger.id !== owner.id && stranger.id !== landlord.id) {
        const strangerToken = mintToken(service, 'issue', issue.id, { id: stranger.id, role: 'TENANT' });
        checks.push({
          name: 'issue-stranger-forbidden',
          ...(await expectThrows('EVIDENCE_FORBIDDEN', () =>
            service.loadAuthorizedEvidence('issue', issue.id, strangerToken),
          )),
        });
      }

      const tampered = `${ownerToken.slice(0, -2)}${ownerToken.slice(-2) === 'AA' ? 'BB' : 'AA'}`;
      checks.push({
        name: 'issue-tampered-token',
        ...(await expectThrows('EVIDENCE_TOKEN_INVALID', () =>
          service.loadAuthorizedEvidence('issue', issue.id, tampered),
        )),
      });

      checks.push({
        name: 'issue-expired-token',
        ...(await expectThrows('EVIDENCE_TOKEN_INVALID', () =>
          service.loadAuthorizedEvidence('issue', issue.id, mintExpiredToken('issue', issue.id, owner)),
        )),
      });

      checks.push({
        name: 'issue-token-bound-to-id',
        ...(await expectThrows('EVIDENCE_TOKEN_INVALID', () =>
          service.loadAuthorizedEvidence('issue', `${issue.id}-khac`, ownerToken),
        )),
      });
    }

    const task = taskRows[0];
    if (task) {
      const landlordToken = mintToken(service, 'task', task.id, { id: task.task.landlordId, role: 'LANDLORD' });
      try {
        const bytes = await service.loadAuthorizedEvidence('task', task.id, landlordToken);
        checks.push({ name: 'task-owner-landlord', ok: bytes.buffer.byteLength > 0, detail: `${bytes.buffer.byteLength} bytes` });
      } catch (error) {
        checks.push({ name: 'task-owner-landlord', ok: false, detail: `lỗi: ${error?.code ?? error?.message}` });
      }

      if (stranger && stranger.id !== task.task.landlordId && stranger.id !== task.task.assignedStaffId) {
        const strangerToken = mintToken(service, 'task', task.id, { id: stranger.id, role: 'TENANT' });
        checks.push({
          name: 'task-stranger-forbidden',
          ...(await expectThrows('EVIDENCE_FORBIDDEN', () =>
            service.loadAuthorizedEvidence('task', task.id, strangerToken),
          )),
        });
      }
    }
  } finally {
    if (runtime.servicePrisma && typeof runtime.servicePrisma.$disconnect === 'function') {
      await runtime.servicePrisma.$disconnect().catch(() => undefined);
    }
  }

  return checks;
};


const classifyRows = (rows) =>
  rows.reduce((acc, row) => {
    const kind = parseCloudinaryRef(row.imageUrl).kind;
    acc[kind] = (acc[kind] ?? 0) + 1;
    return acc;
  }, {});

const preferPrivate = (rows) => {
  const priv = rows.filter((row) => parseCloudinaryRef(row.imageUrl).kind === 'private-id');
  return priv.length > 0 ? priv : rows;
};

const FIXTURE_TITLE = '[BATCH-2.2 VERIFY] evidence proxy';

/**
 * Dọn fixture của lần chạy trước. Chỉ khớp ĐÚNG tiêu đề đánh dấu nên không thể
 * chạm dữ liệu nghiệp vụ thật.
 */
const cleanupFixtures = async (storage) => {
  const stale = await prisma.maintenanceRequest.findMany({
    where: { title: FIXTURE_TITLE },
    select: { id: true, images: { select: { imageUrl: true } } },
  });
  for (const request of stale) {
    for (const image of request.images) {
      if (parseCloudinaryRef(image.imageUrl).kind === 'private-id') {
        await storage.storageService.deleteImage(image.imageUrl, 'authenticated').catch(() => undefined);
      }
    }
    await prisma.maintenanceRequest.delete({ where: { id: request.id } }).catch(() => undefined);
  }
  return stale.length;
};

/** Tải qua proxy THẬT và so byte với nguồn. */
const loadAndCompare = async (service, kind, imageId, viewer, expectedHash) => {
  try {
    const token = mintToken(service, kind, imageId, viewer);
    const result = await service.loadAuthorizedEvidence(kind, imageId, token);
    return {
      ok: sha256(result.buffer) === expectedHash && String(result.contentType).startsWith('image/'),
      detail: `${result.buffer.byteLength} bytes, ${result.contentType}`,
    };
  } catch (error) {
    return { ok: false, detail: `lỗi: ${error?.code ?? error?.message}` };
  }
};

/**
 * Dựng MỘT fixture tạm (báo cáo + ảnh riêng tư thật trên cloud DEV) để chạy ma
 * trận quyền của proxy trên dữ liệu thật, rồi tự xoá. Mục đích: chứng minh hàng
 * đã migrate (`image_url = public_id`) thật sự render được và bị chặn đúng chỗ —
 * thứ mà unit test (mock) không chứng minh được.
 */
const runFixtureChecks = async (pngBuffer) => {
  const checks = [];
  let runtime = null;
  let created = null;
  try {
    runtime = loadEvidenceRuntime();
    const { service, storage } = runtime;
    const stale = await cleanupFixtures(storage);
    if (stale > 0) checks.push({ name: 'fixture-stale-cleanup', ok: true, detail: `${stale} fixture cũ đã xoá` });

    const room = await prisma.room.findFirst({
      select: { id: true, property: { select: { landlordId: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const tenant = await prisma.user.findFirst({ where: { role: 'TENANT' }, select: { id: true } });
    const stranger = await prisma.user.findFirst({
      where: { role: 'TENANT', id: { not: tenant?.id ?? '' } },
      select: { id: true },
    });
    const staff = await prisma.user.findFirst({ where: { role: 'STAFF' }, select: { id: true } });
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
    if (!room || !tenant || !stranger || !admin) {
      return [{ name: 'fixture-preconditions', ok: false, detail: 'DEV thiếu room/tenant/admin để dựng fixture' }];
    }

    const ref = await storage.storageService.uploadPrivateImage(
      { buffer: pngBuffer, originalname: 'verify.png', mimetype: 'image/png', size: pngBuffer.length },
      'rental-management/maintenance-requests',
    );
    const request = await prisma.maintenanceRequest.create({
      data: {
        tenantId: tenant.id,
        landlordId: room.property.landlordId,
        roomId: room.id,
        title: FIXTURE_TITLE,
        description: 'Bản ghi TẠM do script Batch 2.2 tạo để kiểm tra proxy ảnh; script tự xoá khi kết thúc.',
      },
    });
    const image = await prisma.maintenanceRequestImage.create({
      data: { requestId: request.id, imageUrl: ref },
    });
    created = { requestId: request.id, imageId: image.id, ref };

    checks.push({
      name: 'fixture-ref-is-private-public-id',
      ok: parseCloudinaryRef(ref).kind === 'private-id',
      detail: 'image_url không chứa scheme',
    });

    const minted = service.mintEvidenceUrl('issue', image.id, { id: tenant.id, role: 'TENANT' });
    checks.push({
      name: 'fixture-payload-uses-proxy-not-cloudinary',
      ok:
        minted.startsWith('/api/v1/maintenance-images/issue/') &&
        minted.includes('token=') &&
        !minted.includes('res.cloudinary.com'),
      detail: 'đường dẫn + token, không có URL Cloudinary',
    });

    const expectedHash = sha256(pngBuffer);
    const allowed = [
      ['fixture-tenant-owner-allowed', { id: tenant.id, role: 'TENANT' }],
      ['fixture-landlord-owner-allowed', { id: room.property.landlordId, role: 'LANDLORD' }],
      ['fixture-admin-allowed', { id: admin.id, role: 'ADMIN' }],
    ];
    for (const [name, viewer] of allowed) {
      checks.push({ name, ...(await loadAndCompare(service, 'issue', image.id, viewer, expectedHash)) });
    }

    const forbidden = [
      ['fixture-stranger-tenant-forbidden', { id: stranger.id, role: 'TENANT' }],
      ['fixture-unrelated-staff-forbidden', { id: staff?.id ?? stranger.id, role: 'STAFF' }],
    ];
    for (const [name, viewer] of forbidden) {
      checks.push({
        name,
        ...(await expectThrows('EVIDENCE_FORBIDDEN', () =>
          service.loadAuthorizedEvidence('issue', image.id, mintToken(service, 'issue', image.id, viewer)),
        )),
      });
    }

    const ownerToken = mintToken(service, 'issue', image.id, { id: tenant.id, role: 'TENANT' });
    const tampered = `${ownerToken.slice(0, -2)}${ownerToken.slice(-2) === 'AA' ? 'BB' : 'AA'}`;
    checks.push({
      name: 'fixture-tampered-token-forbidden',
      ...(await expectThrows('EVIDENCE_TOKEN_INVALID', () =>
        service.loadAuthorizedEvidence('issue', image.id, tampered),
      )),
    });
    checks.push({
      name: 'fixture-expired-token-forbidden',
      ...(await expectThrows('EVIDENCE_TOKEN_INVALID', () =>
        service.loadAuthorizedEvidence(
          'issue',
          image.id,
          mintExpiredToken('issue', image.id, { id: tenant.id, role: 'TENANT' }),
        ),
      )),
    });
    checks.push({
      name: 'fixture-token-bound-to-image-id',
      ...(await expectThrows('EVIDENCE_TOKEN_INVALID', () =>
        service.loadAuthorizedEvidence('issue', `${image.id}-khac`, ownerToken),
      )),
    });
    const unknownId = crypto.randomUUID();
    checks.push({
      name: 'fixture-unknown-image-not-found',
      ...(await expectThrows('EVIDENCE_NOT_FOUND', () =>
        service.loadAuthorizedEvidence(
          'issue',
          unknownId,
          mintToken(service, 'issue', unknownId, { id: tenant.id, role: 'TENANT' }),
        ),
      )),
    });
  } catch (error) {
    checks.push({ name: 'fixture-runtime', ok: false, detail: error?.message ?? String(error) });
  } finally {
    if (runtime && created) {
      const { storage } = runtime;
      await prisma.maintenanceRequest.delete({ where: { id: created.requestId } }).catch(() => undefined);
      await storage.storageService.deleteImage(created.ref, 'authenticated').catch(() => undefined);
      const leftoverRows = await prisma.maintenanceRequestImage.count({ where: { requestId: created.requestId } });
      const leftoverRequest = await prisma.maintenanceRequest.count({ where: { id: created.requestId } });
      const leftoverAsset = await assetExists(created.ref, 'authenticated').catch(() => true);
      checks.push({
        name: 'fixture-cleanup',
        ok: leftoverRows === 0 && leftoverRequest === 0 && leftoverAsset === false,
        detail: `rows=${leftoverRows}, requests=${leftoverRequest}, asset=${leftoverAsset ? 'còn' : 'đã xoá'}`,
      });
    }
    if (runtime && runtime.servicePrisma && typeof runtime.servicePrisma.$disconnect === 'function') {
      await runtime.servicePrisma.$disconnect().catch(() => undefined);
    }
  }
  return checks;
};

const commandVerify = async (options = {}) => {
  const target = describeTarget();
  console.log(`🎯 DEV target: db=${target.database} host=${target.host} cloud=${target.cloudName}`);

  const issueRows = await prisma.maintenanceRequestImage.findMany({
    select: {
      id: true,
      imageUrl: true,
      request: { select: { tenantId: true, landlordId: true } },
    },
  });
  const taskRows = await prisma.maintenanceTaskImage.findMany({
    select: {
      id: true,
      imageUrl: true,
      task: { select: { id: true, landlordId: true, status: true, assignedStaffId: true } },
    },
  });

  const issueKinds = classifyRows(issueRows);
  const taskKinds = classifyRows(taskRows);
  const legacyRemaining = (issueKinds['cloudinary-url'] ?? 0) + (taskKinds['cloudinary-url'] ?? 0);

  const privateRefs = [
    ...new Set(
      [...issueRows, ...taskRows]
        .filter((row) => parseCloudinaryRef(row.imageUrl).kind === 'private-id')
        .map((row) => row.imageUrl),
    ),
  ];
  const missingAssets = [];
  for (const ref of privateRefs) {
    if (!(await assetExists(ref, 'authenticated'))) missingAssets.push(ref);
  }

  // URL công khai cũ của các asset ĐÃ migrate phải ngừng phục vụ.
  const inventory = readJson(INVENTORY_FILE, { assets: [] });
  const migrated = (inventory.assets || []).filter((asset) => asset.status === 'migratable').slice(0, 5);
  const publicProbes = [];
  for (const asset of migrated) {
    const url = (asset.legacyUrls || [])[0];
    if (!url) continue;
    let stillPublic = false;
    let status = null;
    try {
      const probe = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      status = probe.status;
      stillPublic = probe.ok;
    } catch (error) {
      status = error?.status ?? 'network-error';
    }
    publicProbes.push({ publicId: asset.publicId, status, stillPublic });
  }

  const checks = await runProxyChecks(preferPrivate(issueRows), preferPrivate(taskRows));
  if (options.withFixtures) {
    const fixtureChecks = await runFixtureChecks(buildTestPng());
    checks.push(...fixtureChecks);
  }

  const failedChecks = checks.filter((check) => !check.ok);
  const leakedPublic = publicProbes.filter((probe) => probe.stillPublic);

  const report = {
    verifiedAt: new Date().toISOString(),
    target: { database: target.database, host: target.host, cloudName: target.cloudName },
    rows: { issue: issueRows.length, task: taskRows.length },
    kinds: { issue: issueKinds, task: taskKinds },
    legacyRemaining,
    privateRefs: privateRefs.length,
    missingAssets,
    publicProbes,
    checks,
    pass: legacyRemaining === 0 && missingAssets.length === 0 && failedChecks.length === 0 && leakedPublic.length === 0,
  };
  writeJson(path.join(REPORT_DIR, 'maintenance-evidence-verification.json'), report);

  console.log('\n🔍 XÁC MINH');
  console.log(`  hàng: issue=${issueRows.length} task=${taskRows.length}`);
  console.log(`  ref công khai còn lại: ${legacyRemaining}`);
  console.log(`  ref riêng tư: ${privateRefs.length} unique, thiếu asset: ${missingAssets.length}`);
  console.log(`  probe URL công khai cũ: ${publicProbes.length} (còn truy cập được: ${leakedPublic.length})`);
  console.log('  kiểm tra proxy:');
  if (checks.length === 0) console.log('    (không có dữ liệu để kiểm tra)');
  for (const check of checks) {
    console.log(`    ${check.ok ? '✅' : '❌'} ${check.name} — ${check.detail}`);
  }
  console.log(`\n${report.pass ? '✅ PASS' : '❌ FAIL'} — ${path.relative(process.cwd(), REPORT_DIR)}/maintenance-evidence-verification.json`);
  if (!report.pass) process.exitCode = 1;
  return report;
};

const parseArgs = (argv) => {
  const command = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'inventory';
  const limitArg = argv.find((arg) => arg.startsWith('--limit='));
  return {
    command,
    confirm: argv.includes('--confirm'),
    withFixtures: argv.includes('--fixtures'),
    limit: limitArg ? Number(limitArg.split('=')[1]) || null : null,
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  try {
    if (options.command === 'inventory') await commandInventory();
    else if (options.command === 'migrate') await commandMigrate(options);
    else if (options.command === 'verify') await commandVerify(options);
    else if (options.command === 'selftest') await commandSelfTest();
    else {
      console.error(`❌ Lệnh không hợp lệ: ${options.command} (inventory|migrate|verify|selftest)`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`❌ ${error?.message ?? error}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
};


/* ------------------------------------------------------------------------- *
 * SELF-TEST — chứng minh cơ chế migrate chạy được trên cloud DEV mà KHÔNG cần
 * dữ liệu bảo trì thật: tạo asset CÔNG KHAI trong thư mục scratch riêng, chuyển
 * sang authenticated bằng đúng hàm `ensurePrivateCopy`, xác nhận bytes, xoá bản
 * công khai, rồi dọn sạch cả hai. Không ghi vào DB.
 * ------------------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = (buffer) => {
  let crc = -1;
  for (const byte of buffer) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
};

const pngChunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
};

/** PNG 8×8 RGB hợp lệ, tạo tại chỗ (không phụ thuộc file/thư viện ngoài). */
const buildTestPng = () => {
  const size = 8;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (1 + size * 3);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x += 1) {
      const offset = rowStart + 1 + x * 3;
      raw[offset] = (x * 32) % 256;
      raw[offset + 1] = (y * 32) % 256;
      raw[offset + 2] = 128;
    }
  }
  const zlib = require('zlib');
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
};

const uploadScratchPublic = (publicId, bytes) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: 'image', type: 'upload', overwrite: true },
      (error, result) => (error || !result ? reject(error ?? new Error('upload thất bại')) : resolve(result)),
    );
    stream.end(bytes);
  });

const safeDestroy = async (publicId, type) => {
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: 'image', type, invalidate: true });
  } catch (error) {
    return { result: `error:${error?.message ?? error}` };
  }
};

const commandSelfTest = async () => {
  const target = describeTarget();
  console.log(`🎯 DEV target: cloud=${target.cloudName}`);
  const publicId = `rental-management/maintenance-evidence-selftest/${crypto.randomUUID()}`;
  const png = buildTestPng();
  const expectedHash = sha256(png);
  const checks = [];

  try {
    const uploaded = await uploadScratchPublic(publicId, png);
    checks.push({ name: 'scratch-upload-public', ok: Boolean(uploaded.secure_url) });
    checks.push({ name: 'public-bytes-match-source', ok: sha256(await fetchBytes(uploaded.secure_url)) === expectedHash });

    const asset = { publicId, legacyUrls: [uploaded.secure_url], existsPublic: true };
    const notes = await ensurePrivateCopy(asset, expectedHash, uploaded.secure_url);
    checks.push({ name: 'private-copy-created', ok: true, detail: notes.join(', ') });
    checks.push({
      name: 'private-signed-is-authenticated',
      ok: signedPrivateUrl(publicId).includes('/image/authenticated/'),
    });

    const destroyPublic = await destroyPublicCopy(asset);
    checks.push({
      name: 'public-delivery-blocked',
      ok: !destroyPublic.stillPublic,
      detail: `destroy=${destroyPublic.outcome}, probe=${destroyPublic.probeStatus}, sau ~${Math.round(
        (destroyPublic.clearedAfterMs ?? 0) / 1000,
      )}s`,
    });
    checks.push({ name: 'private-still-readable', ok: sha256(await fetchBytes(signedPrivateUrl(publicId))) === expectedHash });
  } catch (error) {
    checks.push({ name: 'self-test-runtime', ok: false, detail: error?.message ?? String(error) });
  } finally {
    await safeDestroy(publicId, 'upload');
    await safeDestroy(publicId, 'authenticated');
  }

  console.log('\n🔬 SELF-TEST (asset scratch, không ghi DB)');
  for (const check of checks) console.log(`  ${check.ok ? '✅' : '❌'} ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
  const pass = checks.every((check) => check.ok);
  console.log(`\n${pass ? '✅ PASS' : '❌ FAIL'} — asset scratch đã được dọn sạch.`);
  writeJson(path.join(REPORT_DIR, 'maintenance-evidence-selftest.json'), {
    ranAt: new Date().toISOString(),
    cloudName: target.cloudName,
    checks,
    pass,
  });
  if (!pass) process.exitCode = 1;
  return pass;
};


main();
