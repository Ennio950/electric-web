import { describe, expect, it, vi } from 'vitest';
import {
  buildPortalUrl,
  clearPortalSessionMetadata,
  getHostOrigin,
  getReturnToPath,
  normalizePortalRole,
  validatePortalAccess,
} from '../src/app/portalAccess';

describe('portalAccess', () => {
  it('normalizes allowed roles only', () => {
    expect(normalizePortalRole('EMPLOYEE')).toBe('employee');
    expect(normalizePortalRole('client')).toBeNull();
  });

  it('accepts a trusted hostOrigin from search params', () => {
    expect(getHostOrigin('?hostOrigin=http://127.0.0.1:8081/foo', 'http://127.0.0.1:5174')).toBe(
      'http://127.0.0.1:8081',
    );
  });

  it('rejects an untrusted remote hostOrigin from search params', () => {
    expect(getHostOrigin('?hostOrigin=https://evil.example', 'https://builder.example')).toBe(
      'https://builder.example',
    );
  });

  it('accepts same-host deployments with a different port', () => {
    expect(getHostOrigin('?hostOrigin=https://builder.example:8443', 'https://builder.example')).toBe(
      'https://builder.example:8443',
    );
  });

  it('builds login urls with returnTo', () => {
    expect(buildPortalUrl('http://127.0.0.1:8081', 'login-empleado.html', 'builder-react/dist/index.html#/')).toBe(
      'http://127.0.0.1:8081/login-empleado.html?returnTo=builder-react%2Fdist%2Findex.html%23%2F',
    );
  });

  it('detects returnTo only for built builder paths', () => {
    expect(getReturnToPath('/builder-react/dist/index.html')).toBe('builder-react/dist/index.html#/');
    expect(getReturnToPath('/')).toBe('');
  });

  it('validates session against backend role endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const result = await validatePortalAccess({
      fetchImpl,
      hostOrigin: 'http://127.0.0.1:8081',
      session: {
        role: 'employee',
        authAt: Date.now(),
      },
    });

    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:8081/api/employee/me', {
      credentials: 'include',
      method: 'GET',
    });
    expect(result).toEqual({
      allowed: true,
      reason: 'ok',
      role: 'employee',
    });
  });

  it('clears stale storage when the session expires', async () => {
    const storage = {
      removeItem: vi.fn(),
    };

    const result = await validatePortalAccess({
      fetchImpl: vi.fn(),
      hostOrigin: 'http://127.0.0.1:8081',
      storage,
      session: {
        role: 'employee',
        authAt: 1,
      },
      now: 1000 * 60 * 60 * 24 * 8,
    });

    expect(result).toEqual({
      allowed: false,
      reason: 'expired',
      role: 'employee',
    });
    expect(storage.removeItem).toHaveBeenCalledTimes(2);
  });

  it('exposes a helper to clear stored metadata', () => {
    const storage = {
      removeItem: vi.fn(),
    };

    clearPortalSessionMetadata(storage);

    expect(storage.removeItem).toHaveBeenNthCalledWith(1, 'swe:portalRole');
    expect(storage.removeItem).toHaveBeenNthCalledWith(2, 'swe:portalAuthAt');
  });
});
