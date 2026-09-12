import { describe, expect, it, vi } from 'vitest';
import type { LoginResponse } from '@rubi/contracts';
import {
  passwordChangeError,
  passwordChangeAvailable,
  submitPasswordChange,
} from './password-change-api';
const oldPassword = 'Old-Fixture-123!';
const nextPassword = 'New-Fixture-456!';
function dependencies(status = 204, code?: string) {
  return {
    baseUrl: 'https://fixture.invalid/api/v1',
    refresh: vi
      .fn()
      .mockResolvedValue({ user: { id: 'self' } } as LoginResponse),
    fetchImpl: vi
      .fn()
      .mockResolvedValue(
        new Response(
          status === 204 ? null : JSON.stringify({ error: { code } }),
          { status },
        ),
      ),
    clearSession: vi.fn(),
  };
}
describe('password change consumer', () => {
  it('keeps credential collection unavailable until the authenticated service confirms readiness', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 404 }));
    expect(
      await passwordChangeAvailable(
        'https://fixture.invalid/api/v1',
        fetchImpl,
      ),
    ).toBe(false);
    fetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ available: true }), { status: 200 }),
    );
    expect(
      await passwordChangeAvailable(
        'https://fixture.invalid/api/v1',
        fetchImpl,
      ),
    ).toBe(true);
    fetchImpl.mockRejectedValue(new Error('offline'));
    expect(
      await passwordChangeAvailable(
        'https://fixture.invalid/api/v1',
        fetchImpl,
      ),
    ).toBe(false);
  });
  it('validates policy, unchanged value and confirmation without trimming passwords', () => {
    expect(
      passwordChangeError(oldPassword, nextPassword, nextPassword),
    ).toBeNull();
    expect(
      passwordChangeError(oldPassword, nextPassword, nextPassword + ' '),
    ).toContain('یکسان');
    expect(
      passwordChangeError(oldPassword, oldPassword, oldPassword),
    ).toContain('متفاوت');
    expect(passwordChangeError(oldPassword, 'weak', 'weak')).toContain('۱۰');
  });
  it('sends only required secrets in the authenticated body and clears identity after204', async () => {
    const deps = dependencies();
    await submitPasswordChange(oldPassword, nextPassword, 'self', deps);
    expect(deps.fetchImpl).toHaveBeenCalledOnce();
    expect(deps.fetchImpl).toHaveBeenCalledWith(
      'https://fixture.invalid/api/v1/iam/auth/change-password',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({
          currentPassword: oldPassword,
          newPassword: nextPassword,
        }),
        headers: expect.objectContaining({ 'X-Rubi-Password-Change': '1' }),
      }),
    );
    expect(deps.clearSession).toHaveBeenCalledOnce();
  });
  it('does not submit when the current account differs from the opened form', async () => {
    const deps = dependencies();
    await expect(
      submitPasswordChange(oldPassword, nextPassword, 'another', deps),
    ).rejects.toThrow('نشست');
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });
  it('does not clear session or retry incorrect-current-password failures', async () => {
    const deps = dependencies(400, 'IAM_PASSWORD_CURRENT_INVALID');
    await expect(
      submitPasswordChange(oldPassword, nextPassword, 'self', deps),
    ).rejects.toThrow('فعلی');
    expect(deps.fetchImpl).toHaveBeenCalledOnce();
    expect(deps.clearSession).not.toHaveBeenCalled();
  });
  it('reports an uncertain network outcome without retry or false success', async () => {
    const deps = dependencies();
    deps.fetchImpl.mockRejectedValue(new Error('network'));
    await expect(
      submitPasswordChange(oldPassword, nextPassword, 'self', deps),
    ).rejects.toThrow('مشخص نیست');
    expect(deps.fetchImpl).toHaveBeenCalledOnce();
    expect(deps.clearSession).not.toHaveBeenCalled();
  });
});
