import type { AuthenticatedActor } from '@nora/contracts';
/** Stable IAM identity, configured per environment. Missing configuration denies access. */
export function canEditAttendance(
  actor: AuthenticatedActor,
  userId = process.env.HR_MANUAL_ATTENDANCE_USER_ID,
): boolean {
  return Boolean(
    userId &&
    actor.userId === userId &&
    actor.permissions.includes('hr.manage'),
  );
}
