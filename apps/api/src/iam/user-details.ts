import { createHash } from 'node:crypto';
export function userDetailsRevision(user: {
  id: string;
  displayName: string;
  updatedAt: Date;
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        id: user.id,
        displayName: user.displayName,
        updatedAt: user.updatedAt.toISOString(),
      }),
    )
    .digest('hex');
}
