import type { DatabaseClient } from '@nora/database';

/** IAM-owned display references for IDs already authorized by the source owner. */
export async function reportingIdentityLabels(
  client: DatabaseClient,
  branchIds: readonly string[],
  userIds: readonly string[],
) {
  const [branches, users] = await Promise.all([
    client.branch.findMany({
      where: { id: { in: [...new Set(branchIds)] } },
      select: { id: true, name: true },
    }),
    client.user.findMany({
      where: { id: { in: [...new Set(userIds)] } },
      select: { id: true, displayName: true },
    }),
  ]);
  return {
    branches: new Map(branches.map((row) => [row.id, row.name])),
    users: new Map(users.map((row) => [row.id, row.displayName])),
  };
}
