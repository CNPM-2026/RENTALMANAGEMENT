  import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import app from '../../src/app';
import prisma from '../../src/config/db';
import { hashToken } from '../../src/utils/tokens';
import { adminService } from '../../src/services/admin.service';
import { authService } from '../../src/services/auth.service';

/**
 * Batch 4 — hồi quy + tranh chấp chạy trên DB thật (H-01/H-02).
 *
 * Nguyên tắc:
 * - Mọi fixture (user, refresh token, audit) đều được tạo trong test và dọn lại
 *   trong `afterAll`; mọi phép đếm đều nằm trong phạm vi `userId` của fixture.
 *   Không có phép đếm toàn cục kiểu "không còn refresh token nào trong DB".
 * - Tranh chấp được điều phối bằng barrier tất định: một transaction giữ khóa
 *   row `users` của fixture, hai luồng nghiệp vụ bị chặn trên đúng khóa đó, và
 *   test chỉ thả khóa sau khi QUAN SÁT ĐƯỢC (qua `pg_locks` + `pg_stat_activity`)
 *   rằng cả hai đã thực sự xếp hàng. Không dùng `sleep` để "hy vọng" interleave.
 * - Không sửa logic production. Lỗi được tiêm bằng cách bọc `$transaction` phía
 *   client (chỉ trong test) để chứng minh rollback, không đổi mã nguồn dịch vụ.
 */
const PASSWORD = 'Batch4#Pass1';
const EMAIL_PREFIX = 'batch4.session.';

const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

const fixtureUserIds: string[] = [];

const createFixtureUser = async (role: 'TENANT' | 'ADMIN' = 'TENANT') => {
  const user = await prisma.user.create({
    data: {
      email: `${EMAIL_PREFIX}${randomUUID()}@rental.local`,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      fullName: 'Batch 4 fixture',
      role,
      isActive: true,
      isEmailVerified: true,
    },
    select: { id: true, email: true, role: true },
  });
  fixtureUserIds.push(user.id);
  return user;
};

const loginFixture = (email: string) => authService.login(email, PASSWORD);

/** Đếm token trong phạm vi MỘT fixture user (không bao giờ đếm toàn cục). */
const liveTokenCount = (userId: string) => prisma.refreshToken.count({ where: { userId, revokedAt: null } });
const totalTokenCount = (userId: string) => prisma.refreshToken.count({ where: { userId } });

const tokenRow = (token: string) =>
  prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { userId: true, revokedAt: true, expiresAt: true },
  });

const isFixtureUserActive = async (userId: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { isActive: true } })).isActive;

const deactivationAuditCount = (userId: string) =>
  prisma.auditLog.count({ where: { action: 'DEACTIVATE_USER', entityType: 'User', entityId: userId } });

/**
 * Đếm số transaction đang THỰC SỰ bị chặn (lock chưa được cấp) bởi chính
 * transaction đang giữ khóa row `users` của fixture.
 *
 * Hình dạng lock của hàng đợi (đo trực tiếp trên DB test, không suy đoán):
 * - người xếp hàng ĐẦU TIÊN chờ `locktype = 'transactionid'` (ShareLock) của
 *   đúng transaction đang giữ khóa;
 * - người xếp hàng THỨ HAI trở đi chờ `locktype = 'tuple'`
 *   (AccessExclusiveLock) trên đúng tuple đó, nhưng `pg_blocking_pids()` của họ
 *   trỏ về NGƯỜI ĐỨNG NGAY TRƯỚC TRONG HÀNG ĐỢI, không trỏ về backend giữ khóa.
 * Phải đếm cả hai loại: nếu chỉ lọc `transactionid` thì barrier luôn thấy tối đa
 * 1 người và test treo tới hết deadline.
 *
 * Vì sao không lọc theo `relation = 'users'` + query text (cách cũ): một
 * transaction KHÁC đang khóa một row `users` KHÁC cũng sinh waiter `tuple` trên
 * cùng relation với cùng query text, nên barrier đếm thừa (đo trên DB test:
 * 3 thay vì 2 khi có thêm hàng đợi thứ hai ở row khác). Ngược lại, chỉ so
 * `pg_blocking_pids(pid) = blockerPid` một cấp thì đếm thiếu (đo được: 1 thay vì
 * 2) vì waiter thứ hai bị waiter thứ nhất chặn. Neo duy nhất đúng là backend PID
 * giữ khóa — lấy bằng `pg_backend_pid()` BÊN TRONG transaction giữ khóa — rồi mở
 * rộng thành bao đóng wait-for (transitive closure, depth ≤ 8):
 * 1. seed: các backend có `blockerPid = ANY (pg_blocking_pids(pid))`;
 * 2. đệ quy: các backend bị chặn bởi bất kỳ ai đã thấy;
 * 3. chỉ đếm những pid đó nếu đang thực sự chờ (`l.granted = false`), lock là
 *    `transactionid`/`tuple`, và câu lệnh đúng dạng
 *    `SELECT id FROM users WHERE id = $1 FOR UPDATE` — lệnh khóa duy nhất mà
 *    `issueSession`, `refresh` và `adminService.updateUserStatus` phát ra.
 */
const countUsersRowLockWaiters = async (blockerPid: number) => {
  const rows = await prisma.$queryRaw<Array<{ waiting: number }>>`
    WITH RECURSIVE blocked (pid, depth) AS (
      SELECT p.pid, 1
      FROM pg_stat_activity p
      WHERE p.datname = current_database()
        AND ${blockerPid}::int = ANY (pg_blocking_pids(p.pid))
      UNION ALL
      SELECT p.pid, b.depth + 1
      FROM blocked b
      JOIN pg_stat_activity p ON b.pid = ANY (pg_blocking_pids(p.pid))
      WHERE b.depth < 8
        AND p.datname = current_database()
    ),
    waiters AS (
      SELECT l.pid
      FROM pg_locks l
      JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE l.granted = false
        AND a.datname = current_database()
        AND l.locktype IN ('transactionid', 'tuple')
        AND a.query LIKE '%FROM users%id = $1%FOR UPDATE%'
    )
    SELECT count(DISTINCT b.pid)::int AS waiting
    FROM blocked b
    JOIN waiters w ON w.pid = b.pid
  `;
  return rows[0]?.waiting ?? 0;
};

const waitForUsersRowLockWaiters = async (expected: number, blockerPid: number) => {
  const deadline = Date.now() + 10000;
  let waiting = 0;
  while (Date.now() < deadline) {
    waiting = await countUsersRowLockWaiters(blockerPid);
    if (waiting >= expected) return waiting;
    await sleep(40);
  }
  throw new Error(
    `Hết thời gian chờ ${expected} transaction xếp hàng trên row users của fixture (đang thấy ${waiting})`,
  );
};

type RowLockBlocker = {
  /**
   * Backend PID giữ khóa row `users` của fixture, lấy bằng `pg_backend_pid()`
   * BÊN TRONG transaction giữ khóa (resolve sau khi `FOR UPDATE` đã thành công).
   */
  pid: Promise<number>;
  release: () => void;
  committed: Promise<void>;
};

/** Transaction giữ khóa row `users` của fixture để dựng barrier tất định. */
const holdFixtureRowLock = (userId: string): RowLockBlocker => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let markPid!: (pid: number) => void;
  const pid = new Promise<number>((resolve) => { markPid = resolve; });

  const committed = prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const rows = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid()::int AS pid`;
    markPid(rows[0].pid);
    await held;
  }, { timeout: 25000, maxWait: 15000 });
  // Nuốt cảnh báo unhandled rejection; lỗi thật vẫn nổi lên khi test await `committed`.
  committed.catch(() => undefined);

  return { pid, release, committed };
};

/**
 * Dựng barrier rồi thả ra: `startFirst` vào hàng đợi trước, `startSecond` vào
 * sau (Postgres cấp khóa theo FIFO). Khóa luôn được thả trong `finally` — nếu
 * barrier thất bại mà row users còn bị giữ thì bước dọn dẹp của cả file sẽ treo
 * (hook timeout).
 */
const raceBehindRowLock = async <A, B>(
  userId: string,
  startFirst: () => Promise<A>,
  startSecond: () => Promise<B>,
): Promise<[PromiseSettledResult<A>, PromiseSettledResult<B>]> => {
  const blocker = holdFixtureRowLock(userId);
  const blockerPid = await blocker.pid;

  let first: Promise<A> | undefined;
  let second: Promise<B> | undefined;
  try {
    first = startFirst();
    void first.catch(() => undefined);
    await waitForUsersRowLockWaiters(1, blockerPid);

    second = startSecond();
    void second.catch(() => undefined);
    await waitForUsersRowLockWaiters(2, blockerPid);
  } finally {
    blocker.release();
    await blocker.committed.catch(() => undefined);
  }

  if (!first || !second) throw new Error('Barrier không khởi động được cả hai luồng');
  return (await Promise.allSettled([first, second])) as [PromiseSettledResult<A>, PromiseSettledResult<B>];
};

type TxFault = { delegate: 'refreshToken'; method: 'create' | 'updateMany'; error: Error };

const bindIfFunction = (value: unknown, receiver: unknown) =>
  typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(receiver) : value;

/** Bọc `tx` để đúng MỘT method của delegate ném lỗi — mô phỏng DB lỗi giữa transaction. */
const wrapTxWithFault = (tx: unknown, fault: TxFault) =>
  new Proxy(tx as Record<string | symbol, unknown>, {
    get(target, property) {
      if (property === fault.delegate) {
        const delegate = Reflect.get(target, property) as Record<string | symbol, unknown>;
        return new Proxy(delegate, {
          get(inner, method) {
            if (method === fault.method) return () => Promise.reject(fault.error);
            return bindIfFunction(Reflect.get(inner, method), inner);
          },
        });
      }
      return bindIfFunction(Reflect.get(target, property), target);
    },
  });

/**
 * Chạy `run` với một lỗi được tiêm vào transaction tương tác. Chỉ test dùng:
 * `finally` khôi phục nguyên trạng `prisma.$transaction` cho các test sau.
 */
const withTransactionFault = async <T>(fault: TxFault, run: () => Promise<T>): Promise<T> => {
  const client = prisma as unknown as { $transaction: (...args: unknown[]) => unknown };
  const original = client.$transaction;

  client.$transaction = ((arg: unknown, options?: unknown) => {
    if (typeof arg !== 'function') return original.call(prisma, arg, options);
    return original.call(
      prisma,
      (tx: unknown) => (arg as (inner: unknown) => unknown)(wrapTxWithFault(tx, fault)),
      options,
    );
  }) as typeof client.$transaction;

  try {
    return await run();
  } finally {
    client.$transaction = original;
  }
};

describe('session lifecycle against a real database', () => {
  it("R1': deactivation revokes every live refresh token of the fixture account", async () => {
    const user = await createFixtureUser();
    const admin = await createFixtureUser('ADMIN');

    const first = await loginFixture(user.email);
    const second = await loginFixture(user.email);

    // Tiền đề, đo trong phạm vi MỘT fixture: đúng 2 phiên còn sống.
    expect(await liveTokenCount(user.id)).toBe(2);
    expect(await totalTokenCount(user.id)).toBe(2);

    await adminService.updateUserStatus(admin.id, user.id, false);

    expect(await liveTokenCount(user.id)).toBe(0);
    expect(await totalTokenCount(user.id)).toBe(2);
    const rows = await prisma.refreshToken.findMany({
      where: { userId: user.id },
      select: { tokenHash: true, revokedAt: true },
    });
    expect(rows.every((row) => row.revokedAt instanceof Date)).toBe(true);
    expect(rows.map((row) => row.tokenHash).sort()).toEqual(
      [hashToken(first.refreshToken), hashToken(second.refreshToken)].sort(),
    );
    expect(await isFixtureUserActive(user.id)).toBe(false);
  });

  it('R2: a pre-ban refresh token is rejected and stays revoked', async () => {
    const user = await createFixtureUser();
    const admin = await createFixtureUser('ADMIN');
    const session = await loginFixture(user.email);

    expect((await tokenRow(session.refreshToken))?.revokedAt).toBeNull();

    await adminService.updateUserStatus(admin.id, user.id, false);
    const revokedByBan = (await tokenRow(session.refreshToken))?.revokedAt;
    expect(revokedByBan).toBeInstanceOf(Date);

    await expect(authService.refresh(session.refreshToken)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Refresh token không hợp lệ hoặc đã hết hạn',
    });

    // Token cũ phải GIỮ nguyên trạng đã thu hồi — không bị "hồi sinh".
    const afterRejection = await tokenRow(session.refreshToken);
    expect(afterRejection?.revokedAt?.toISOString()).toBe(revokedByBan?.toISOString());
    expect(await liveTokenCount(user.id)).toBe(0);
    expect(await totalTokenCount(user.id)).toBe(1);
  });

  it('R3: a failed refresh never creates a replacement token', async () => {
    const user = await createFixtureUser();
    const admin = await createFixtureUser('ADMIN');
    const session = await loginFixture(user.email);

    // (a) Token đã bị thu hồi bởi lệnh khóa tài khoản.
    await adminService.updateUserStatus(admin.id, user.id, false);
    await expect(authService.refresh(session.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
    expect(await totalTokenCount(user.id)).toBe(1);
    expect(await liveTokenCount(user.id)).toBe(0);

    // (b) Token không tồn tại: vẫn không được ghi row nào cho fixture này.
    await expect(authService.refresh('a'.repeat(64))).rejects.toMatchObject({ statusCode: 401 });
    expect(await totalTokenCount(user.id)).toBe(1);

    // (c) Lặp lại lần nữa để chắc chắn không có "retry ngầm" sinh token.
    await expect(authService.refresh(session.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
    expect(await totalTokenCount(user.id)).toBe(1);
  });

  it('R4a: a refresh queued behind a deactivation is rejected and leaves no live token', async () => {
    const user = await createFixtureUser();
    const admin = await createFixtureUser('ADMIN');
    const session = await loginFixture(user.email);

    // Thứ tự hàng đợi: deactivation vào trước, refresh vào sau -> refresh bắt buộc
    // phải đọc được trạng thái ĐÃ commit của lệnh khóa tài khoản.
    const [deactivationResult, rotationResult] = await raceBehindRowLock(
      user.id,
      () => adminService.updateUserStatus(admin.id, user.id, false),
      () => authService.refresh(session.refreshToken),
    );

    expect(deactivationResult.status).toBe('fulfilled');
    expect(rotationResult.status).toBe('rejected');
    if (rotationResult.status === 'rejected') {
      expect(rotationResult.reason).toMatchObject({ statusCode: 401 });
    }

    expect(await isFixtureUserActive(user.id)).toBe(false);
    expect(await liveTokenCount(user.id)).toBe(0);
    expect(await totalTokenCount(user.id)).toBe(1);
  });

  it('R4b: a rotation that wins the lock race is revoked by the deactivation right behind it', async () => {
    const user = await createFixtureUser();
    const admin = await createFixtureUser('ADMIN');
    const session = await loginFixture(user.email);

    // Lần này refresh vào hàng đợi trước: nó commit xong thì deactivation mới chạy.
    const [rotationResult, deactivationResult] = await raceBehindRowLock(
      user.id,
      () => authService.refresh(session.refreshToken),
      () => adminService.updateUserStatus(admin.id, user.id, false),
    );

    expect(deactivationResult.status).toBe('fulfilled');
    if (rotationResult.status !== 'fulfilled') {
      throw new Error(`rotation phải thắng barrier: ${String(rotationResult.reason)}`);
    }

    // Token vừa cấp vẫn bị thu hồi bởi lệnh khóa ngay sau đó -> không còn phiên sống.
    const rotatedRow = await tokenRow(rotationResult.value.refreshToken);
    expect(rotatedRow?.revokedAt).toBeInstanceOf(Date);
    expect(await isFixtureUserActive(user.id)).toBe(false);
    expect(await liveTokenCount(user.id)).toBe(0);
    expect(await totalTokenCount(user.id)).toBe(2);

    await expect(authService.refresh(rotationResult.value.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('R5: two concurrent rotations of one token yield exactly one success', async () => {
    const user = await createFixtureUser();
    const session = await loginFixture(user.email);
    const originalHash = hashToken(session.refreshToken);

    const settled = await Promise.allSettled([
      authService.refresh(session.refreshToken),
      authService.refresh(session.refreshToken),
    ]);

    const succeeded = settled.filter((result) => result.status === 'fulfilled');
    const rejected = settled.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(succeeded).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ statusCode: 401 });

    // Token cũ bị thu hồi, đúng MỘT token thay thế còn sống, không có bản sao thừa.
    expect((await tokenRow(session.refreshToken))?.revokedAt).toBeInstanceOf(Date);
    expect(await totalTokenCount(user.id)).toBe(2);
    expect(await liveTokenCount(user.id)).toBe(1);

    const winner = succeeded[0] as PromiseFulfilledResult<{ token: string; refreshToken: string }>;
    expect(hashToken(winner.value.refreshToken)).not.toBe(originalHash);
    expect((await tokenRow(winner.value.refreshToken))?.revokedAt).toBeNull();
  });

  it('R6: repeated deactivation is idempotent and never duplicates live sessions', async () => {
    const user = await createFixtureUser();
    const admin = await createFixtureUser('ADMIN');
    await loginFixture(user.email);
    expect(await liveTokenCount(user.id)).toBe(1);

    // (a) Lặp tuần tự: lần thứ hai không được ném lỗi.
    await adminService.updateUserStatus(admin.id, user.id, false);
    const second = await adminService.updateUserStatus(admin.id, user.id, false);
    expect(second).toMatchObject({ id: user.id, isActive: false });

    // (b) Lặp đồng thời: hai transaction xếp hàng trên cùng row users, cả hai phải
    // thành công và không lần nào sinh phiên mới (chúng chỉ thu hồi).
    const concurrent = await Promise.allSettled([
      adminService.updateUserStatus(admin.id, user.id, false),
      adminService.updateUserStatus(admin.id, user.id, false),
    ]);
    expect(concurrent.every((result) => result.status === 'fulfilled')).toBe(true);

    expect(await isFixtureUserActive(user.id)).toBe(false);
    expect(await liveTokenCount(user.id)).toBe(0);
    expect(await totalTokenCount(user.id)).toBe(1);
    // Cả 4 lần gọi đều được audit; không lần nào thêm token.
    expect(await deactivationAuditCount(user.id)).toBe(4);
  });

  it('T12: access-token authentication and refresh both reject a deactivated account', async () => {
    const user = await createFixtureUser();
    const admin = await createFixtureUser('ADMIN');
    const session = await loginFixture(user.email);

    const before = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${session.token}`);
    expect(before.status).toBe(200);
    expect(before.body.data.id).toBe(user.id);

    await adminService.updateUserStatus(admin.id, user.id, false);

    // Access token còn hạn nhưng middleware phải từ chối vì tài khoản đã bị khóa.
    const after = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${session.token}`);
    expect(after.status).toBe(401);
    expect(after.body.message).toBe('Tài khoản không tồn tại hoặc đã bị khóa');

    // Refresh token đã bị thu hồi -> không thể đổi lấy access token mới.
    await expect(authService.refresh(session.refreshToken)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Refresh token không hợp lệ hoặc đã hết hạn',
    });

    // Và không thể đăng nhập lại bằng mật khẩu đúng. Contract của `login` là
    // KHÔNG tiết lộ trạng thái tài khoản cho người chưa xác thực, nên tài khoản bị
    // khóa trả về đúng lỗi 401 của "sai thông tin đăng nhập"; 403 "Tài khoản đã bị
    // khóa" chỉ dành cho nhánh TOCTOU sau khi mật khẩu đã khớp (xem
    // auth.session.test.ts: "refuses a session for an account deactivated between
    // the lookup and the lock").
    await expect(loginFixture(user.email)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Email hoặc mật khẩu không đúng',
    });

    // Bất kể thông điệp là gì, không có phiên nào được cấp thêm cho tài khoản đã khóa.
    expect(await liveTokenCount(user.id)).toBe(0);
    expect(await totalTokenCount(user.id)).toBe(1);
  });

  it('rollback: a failed session write leaves no orphan refresh token', async () => {
    const user = await createFixtureUser();
    const failure = new Error('refresh_tokens insert failed');

    await expect(
      withTransactionFault(
        { delegate: 'refreshToken', method: 'create', error: failure },
        () => loginFixture(user.email),
      ),
    ).rejects.toBe(failure);

    expect(await totalTokenCount(user.id)).toBe(0);
    expect(await liveTokenCount(user.id)).toBe(0);

    // Hết lỗi thì đăng nhập lại bình thường (không kẹt trạng thái sau rollback).
    await loginFixture(user.email);
    expect(await liveTokenCount(user.id)).toBe(1);
  });

  it('rollback: a failed replacement insert restores the claimed token', async () => {
    const user = await createFixtureUser();
    const session = await loginFixture(user.email);
    const failure = new Error('replacement insert failed');

    await expect(
      withTransactionFault(
        { delegate: 'refreshToken', method: 'create', error: failure },
        () => authService.refresh(session.refreshToken),
      ),
    ).rejects.toBe(failure);

    // Claim đã rollback: token cũ vẫn sống, không có token thay thế nào được ghi.
    expect((await tokenRow(session.refreshToken))?.revokedAt).toBeNull();
    expect(await totalTokenCount(user.id)).toBe(1);
    expect(await liveTokenCount(user.id)).toBe(1);

    // Token cũ vẫn dùng được -> không có rotation "nửa chừng".
    const rotated = await authService.refresh(session.refreshToken);
    expect(rotated.refreshToken).toEqual(expect.any(String));
    expect(await liveTokenCount(user.id)).toBe(1);
    expect(await totalTokenCount(user.id)).toBe(2);
  });

  it('rollback: a failed revocation keeps the account active and the session live', async () => {
    const user = await createFixtureUser();
    const admin = await createFixtureUser('ADMIN');
    const session = await loginFixture(user.email);
    const failure = new Error('refresh_tokens revoke failed');

    await expect(
      withTransactionFault(
        { delegate: 'refreshToken', method: 'updateMany', error: failure },
        () => adminService.updateUserStatus(admin.id, user.id, false),
      ),
    ).rejects.toBe(failure);

    // UPDATE users phải rollback cùng transaction; audit không được ghi.
    expect(await isFixtureUserActive(user.id)).toBe(true);
    expect(await liveTokenCount(user.id)).toBe(1);
    expect(await deactivationAuditCount(user.id)).toBe(0);

    // Khóa lại lần nữa (không tiêm lỗi) vẫn hoạt động đúng.
    await adminService.updateUserStatus(admin.id, user.id, false);
    expect(await isFixtureUserActive(user.id)).toBe(false);
    expect(await liveTokenCount(user.id)).toBe(0);
    expect(await deactivationAuditCount(user.id)).toBe(1);
    await expect(authService.refresh(session.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
  });
});

afterAll(async () => {
  if (fixtureUserIds.length > 0) {
    // Dọn đúng phạm vi fixture: audit do test sinh ra, token, rồi user.
    await prisma.auditLog.deleteMany({
      where: { OR: [{ entityId: { in: fixtureUserIds } }, { userId: { in: fixtureUserIds } }] },
    });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: fixtureUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: fixtureUserIds } } });
  }
  await prisma.$disconnect();
});



