import { afterEach, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { canEditAttendance } from './hr-manual-attendance-policy';
import { HrService } from './hr.service';
const actor: AuthenticatedActor = {
  userId: 'allowed-user',
  sessionId: 'session',
  branchIds: [],
  permissions: ['hr.manage', 'hr.approve'],
};
afterEach(() => vi.unstubAllEnvs());
it('fails closed unless the exact configured HR account is authenticated', () => {
  expect(canEditAttendance(actor, '')).toBe(false);
  expect(canEditAttendance(actor, 'another-user')).toBe(false);
  expect(canEditAttendance({ ...actor, permissions: [] }, actor.userId)).toBe(
    false,
  );
  expect(canEditAttendance(actor, actor.userId)).toBe(true);
});
it('rejects an unauthorized manual correction before reading or writing records', async () => {
  vi.stubEnv('HR_MANUAL_ATTENDANCE_USER_ID', 'another-user');
  const database = { client: { hrRecord: { findUnique: vi.fn() } } };
  const service = new HrService(
    database as never,
    {} as never,
    {} as never,
    {} as never,
  );
  await expect(service.editAttendance('id', {}, 'key', actor)).rejects.toThrow(
    'ویرایش دستی',
  );
  expect(database.client.hrRecord.findUnique).not.toHaveBeenCalled();
});
