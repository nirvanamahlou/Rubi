import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseClient } from '@nora/database';

const accounts = [
  ['danial', 'NORA_DANIAL_BUSINESS_READ_USER_ID'],
  ['demo', 'NORA_DEMO_BUSINESS_READ_USER_ID'],
] as const;
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

/** Only for Nora's authenticated, explicitly read-only business projections. */
export async function hasNoraGlobalBusinessRead(
  client: Pick<DatabaseClient, 'user'>,
  actor: AuthenticatedActor,
  configuration: NodeJS.ProcessEnv = process.env,
) {
  const account = accounts.find(([, key]) => {
    const id = configuration[key]?.trim();
    return id && uuid.test(id) && id.toLowerCase() === actor.userId;
  });
  if (!account) return false;
  const user = await client.user.findFirst({
    where: { id: actor.userId, username: account[0], status: 'ACTIVE' },
    select: { id: true },
  });
  return user?.id === actor.userId;
}

/** Historical operational reads include branches that are no longer active. */
export async function noraBusinessReadBranchIds(
  client: Pick<DatabaseClient, 'branch'>,
) {
  return (await client.branch.findMany({ select: { id: true } })).map(
    ({ id }) => id,
  );
}
