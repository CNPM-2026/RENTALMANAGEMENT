import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { isUserEmailUniqueViolation } from './prisma-errors';

/**
 * Dựng lỗi bằng chính class của @prisma/client 6.19.3 đang cài đặt (runtime chỉ
 * gán nguyên `meta` do query engine trả về, không chuẩn hóa `meta.target`), để
 * test bám đúng hình dạng lỗi thật thay vì một object giả.
 */
const knownError = (payload: { code: string; meta?: Record<string, unknown> }) =>
  new Prisma.PrismaClientKnownRequestError('Error occurred during query execution', {
    code: payload.code,
    clientVersion: 'test',
    meta: payload.meta,
  });

describe('isUserEmailUniqueViolation', () => {
  it('recognises the P2002 error class emitted by the installed Prisma client', () => {
    const error = knownError({ code: 'P2002', meta: { modelName: 'User', target: ['email'] } });

    expect(error.name).toBe('PrismaClientKnownRequestError');
    expect(error.code).toBe('P2002');
    // Runtime của @prisma/client chỉ gán nguyên `meta` do query engine trả về,
    // nên cả dạng mảng cột lẫn dạng tên constraint đều có thể xuất hiện.
    expect(error.meta).toEqual({ modelName: 'User', target: ['email'] });
  });

  it('accepts P2002 when meta.target is the column list', () => {
    const error = knownError({ code: 'P2002', meta: { modelName: 'User', target: ['email'] } });

    expect(error instanceof Prisma.PrismaClientKnownRequestError).toBe(true);
    expect(error.code).toBe('P2002');
    expect(isUserEmailUniqueViolation(error)).toBe(true);
  });

  it('accepts P2002 when meta.target is the constraint name', () => {
    expect(isUserEmailUniqueViolation(knownError({ code: 'P2002', meta: { modelName: 'User', target: 'users_email_key' } }))).toBe(true);
    expect(isUserEmailUniqueViolation(knownError({ code: 'P2002', meta: { modelName: 'User', target: 'USERS_EMAIL_KEY' } }))).toBe(true);
  });

  it('accepts P2002 when meta.modelName is missing but target is the email column', () => {
    expect(isUserEmailUniqueViolation(knownError({ code: 'P2002', meta: { target: ['email'] } }))).toBe(true);
  });

  it('rejects P2002 raised by another unique constraint', () => {
    expect(isUserEmailUniqueViolation(knownError({ code: 'P2002', meta: { modelName: 'RefreshToken', target: ['token_hash'] } }))).toBe(false);
    expect(isUserEmailUniqueViolation(knownError({ code: 'P2002', meta: { modelName: 'User', target: ['phone'] } }))).toBe(false);
  });

  it('rejects P2002 whose meta.target is missing or unusable', () => {
    expect(isUserEmailUniqueViolation(knownError({ code: 'P2002' }))).toBe(false);
    expect(isUserEmailUniqueViolation(knownError({ code: 'P2002', meta: { modelName: 'User' } }))).toBe(false);
    expect(isUserEmailUniqueViolation(knownError({ code: 'P2002', meta: { modelName: 'User', target: { index: 'users_email_key' } } }))).toBe(false);
    expect(isUserEmailUniqueViolation(knownError({ code: 'P2002', meta: { modelName: 'User', target: [42] } }))).toBe(false);
  });

  it('rejects other Prisma error codes even when they mention the email target', () => {
    expect(isUserEmailUniqueViolation(knownError({ code: 'P2003', meta: { modelName: 'User', target: ['email'] } }))).toBe(false);
    expect(isUserEmailUniqueViolation(knownError({ code: 'P2025', meta: { modelName: 'User', target: ['email'] } }))).toBe(false);
  });

  it('rejects non-Prisma errors', () => {
    expect(isUserEmailUniqueViolation(new Error('P2002 users_email_key'))).toBe(false);
    expect(isUserEmailUniqueViolation({ code: 'P2002', meta: { target: ['email'] } })).toBe(false);
    expect(isUserEmailUniqueViolation(null)).toBe(false);
    expect(isUserEmailUniqueViolation(undefined)).toBe(false);
  });
});
