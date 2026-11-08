import type { AuthenticatedActor } from '@nora/contracts';
export function canEditAttendance(
  actor: AuthenticatedActor,
  username?: string,
): boolean {
  return (
    actor.permissions.includes('hr.manage') &&
    ['demo', 'nima'].includes(username?.toLowerCase() ?? '')
  );
}
