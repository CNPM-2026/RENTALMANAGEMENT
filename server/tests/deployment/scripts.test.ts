import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

/**
 * DEPLOYMENT SCRIPTS — kiểm tra hành vi THẬT của các script CJS.
 *
 * Vì sao chạy qua `node -e` thay vì import: các script là CommonJS (`require` /
 * `module.exports`) và tự tạo `PrismaClient` khi load. Chạy trong tiến trình
 * Node riêng vừa đúng môi trường thật, vừa KHÔNG kết nối DB (không query nào
 * được gọi: chỉ đọc mảng STATEMENTS và các hàm thuần).
 */
const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const read = (relativePath: string) => readFileSync(path.join(SERVER_ROOT, relativePath), 'utf8');

const PROBE = `
const { splitSqlStatements, countSqlStatements } = require('./scripts/lib/sql-statements');
const { assertDeploymentTarget } = require('./scripts/lib/target-guard');

const scripts = {
  platform: require('./scripts/apply-platform-delta.js'),
  batch3: require('./scripts/apply-batch3-lifecycle.js'),
  occupancy: require('./scripts/apply-occupancy-invoice-delta.js'),
  taskIndex: require('./scripts/apply-maintenance-task-index.js'),
};

// to_regclass = rename có điều kiện (chỉ đổi tên khi index cũ tồn tại và tên
// mới chưa có) ⇒ chạy lại nhiều lần vẫn an toàn, tương đương IF EXISTS.
const IDEMPOTENT = /IF NOT EXISTS|IF EXISTS|duplicate_object|to_regclass/i;

const describeStatements = (statements) => ({
  count: statements.length,
  nonSingle: statements.filter((s) => countSqlStatements(s.sql) !== 1).map((s) => s.label),
  nonIdempotent: statements.filter((s) => !IDEMPOTENT.test(s.sql)).map((s) => s.label),
});

const guard = (fn) => {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    return { ok: false, message: String(error && error.message) };
  }
};

const previousNodeEnv = process.env.NODE_ENV;
const previousAllowlist = process.env.DB_HOST_ALLOWLIST;

process.env.NODE_ENV = 'test';
delete process.env.DB_HOST_ALLOWLIST;
const guardOk = guard(() => assertDeploymentTarget('postgresql://u:p@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres'));
const guardForeign = guard(() => assertDeploymentTarget('postgresql://u:p@evil.example.com:5432/postgres'));

process.env.DB_HOST_ALLOWLIST = 'evil.example.com';
const guardAllowlisted = guard(() => assertDeploymentTarget('postgresql://u:p@evil.example.com:5432/postgres'));
delete process.env.DB_HOST_ALLOWLIST;

process.env.NODE_ENV = 'production';
const guardProduction = guard(() => assertDeploymentTarget('postgresql://u:p@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres'));

process.env.NODE_ENV = previousNodeEnv;
if (previousAllowlist === undefined) delete process.env.DB_HOST_ALLOWLIST;
else process.env.DB_HOST_ALLOWLIST = previousAllowlist;

const splitSample = splitSqlStatements(
  "ALTER TYPE \\"X\\" ADD VALUE IF NOT EXISTS 'A'; DO $$ BEGIN PERFORM 1; END $$; SELECT 'a;b';",
);

const widePredicate =
  "(status = ANY (ARRAY['OPEN'::\\"MaintenanceTaskStatus\\", 'ASSIGNED'::\\"MaintenanceTaskStatus\\", 'IN_PROGRESS'::\\"MaintenanceTaskStatus\\", 'SUBMITTED'::\\"MaintenanceTaskStatus\\"]))";
const narrowPredicate =
  "(status = ANY (ARRAY['OPEN'::\\"MaintenanceTaskStatus\\", 'ASSIGNED'::\\"MaintenanceTaskStatus\\"]))";
const cancelledPredicate =
  "(status = ANY (ARRAY['OPEN'::\\"MaintenanceTaskStatus\\", 'ASSIGNED'::\\"MaintenanceTaskStatus\\", 'IN_PROGRESS'::\\"MaintenanceTaskStatus\\", 'SUBMITTED'::\\"MaintenanceTaskStatus\\", 'CANCELLED'::\\"MaintenanceTaskStatus\\"]))";

console.log(JSON.stringify({
  splitSample,
  platform: describeStatements(scripts.platform.STATEMENTS),
  batch3: describeStatements(scripts.batch3.STATEMENTS),
  occupancy: describeStatements(scripts.occupancy.STATEMENTS),
  occupancyActiveIndexSpec: scripts.occupancy.INDEX_SPECS.find(
    (entry) => entry[1] === scripts.occupancy.ACTIVE_DECLARATION_INDEX,
  ),
  occupancyPredicateChecks: {
    matchesNormalized: scripts.occupancy.predicateMatchesFragments(
      'status = ANY (ARRAY[PENDING, VERIFIED]) AND superseded_at IS NULL',
      scripts.occupancy.INDEX_SPECS.find((entry) => entry[1] === scripts.occupancy.ACTIVE_DECLARATION_INDEX)[3],
    ),
    rejectsMissingVerified: scripts.occupancy.predicateMatchesFragments(
      'status = ANY (ARRAY[PENDING]) AND superseded_at IS NULL',
      scripts.occupancy.INDEX_SPECS.find((entry) => entry[1] === scripts.occupancy.ACTIVE_DECLARATION_INDEX)[3],
    ),
    rejectsOtherStatuses: scripts.occupancy.predicateMatchesFragments(
      'status = ANY (ARRAY[OPEN, ASSIGNED])',
      scripts.occupancy.INDEX_SPECS.find((entry) => entry[1] === scripts.occupancy.ACTIVE_DECLARATION_INDEX)[3],
    ),
  },
  batch3Sql: scripts.batch3.STATEMENTS.map((s) => s.sql),
  occupancySql: scripts.occupancy.STATEMENTS.map((s) => s.sql),
  taskIndex: {
    expectedStatuses: scripts.taskIndex.EXPECTED_STATUSES,
    createSql: scripts.taskIndex.CREATE_SQL,
    wide: scripts.taskIndex.predicateCoversExpectedStatuses(widePredicate),
    narrow: scripts.taskIndex.predicateCoversExpectedStatuses(narrowPredicate),
    withCancelled: scripts.taskIndex.predicateCoversExpectedStatuses(cancelledPredicate),
  },
  guard: { guardOk, guardForeign, guardAllowlisted, guardProduction },
}));
`;

const probe = JSON.parse(
  execFileSync(process.execPath, ['-e', PROBE], {
    cwd: SERVER_ROOT,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test' },
  }).trim(),
);

describe('sql-statements helper', () => {
  it('tách đúng câu, bỏ qua dấu ; trong chuỗi và trong DO $$ block', () => {
    expect(probe.splitSample).toHaveLength(3);
    expect(probe.splitSample[0]).toContain("ADD VALUE IF NOT EXISTS 'A'");
    expect(probe.splitSample[1]).toContain('DO $$');
    expect(probe.splitSample[2]).toContain("SELECT 'a;b'");
  });
});

describe('mỗi lần $executeRawUnsafe chỉ chạy ĐÚNG MỘT câu', () => {
  it('apply-platform-delta.js', () => {
    expect(probe.platform.count).toBeGreaterThan(30);
    expect(probe.platform.nonSingle).toEqual([]);
  });

  it('apply-batch3-lifecycle.js', () => {
    expect(probe.batch3.count).toBeGreaterThan(0);
    expect(probe.batch3.nonSingle).toEqual([]);
  });

  it('apply-occupancy-invoice-delta.js', () => {
    expect(probe.occupancy.count).toBeGreaterThan(0);
    expect(probe.occupancy.nonSingle).toEqual([]);
  });

  it('mọi câu đều idempotent ⇒ chạy lại sau gián đoạn là an toàn (resumable)', () => {
    expect(probe.platform.nonIdempotent).toEqual([]);
    expect(probe.batch3.nonIdempotent).toEqual([]);
    expect(probe.occupancy.nonIdempotent).toEqual([]);
  });
});

describe('preflight không ghi, write phải có --confirm', () => {
  const scripts = [
    ['scripts/apply-platform-delta.js', 'db:platform:delta'],
    ['scripts/apply-batch3-lifecycle.js', 'db:batch3:lifecycle'],
    ['scripts/apply-occupancy-invoice-delta.js', 'db:occupancy:delta'],
    ['scripts/seed-dev-occupancy.js', 'db:occupancy:seed:dev'],
    ['scripts/reconcile-room-demand.js', 'db:demand:reconcile'],
    ['scripts/apply-maintenance-task-index.js', 'db:index:one-active-task'],
  ] as const;

  it.each(scripts)('%s: apply loop nằm SAU cổng --confirm', (relativePath) => {
    const source = read(relativePath);
    const confirmGate = source.indexOf('if (!confirm)');
    const firstWrite = source.indexOf('prisma.$executeRawUnsafe(');
    expect(confirmGate).toBeGreaterThan(-1);
    expect(firstWrite).toBeGreaterThan(-1);
    expect(confirmGate).toBeLessThan(firstWrite);
  });

  it.each(scripts)('%s: preflight trả về trước khi tới apply loop', (relativePath) => {
    const source = read(relativePath);
    const gateBlock = source.slice(
      source.indexOf('if (!confirm)'),
      source.indexOf('prisma.$executeRawUnsafe('),
    );
    expect(gateBlock).toMatch(/return 0|return 2/);
    expect(source).toMatch(/KHÔNG phải deploy thành công|CHƯA ÁP DỤNG|CHƯA SỬA|CHƯA GHI/);
  });

  it('npm scripts: lệnh ghi có --confirm, lệnh preflight thì không', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    for (const [, writeScript] of scripts) {
      expect(pkg.scripts[writeScript]).toContain('--confirm');
      const preflight = pkg.scripts[`${writeScript}:preflight`];
      expect(preflight, `thiếu ${writeScript}:preflight`).toBeTruthy();
      expect(preflight).not.toContain('--confirm');
    }
  });
});


describe('partial unique index "một công việc đang hoạt động / sự cố"', () => {
  it('predicate chuẩn phủ đủ OPEN/ASSIGNED/IN_PROGRESS/SUBMITTED', () => {
    expect(probe.taskIndex.expectedStatuses).toEqual(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED']);
    for (const status of probe.taskIndex.expectedStatuses) {
      expect(probe.taskIndex.createSql).toContain(`'${status}'`);
    }
    expect(probe.taskIndex.wide).toBe(true);
  });

  it('predicate hẹp OPEN/ASSIGNED bị coi là KHÔNG đạt', () => {
    expect(probe.taskIndex.narrow).toBe(false);
  });

  it('predicate có CANCELLED bị coi là KHÔNG đạt', () => {
    expect(probe.taskIndex.withCancelled).toBe(false);
  });

  it('Batch 3 tạo composite (task_id, kind) và xoá index đơn cũ', () => {
    const sql = probe.batch3Sql.join('\n');
    expect(sql).toContain('maintenance_task_images_task_id_kind_idx');
    expect(sql).toContain('DROP INDEX IF EXISTS "maintenance_task_images_task_id_idx"');
  });
});

describe('DDL của occupancy/invoice', () => {
  const sql = probe.occupancySql.join('\n');

  it('bảng khai báo + partial unique index theo (room, tenant) khi PENDING/VERIFIED', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "room_occupancy_declarations"');
    expect(sql).toContain('room_occupancy_declarations_one_active_per_tenant');
    expect(sql).toContain('WHERE "status" IN (\'PENDING\', \'VERIFIED\')');
  });

  it('verify index đọc predicate chuẩn hoá của PostgreSQL (IN → = ANY)', () => {
    const spec = probe.occupancyActiveIndexSpec;
    expect(spec[1]).toBe('room_occupancy_declarations_one_active_per_tenant');
    expect(spec[2]).toBe(true);
    expect(spec[3]).toEqual(['PENDING', 'VERIFIED', 'superseded_at IS NULL']);
    expect(probe.occupancyPredicateChecks.matchesNormalized).toBe(true);
    expect(probe.occupancyPredicateChecks.rejectsMissingVerified).toBe(false);
    expect(probe.occupancyPredicateChecks.rejectsOtherStatuses).toBe(false);
  });

  it('invoices có đủ cột snapshot + FK tới bản khai báo', () => {
    for (const column of [
      'electricity_start',
      'electricity_end',
      'electricity_consumption',
      'water_consumption',
      'water_occupants',
      'electricity_unit_price',
      'water_unit_price',
      'occupancy_declaration_id',
    ]) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`);
    }
    expect(sql).toContain('invoices_occupancy_declaration_id_fkey');
  });
});

describe('seed DEV cho khai báo số người ở', () => {
  const source = read('scripts/seed-dev-occupancy.js');

  it('chỉ INSERT khai báo VERIFIED, không sửa/xoá bảng khác', () => {
    expect(source).toContain('INSERT INTO "${DECLARATION_TABLE}"');
    expect(source).toContain("'VERIFIED'");
    expect(source).not.toMatch(/UPDATE\s+"[a-z_]+"/i);
    expect(source).not.toMatch(/DELETE\s+FROM\s+"/i);
  });

  it('idempotent: bỏ qua hợp đồng đã có khai báo PENDING/VERIFIED chưa bị thay thế', () => {
    expect(source).toContain('NOT EXISTS');
    expect(source).toContain(`d."status" IN ('PENDING', 'VERIFIED')`);
    expect(source).toContain('d."superseded_at" IS NULL');
  });

  it('chỉ nhắm hợp đồng ACTIVE và lấy chủ trọ từ property', () => {
    expect(source).toContain(`c."status" = 'ACTIVE'`);
    expect(source).toContain('p."landlord_id"');
    expect(source).toContain('r."max_occupants"');
  });
});

describe('reconcile nhu cầu thuê/xem phòng đã thuê', () => {
  const source = read('scripts/reconcile-room-demand.js');

  it('đồng bộ rooms.status theo hợp đồng ACTIVE và giữ điều kiện trạng thái', () => {
    expect(source).toContain(`SET "status" = 'RENTED'`);
    expect(source).toContain(`r."status" <> 'RENTED'`);
    expect(source).toContain(`c."status" = 'ACTIVE'`);
  });

  it('chỉ huỷ yêu cầu/lịch còn hiệu lực, không xoá bản ghi', () => {
    expect(source).toContain(`"status" IN ('SUBMITTED', 'CONTRACT_READY')`);
    expect(source).toContain(`a."status" IN ('PENDING', 'CONFIRMED')`);
    expect(source).toContain(`SET "status" = 'CANCELLED'`);
    expect(source).not.toMatch(/DELETE\s+FROM\s+"/i);
    expect(source).not.toMatch(/DROP\s+TABLE/i);
  });

  it('khớp lịch xem theo phòng hoặc bài đăng của phòng', () => {
    expect(source).toContain(`c."room_id" = a."room_id"`);
    expect(source).toContain(`(SELECT p."room_id" FROM "posts" p WHERE p."id" = a."post_id")`);
  });
});

describe('chốt an toàn target', () => {
  it('chấp nhận host Supabase DEV', () => {
    expect(probe.guard.guardOk.ok).toBe(true);
    expect(probe.guard.guardOk.value.host).toBe('aws-0-ap-northeast-1.pooler.supabase.com');
  });

  it('từ chối host ngoài allowlist', () => {
    expect(probe.guard.guardForeign.ok).toBe(false);
    expect(probe.guard.guardForeign.message).toContain('allowlist');
  });

  it('DB_HOST_ALLOWLIST mở rộng được nhưng phải tường minh', () => {
    expect(probe.guard.guardAllowlisted.ok).toBe(true);
  });

  it('từ chối NODE_ENV=production', () => {
    expect(probe.guard.guardProduction.ok).toBe(false);
    expect(probe.guard.guardProduction.message).toContain('production');
  });
});

