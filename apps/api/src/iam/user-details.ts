import { createHash } from 'node:crypto';
export function userDetailsRevision(user: {
  id: string;
  displayName: string;
  updatedAt: Date;
  profile?: { organizationUnitId: string | null } | null;
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        id: user.id,
        displayName: user.displayName,
        updatedAt: user.updatedAt.toISOString(),
        organizationUnitId: user.profile?.organizationUnitId ?? null,
      }),
    )
    .digest('hex');
}
