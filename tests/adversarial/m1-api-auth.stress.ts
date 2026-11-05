/**
 * Empirical Adversarial Stress Test Suite for Milestone 1
 * Targets: client/lib/api.ts and client/lib/auth.ts
 *
 * Tests:
 * 1. Request serialization & URL resolution (arrays, primitives, trailing slashes, baseUrl prefixes)
 * 2. Bearer token injection, skipAuth, FormData vs JSON bodies, custom headers
 * 3. Envelope unboxing (standard, paginated, 204, raw) and error normalization (400, 500)
 * 4. 401 error handling, atomic refresh queue concurrency (20 simultaneous 401s), lockout, infinite loop prevention
 * 5. SSR safety (window=undefined) vs CSR session storage, cookie sync, corrupted JSON resilience
 */

import { apiClient, ApiError, request } from '../../client/lib/api';
import * as auth from '../../client/lib/auth';

interface TestResult {
  name: string;
  category: string;
  status: 'PASS' | 'FAIL';
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function test(category: string, name: string, fn: () => Promise<void> | void) {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, category, status: 'PASS', durationMs: Date.now() - start });
    console.log(`  [PASS] [${category}] ${name} (${Date.now() - start}ms)`);
  } catch (err: any) {
    results.push({ name, category, status: 'FAIL', error: err?.message || String(err), durationMs: Date.now() - start });
    console.error(`  [FAIL] [${category}] ${name}`);
    console.error(`         Error: ${err?.message || String(err)}`);
    if (err?.stack) {
      console.error(`         ${err.stack.split('\n').slice(1, 3).join('\n         ')}`);
    }
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

function assertEqual<T>(actual: T, expected: T, msg?: string) {
  if (actual !== expected) {
    throw new Error(`${msg || 'Equality failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual: any, expected: any, msg?: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${msg || 'Deep equality failed'}:\nExpected: ${e}\nActual:   ${a}`);
  }
}

// Global fetch mocking infrastructure
type FetchHandler = (url: string, init?: RequestInit) => Promise<Response> | Response;
let customFetchHandler: FetchHandler | null = null;
const originalFetch = globalThis.fetch;

function setupMockFetch(handler: FetchHandler) {
  customFetchHandler = handler;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (customFetchHandler) {
      return customFetchHandler(url, init);
    }
    return originalFetch(input, init);
  };
}

function restoreFetch() {
  customFetchHandler = null;
  globalThis.fetch = originalFetch;
}

// In-memory mock localStorage and document for CSR testing
class MockLocalStorage {
  private store: Map<string, string> = new Map();
  public shouldThrow: boolean = false;

  getItem(key: string): string | null {
    if (this.shouldThrow) throw new Error('QuotaExceededError / Storage Restricted');
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.shouldThrow) throw new Error('QuotaExceededError / Storage Restricted');
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    if (this.shouldThrow) throw new Error('QuotaExceededError / Storage Restricted');
    this.store.delete(key);
  }
  clear(): void {
    if (this.shouldThrow) throw new Error('QuotaExceededError / Storage Restricted');
    this.store.clear();
  }
}

const mockStorage = new MockLocalStorage();
let mockDocumentCookie = '';

function setupBrowserEnv() {
  (globalThis as any).window = {
    location: {
      replace: (url: string) => { (globalThis as any).__lastReplacedUrl = url; },
    },
  };
  (globalThis as any).localStorage = mockStorage;
  (globalThis as any).document = {
    get cookie() {
      return mockDocumentCookie;
    },
    set cookie(val: string) {
      // Simulate basic cookie string assignment
      mockDocumentCookie = val;
    },
  };
}

function teardownBrowserEnv() {
  delete (globalThis as any).window;
  delete (globalThis as any).localStorage;
  delete (globalThis as any).document;
  delete (globalThis as any).__lastReplacedUrl;
  mockStorage.shouldThrow = false;
  mockStorage.clear();
  mockDocumentCookie = '';
}

// =============================================================================
// MAIN TEST EXECUTION
// =============================================================================
async function runAllTests() {
  console.log('\n================================================================================');
  console.log('  STARTING ADVERSARIAL STRESS TEST SUITE: API CLIENT & AUTH LAYER (M1)');
  console.log('================================================================================\n');

  // ---------------------------------------------------------------------------
  // SECTION 1: REQUEST SERIALIZATION & URL RESOLUTION
  // ---------------------------------------------------------------------------
  console.log('--- SECTION 1: Request Serialization & URL Resolution ---');

  await test('URL & Serialization', 'Serializes array query parameters as comma-separated values (amenityIds)', async () => {
    let capturedUrl = '';
    setupMockFetch(async (url) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await apiClient.posts.search({ amenityIds: ['amenity-1', 'amenity-2', 'amenity-3'] });
    restoreFetch();

    assert(capturedUrl.includes('amenityIds=amenity-1%2Camenity-2%2Camenity-3') || capturedUrl.includes('amenityIds=amenity-1,amenity-2,amenity-3'),
      `Expected comma-separated amenityIds in URL, got: ${capturedUrl}`);
  });

  await test('URL & Serialization', 'Filters out null, undefined, and empty string query parameters', async () => {
    let capturedUrl = '';
    setupMockFetch(async (url) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await apiClient.get('/posts/search', {
      keyword: 'phòng trọ',
      province: '',
      district: undefined,
      ward: null,
      page: 1,
      minPrice: 0,
      isPetAllowed: false,
    });
    restoreFetch();

    const parsed = new URL(capturedUrl);
    assertEqual(parsed.searchParams.get('keyword'), 'phòng trọ');
    assertEqual(parsed.searchParams.get('page'), '1');
    assertEqual(parsed.searchParams.get('minPrice'), '0');
    assertEqual(parsed.searchParams.get('isPetAllowed'), 'false');
    assertEqual(parsed.searchParams.get('province'), null, 'Empty string should be omitted');
    assertEqual(parsed.searchParams.get('district'), null, 'Undefined should be omitted');
    assertEqual(parsed.searchParams.get('ward'), null, 'Null should be omitted');
  });

  await test('URL & Serialization', 'Preserves existing query parameters on path when params object is passed', async () => {
    let capturedUrl = '';
    setupMockFetch(async (url) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await apiClient.get('/posts?status=active', { page: 2, limit: 10 });
    restoreFetch();

    const parsed = new URL(capturedUrl);
    assertEqual(parsed.searchParams.get('status'), 'active');
    assertEqual(parsed.searchParams.get('page'), '2');
    assertEqual(parsed.searchParams.get('limit'), '10');
  });

  await test('URL & Serialization', 'Normalizes trailing slashes in NEXT_PUBLIC_API_URL', async () => {
    const origEnv = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000///';

    let capturedUrl = '';
    setupMockFetch(async (url) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await apiClient.get('/rooms/amenities');
    restoreFetch();
    process.env.NEXT_PUBLIC_API_URL = origEnv;

    assert(!capturedUrl.includes('///'), `URL should not contain triple slashes: ${capturedUrl}`);
    assert(capturedUrl.startsWith('http://localhost:3000/api/v1/rooms/amenities'), `URL resolved incorrectly: ${capturedUrl}`);
  });

  await test('URL & Serialization', 'Avoids duplicating /api/v1 when path already includes /api/v1', async () => {
    let capturedUrl = '';
    setupMockFetch(async (url) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await apiClient.get('/api/v1/custom-endpoint');
    restoreFetch();

    assert(!capturedUrl.includes('/api/v1/api/v1'), `URL duplicated /api/v1: ${capturedUrl}`);
  });

  await test('URL & Serialization', 'CRITICAL ADVERSARIAL: When NEXT_PUBLIC_API_URL contains /api/v1, check for duplicate prefix', async () => {
    const origEnv = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000/api/v1';

    let capturedUrl = '';
    setupMockFetch(async (url) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await apiClient.get('/rooms');
    restoreFetch();
    process.env.NEXT_PUBLIC_API_URL = origEnv;

    // Check if the URL ended up with /api/v1/api/v1
    const hasDoublePrefix = capturedUrl.includes('/api/v1/api/v1');
    if (hasDoublePrefix) {
      throw new Error(`CRITICAL DEFECT DETECTED: NEXT_PUBLIC_API_URL="http://localhost:3000/api/v1" resulted in double prefix: ${capturedUrl}`);
    }
  });

  // ---------------------------------------------------------------------------
  // SECTION 2: BEARER TOKEN INJECTION & BODY FORMATTING
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Bearer Token Injection & Body Formatting ---');

  await test('Bearer Token Injection', 'Injects Authorization Bearer header when token exists in storage', async () => {
    setupBrowserEnv();
    mockStorage.setItem(auth.TOKEN_KEY, 'test_jwt_access_token_123');

    let capturedHeaders: HeadersInit | undefined;
    setupMockFetch(async (url, init) => {
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify({ success: true, data: { id: 'u1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await apiClient.auth.getMe();
    restoreFetch();
    teardownBrowserEnv();

    const headersObj = capturedHeaders as Record<string, string>;
    assertEqual(headersObj['Authorization'], 'Bearer test_jwt_access_token_123', 'Bearer token header mismatch');
  });

  await test('Bearer Token Injection', 'Omits Authorization header when token is absent from storage', async () => {
    setupBrowserEnv();
    // No token set

    let capturedHeaders: HeadersInit | undefined;
    setupMockFetch(async (url, init) => {
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify({ success: true, data: { id: 'u1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await apiClient.auth.getMe();
    restoreFetch();
    teardownBrowserEnv();

    const headersObj = capturedHeaders as Record<string, string>;
    assertEqual(headersObj['Authorization'], undefined, 'Authorization header should not be present when token is null');
  });

  await test('Bearer Token Injection', 'Omits Authorization header when skipAuth is true even if token exists', async () => {
    setupBrowserEnv();
    mockStorage.setItem(auth.TOKEN_KEY, 'test_jwt_access_token_123');

    let capturedHeaders: HeadersInit | undefined;
    setupMockFetch(async (url, init) => {
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify({ success: true, data: { token: 'new_token' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await apiClient.auth.login({ email: 'test@rental.local', password: 'Password123!' });
    restoreFetch();
    teardownBrowserEnv();

    const headersObj = capturedHeaders as Record<string, string>;
    assertEqual(headersObj['Authorization'], undefined, 'Authorization header must not be sent on skipAuth requests (e.g. login)');
  });

  await test('Body Formatting', 'Sets Content-Type: application/json for object bodies and stringifies JSON', async () => {
    let capturedBody: any;
    let capturedHeaders: any;

    setupMockFetch(async (url, init) => {
      capturedBody = init?.body;
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify({ success: true, data: { id: 'p1' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const payload = { title: 'Căn hộ dịch vụ cao cấp', price: 4500000 };
    await apiClient.post('/properties', payload);
    restoreFetch();

    assertEqual(capturedHeaders['Content-Type'], 'application/json');
    assertEqual(capturedBody, JSON.stringify(payload));
  });

  await test('Body Formatting', 'Does NOT set Content-Type header when body is FormData (preserves multipart boundary)', async () => {
    let capturedHeaders: any;

    setupMockFetch(async (url, init) => {
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify({ success: true, data: { id: 'u1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const formData = new FormData();
    formData.append('fullName', 'Nguyễn Văn A');
    await apiClient.users.updateProfile(formData);
    restoreFetch();

    assertEqual(capturedHeaders['Content-Type'], undefined, 'Content-Type must be undefined so fetch generates multipart boundary');
  });

  // ---------------------------------------------------------------------------
  // SECTION 3: ENVELOPE UNBOXING & ERROR NORMALIZATION
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Envelope Unboxing & Error Normalization ---');

  await test('Envelope Unboxing', 'Unboxes standard envelope { success: true, data: T } and returns data', async () => {
    setupMockFetch(async () => {
      return new Response(JSON.stringify({
        success: true,
        message: 'Lấy dữ liệu phòng thành công',
        data: [{ id: 'room-1', name: 'Phòng 101', price: 3500000 }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await apiClient.rooms.getByProperty('prop-1');
    restoreFetch();

    assert(Array.isArray(result), 'Result should be unwrapped to array data');
    assertEqual(result.length, 1);
    assertEqual(result[0].id, 'room-1');
  });

  await test('Envelope Unboxing', 'Unboxes paginated envelope { success: true, meta, data } and returns { meta, data }', async () => {
    const mockPagination = {
      success: true,
      meta: { total: 100, page: 2, limit: 10, totalPages: 10 },
      data: [{ id: 'post-1', title: 'Phòng tiện nghi' }],
    };

    setupMockFetch(async () => {
      return new Response(JSON.stringify(mockPagination), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await apiClient.posts.search({ page: 2 });
    restoreFetch();

    assert(result.meta !== undefined, 'Meta should be preserved');
    assertEqual(result.meta.page, 2);
    assertEqual(result.meta.total, 100);
    assert(Array.isArray(result.data), 'Data should be array');
    assertEqual(result.data[0].id, 'post-1');
  });

  await test('Envelope Unboxing', 'Returns null on HTTP 204 No Content without JSON parsing errors', async () => {
    setupMockFetch(async () => {
      return new Response(null, { status: 204 });
    });

    const result = await apiClient.delete('/posts/post-123');
    restoreFetch();

    assertEqual(result, null);
  });

  await test('Envelope Unboxing', 'Handles non-envelope JSON responses without crashing', async () => {
    setupMockFetch(async () => {
      return new Response(JSON.stringify({ customStatus: 'OK', ping: 'pong' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await apiClient.get<any>('/health');
    restoreFetch();

    assertEqual(result.ping, 'pong');
  });

  await test('Error Normalization', 'Throws typed ApiError with status 400 and structured validation errors', async () => {
    setupMockFetch(async () => {
      return new Response(JSON.stringify({
        success: false,
        message: 'Dữ liệu đầu vào không hợp lệ',
        errors: [
          { field: 'email', message: 'Email đã tồn tại trong hệ thống' },
          { field: 'password', message: 'Mật khẩu quá ngắn' },
        ],
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    let caughtError: any;
    try {
      await apiClient.auth.register({
        email: 'existing@rental.local',
        password: '123',
        fullName: 'Test',
        phoneNumber: '0901234567',
        role: 'TENANT' as any,
      });
    } catch (err) {
      caughtError = err;
    }
    restoreFetch();

    assert(caughtError instanceof ApiError, 'Thrown error must be instance of ApiError');
    assert(caughtError instanceof Error, 'Thrown error must be instance of Error');
    assertEqual(caughtError.status, 400);
    assertEqual(caughtError.message, 'Dữ liệu đầu vào không hợp lệ');
    assert(Array.isArray(caughtError.errors), 'Validation errors array must exist');
    assertEqual(caughtError.errors.length, 2);
    assertEqual(caughtError.errors[0].field, 'email');
  });

  await test('Error Normalization', 'Normalizes HTML or non-JSON 500 server crashes into ApiError', async () => {
    setupMockFetch(async () => {
      return new Response('<html><body>500 Internal Server Error (Database Crash)</body></html>', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'text/html' },
      });
    });

    let caughtError: any;
    try {
      await apiClient.get('/rooms');
    } catch (err) {
      caughtError = err;
    }
    restoreFetch();

    assert(caughtError instanceof ApiError, 'HTML error should still result in ApiError');
    assertEqual(caughtError.status, 500);
    assert(caughtError.message.includes('Internal Server Error') || caughtError.message.includes('Lỗi'), `Unexpected message: ${caughtError.message}`);
    assert(typeof caughtError.data === 'string', 'Raw HTML data should be attached to error');
  });

  // ---------------------------------------------------------------------------
  // SECTION 4: 401 ERROR HANDLING, REFRESH ROTATION & CONCURRENCY QUEUE LOCKING
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 4: 401 Error Handling, Refresh & Concurrency ---');

  await test('401 Refresh', 'Refreshes token and retries request successfully on 401', async () => {
    setupBrowserEnv();
    mockStorage.setItem(auth.TOKEN_KEY, 'stale_access_token');
    mockStorage.setItem(auth.REFRESH_TOKEN_KEY, 'valid_refresh_token');

    let originalCallCount = 0;
    let refreshCallCount = 0;
    let retriedWithNewToken = false;

    setupMockFetch(async (url, init) => {
      const headers = init?.headers as Record<string, string>;

      if (url.includes('/auth/refresh')) {
        refreshCallCount++;
        return new Response(JSON.stringify({
          success: true,
          data: { token: 'refreshed_access_token_999', refreshToken: 'rotated_refresh_token_888' },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/properties/my')) {
        originalCallCount++;
        if (headers['Authorization'] === 'Bearer stale_access_token') {
          return new Response(JSON.stringify({ message: 'Token expired' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        if (headers['Authorization'] === 'Bearer refreshed_access_token_999') {
          retriedWithNewToken = true;
          return new Response(JSON.stringify({ success: true, data: [{ id: 'p1', name: 'Nhà trọ Bình Thạnh' }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response('Not found', { status: 404 });
    });

    const result = await apiClient.properties.getMyProperties();
    restoreFetch();

    assertEqual(refreshCallCount, 1, 'Refresh should be called once');
    assertEqual(originalCallCount, 2, 'Original endpoint should be called twice (initial + retry)');
    assert(retriedWithNewToken, 'Retry should have carried the new refreshed token');
    assertEqual(result[0].id, 'p1');

    // Storage should be updated with new tokens
    assertEqual(mockStorage.getItem(auth.TOKEN_KEY), 'refreshed_access_token_999');
    assertEqual(mockStorage.getItem(auth.REFRESH_TOKEN_KEY), 'rotated_refresh_token_888');

    teardownBrowserEnv();
  });

  await test('401 Refresh', 'Does NOT attempt refresh on 401 from /auth/login (bad credentials)', async () => {
    setupBrowserEnv();
    mockStorage.setItem(auth.REFRESH_TOKEN_KEY, 'some_refresh_token');

    let refreshCalled = false;
    setupMockFetch(async (url) => {
      if (url.includes('/auth/refresh')) {
        refreshCalled = true;
        return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
      }
      if (url.includes('/auth/login')) {
        return new Response(JSON.stringify({ success: false, message: 'Sai tài khoản hoặc mật khẩu' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not found', { status: 404 });
    });

    let caughtError: any;
    try {
      await apiClient.auth.login({ email: 'bad@login.local', password: 'wrong' });
    } catch (e) {
      caughtError = e;
    }
    restoreFetch();
    teardownBrowserEnv();

    assertEqual(refreshCalled, false, 'Refresh must never be called on login 401');
    assert(caughtError instanceof ApiError);
    assertEqual(caughtError.status, 401);
    assertEqual(caughtError.message, 'Sai tài khoản hoặc mật khẩu');
  });

  await test('401 Refresh Concurrency', 'STRESS TEST: 20 concurrent 401 requests trigger EXACTLY 1 refresh call and all retry cleanly', async () => {
    setupBrowserEnv();
    mockStorage.setItem(auth.TOKEN_KEY, 'stale_token_concurrent');
    mockStorage.setItem(auth.REFRESH_TOKEN_KEY, 'valid_refresh_concurrent');

    let refreshCallCount = 0;
    let initial401Count = 0;
    let successfulRetryCount = 0;

    setupMockFetch(async (url, init) => {
      const headers = init?.headers as Record<string, string>;

      if (url.includes('/auth/refresh')) {
        refreshCallCount++;
        // Simulate network delay for refresh
        await new Promise((r) => setTimeout(r, 50));
        return new Response(JSON.stringify({
          success: true,
          data: { token: 'new_concurrent_token_777', refreshToken: 'new_concurrent_refresh_666' },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/rooms/amenities')) {
        if (headers['Authorization'] === 'Bearer stale_token_concurrent') {
          initial401Count++;
          return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        if (headers['Authorization'] === 'Bearer new_concurrent_token_777') {
          successfulRetryCount++;
          return new Response(JSON.stringify({ success: true, data: [{ id: 'a1', name: 'Wifi' }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response('Not found', { status: 404 });
    });

    // Launch 20 simultaneous requests
    const promises = Array.from({ length: 20 }, () =>
      request('/rooms/amenities', { skipAuth: false })
    );

    const outcomes = await Promise.all(promises);
    restoreFetch();
    teardownBrowserEnv();

    assertEqual(refreshCallCount, 1, `CRITICAL: Token refresh must be executed EXACTLY ONCE for concurrent requests, but was executed ${refreshCallCount} times!`);
    assertEqual(initial401Count, 20, 'All 20 requests should have experienced 401 initially');
    assertEqual(successfulRetryCount, 20, 'All 20 requests should have retried with the refreshed token');
    assertEqual(outcomes.length, 20, 'All 20 requests should resolve successfully');
  });

  await test('401 Refresh Failure', 'Clears session and redirects to /login when token refresh fails (401 on refresh endpoint)', async () => {
    setupBrowserEnv();
    mockStorage.setItem(auth.TOKEN_KEY, 'stale_token');
    mockStorage.setItem(auth.REFRESH_TOKEN_KEY, 'revoked_refresh_token');

    setupMockFetch(async (url) => {
      if (url.includes('/auth/refresh')) {
        return new Response(JSON.stringify({ success: false, message: 'Refresh token expired or revoked' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    let caughtError: any;
    try {
      await apiClient.properties.getMyProperties();
    } catch (e) {
      caughtError = e;
    }
    restoreFetch();

    assert(caughtError instanceof ApiError);
    assertEqual(caughtError.status, 401);
    assertEqual(mockStorage.getItem(auth.TOKEN_KEY), null, 'Access token should be cleared on refresh failure');
    assertEqual(mockStorage.getItem(auth.REFRESH_TOKEN_KEY), null, 'Refresh token should be cleared on refresh failure');
    assertEqual((globalThis as any).__lastReplacedUrl, '/login', 'User should be redirected to /login');

    teardownBrowserEnv();
  });

  await test('401 Infinite Retry Loop Prevention', 'Does NOT attempt refresh again if retried request still returns 401', async () => {
    setupBrowserEnv();
    mockStorage.setItem(auth.TOKEN_KEY, 'stale_token');
    mockStorage.setItem(auth.REFRESH_TOKEN_KEY, 'valid_refresh');

    let refreshCallCount = 0;
    setupMockFetch(async (url) => {
      if (url.includes('/auth/refresh')) {
        refreshCallCount++;
        return new Response(JSON.stringify({
          success: true,
          data: { token: 'new_token', refreshToken: 'new_refresh' },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // Server always rejects with 401 even after retry
      return new Response(JSON.stringify({ message: 'Still forbidden' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    let caughtError: any;
    try {
      await apiClient.get('/protected-route');
    } catch (e) {
      caughtError = e;
    }
    restoreFetch();
    teardownBrowserEnv();

    assertEqual(refreshCallCount, 1, 'Refresh should only be called once; skipAutoRefresh must prevent infinite loop');
    assert(caughtError instanceof ApiError);
    assertEqual(caughtError.status, 401);
  });

  await test('401 Refresh Failure', 'Handles network exception during token refresh cleanly without unhandled rejection', async () => {
    setupBrowserEnv();
    mockStorage.setItem(auth.TOKEN_KEY, 'stale_token');
    mockStorage.setItem(auth.REFRESH_TOKEN_KEY, 'valid_refresh');

    setupMockFetch(async (url) => {
      if (url.includes('/auth/refresh')) {
        throw new Error('ECONNREFUSED: Server offline during refresh');
      }
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    let caughtError: any;
    try {
      await apiClient.get('/rooms/my');
    } catch (e) {
      caughtError = e;
    }
    restoreFetch();
    teardownBrowserEnv();

    assert(caughtError instanceof ApiError, 'Should catch network failure and throw 401 ApiError');
    assertEqual(caughtError.status, 401);
  });

  await test('401 POST Retry', 'Preserves POST method and JSON payload when retrying after 401 token refresh', async () => {
    setupBrowserEnv();
    mockStorage.setItem(auth.TOKEN_KEY, 'expired_token');
    mockStorage.setItem(auth.REFRESH_TOKEN_KEY, 'valid_refresh');

    let retriedMethod = '';
    let retriedBody = '';

    setupMockFetch(async (url, init) => {
      const headers = init?.headers as Record<string, string>;

      if (url.includes('/auth/refresh')) {
        return new Response(JSON.stringify({
          success: true,
          data: { token: 'new_post_token', refreshToken: 'new_post_refresh' },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (url.includes('/appointments')) {
        if (headers['Authorization'] === 'Bearer expired_token') {
          return new Response(JSON.stringify({ message: 'Token expired' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (headers['Authorization'] === 'Bearer new_post_token') {
          retriedMethod = init?.method || '';
          retriedBody = String(init?.body || '');
          return new Response(JSON.stringify({
            success: true,
            data: { id: 'apt-1', status: 'PENDING' },
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }

      return new Response('Not found', { status: 404 });
    });

    const payload = { roomId: 'room-1', viewingTime: '2026-11-10T10:00:00Z', note: 'Xem phòng sáng' };
    const result = await apiClient.appointments.create(payload as any);
    restoreFetch();
    teardownBrowserEnv();

    assertEqual(retriedMethod, 'POST', 'Retried request must preserve POST method');
    assertEqual(retriedBody, JSON.stringify(payload), 'Retried request must preserve exact JSON payload');
    assertEqual((result as any).id, 'apt-1');
  });

  await test('HTTP Errors', 'Throws ApiError with status 403 on Forbidden responses', async () => {
    setupMockFetch(async () => {
      return new Response(JSON.stringify({ success: false, message: 'Bạn không có quyền thực hiện thao tác này' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    let caughtError: any;
    try {
      await apiClient.admin.getPendingPosts();
    } catch (e) {
      caughtError = e;
    }
    restoreFetch();

    assert(caughtError instanceof ApiError);
    assertEqual(caughtError.status, 403);
    assertEqual(caughtError.message, 'Bạn không có quyền thực hiện thao tác này');
  });

  await test('HTTP Errors', 'Throws ApiError with status 404 on Not Found responses', async () => {
    setupMockFetch(async () => {
      return new Response(JSON.stringify({ success: false, message: 'Không tìm thấy tài nguyên yêu cầu' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    let caughtError: any;
    try {
      await apiClient.get('/rooms/non-existent-id');
    } catch (e) {
      caughtError = e;
    }
    restoreFetch();

    assert(caughtError instanceof ApiError);
    assertEqual(caughtError.status, 404);
    assertEqual(caughtError.message, 'Không tìm thấy tài nguyên yêu cầu');
  });

  // ---------------------------------------------------------------------------
  // SECTION 5: SSR VS CSR SAFETY IN CLIENT/LIB/AUTH.TS
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 5: SSR vs CSR Safety in auth.ts ---');

  await test('SSR Safety', 'All auth helpers execute safely without throwing when window is undefined (SSR mode)', async () => {
    // Ensure Node environment (window is undefined)
    teardownBrowserEnv();
    assertEqual(typeof (globalThis as any).window, 'undefined');

    assertEqual(auth.getAuthToken(), null);
    assertEqual(auth.getRefreshToken(), null);
    assertEqual(auth.getCurrentUser(), null);
    assertEqual(auth.isAuthenticated(), false);
    assertEqual(auth.getUserRole(), null);
    assertEqual(auth.hasRole(['ADMIN' as any]), false);
    assertEqual(auth.updateStoredUser({ fullName: 'Nobody' }), null);

    // Write functions should not throw in SSR
    auth.setAuthSession('tok', 'ref', { id: '1', role: 'TENANT' } as any);
    auth.setAuthTokens('tok2', 'ref2');
    auth.clearAuthSession();

    // Logout should not throw in SSR
    setupMockFetch(async () => new Response(JSON.stringify({ success: true })));
    await auth.logout();
    restoreFetch();
  });

  await test('CSR Session & Cookie Sync', 'Stores tokens and user in localStorage and synchronizes token to cookie', async () => {
    setupBrowserEnv();

    const mockUser: any = {
      id: 'usr-100',
      email: 'landlord@rental.local',
      fullName: 'Trần Văn Landlord',
      role: 'LANDLORD',
    };

    auth.setAuthSession('token_abc', 'refresh_xyz', mockUser);

    assertEqual(auth.getAuthToken(), 'token_abc');
    assertEqual(auth.getRefreshToken(), 'refresh_xyz');
    assertDeepEqual(auth.getCurrentUser(), mockUser);
    assertEqual(auth.isAuthenticated(), true);
    assertEqual(auth.getUserRole(), 'LANDLORD' as any);
    assertEqual(auth.hasRole(['LANDLORD' as any]), true);
    assertEqual(auth.hasRole(['ADMIN' as any]), false);

    // Verify cookie was written
    assert(mockDocumentCookie.includes('5k_access_token=token_abc'), `Cookie should contain token, got: ${mockDocumentCookie}`);
    assert(mockDocumentCookie.includes('path=/'), 'Cookie must have path=/');
    assert(mockDocumentCookie.includes('SameSite=Lax'), 'Cookie must specify SameSite=Lax');

    teardownBrowserEnv();
  });

  await test('CSR Session Update & Clear', 'Updates user profile partially and expires cookie on clear', async () => {
    setupBrowserEnv();

    const mockUser: any = {
      id: 'usr-100',
      email: 'tenant@rental.local',
      fullName: 'Nguyễn Văn Tenant',
      role: 'TENANT',
      phoneNumber: '0912345678',
    };

    auth.setAuthSession('token_1', 'refresh_1', mockUser);
    const updated = auth.updateStoredUser({ fullName: 'Nguyễn Văn Tenant Đã Đổi Tên' });

    assertEqual(updated?.fullName, 'Nguyễn Văn Tenant Đã Đổi Tên');
    assertEqual(auth.getCurrentUser()?.fullName, 'Nguyễn Văn Tenant Đã Đổi Tên');
    assertEqual(auth.getCurrentUser()?.email, 'tenant@rental.local', 'Unchanged fields should be preserved');

    // Clear session
    auth.clearAuthSession();

    assertEqual(auth.getAuthToken(), null);
    assertEqual(auth.getRefreshToken(), null);
    assertEqual(auth.getCurrentUser(), null);
    assertEqual(auth.isAuthenticated(), false);

    // Cookie must be expired
    assert(mockDocumentCookie.includes('expires=Thu, 01 Jan 1970 00:00:00 GMT'), 'Cookie deletion must set expires in 1970');

    teardownBrowserEnv();
  });

  await test('CSR Resilience', 'Gracefully handles corrupted JSON in localStorage without throwing', async () => {
    setupBrowserEnv();
    mockStorage.setItem(auth.USER_KEY, '{ invalid_json_syntax: true, missing_quotes');

    const user = auth.getCurrentUser();
    assertEqual(user, null, 'Corrupted JSON should return null instead of crashing');

    teardownBrowserEnv();
  });

  await test('CSR Resilience', 'Gracefully catches QuotaExceeded or disabled localStorage without crashing app', async () => {
    setupBrowserEnv();
    mockStorage.shouldThrow = true;

    // None of these should throw uncaught errors
    assertEqual(auth.getAuthToken(), null);
    assertEqual(auth.getRefreshToken(), null);
    assertEqual(auth.getCurrentUser(), null);
    auth.setAuthSession('tok', 'ref', { id: '1' } as any);
    auth.setAuthTokens('tok', 'ref');
    auth.clearAuthSession();
    assertEqual(auth.updateStoredUser({ fullName: 'test' }), null);

    teardownBrowserEnv();
  });

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log('                          STRESS TEST SUITE RESULTS');
  console.log('================================================================================');

  const passedCount = results.filter((r) => r.status === 'PASS').length;
  const failedCount = results.filter((r) => r.status === 'FAIL').length;
  const totalCount = results.length;

  console.log(`Total Executed: ${totalCount} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log(`Pass Rate: ${((passedCount / totalCount) * 100).toFixed(2)}%\n`);

  if (failedCount > 0) {
    console.error('FAILED TESTS:');
    results.filter((r) => r.status === 'FAIL').forEach((r) => {
      console.error(`  - [${r.category}] ${r.name}: ${r.error}`);
    });
  } else {
    console.log('STATUS: ALL EMPIRICAL ADVERSARIAL STRESS TESTS PASSED!');
  }
  console.log('================================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('FATAL HARNESS ERROR:', err);
  process.exit(1);
});
