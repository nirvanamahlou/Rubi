import { readB2bAccessSnapshot } from '../b2b/b2b-access-snapshot.public';
import { createHash } from 'node:crypto';
import type { DatabaseClient } from '@nora/database';
import {
  B2B_DOSSIER_SECTIONS,
  MANUAL_ACCESS_VERSION,
  MANUAL_NEW_PERMISSIONS,
  PORTAL_SECTION_PERMISSIONS,
  USER_ACCESS_SCREENS,
  USER_ACCESS_DENY_CONTROLS,
} from '@nora/contracts';
import {
  manualUserInclude,
  persistManualSnapshot,
} from './manual-user-access.service';
import {
  manualAccessSelection,
  previewManualConversion,
} from './manual-access-policy';

export async function planManualAccessMigration(db: DatabaseClient) {
  const users = await db.user.findMany({
    orderBy: { id: 'asc' },
    include: manualUserInclude,
  });
  const rows = await Promise.all(
    users.map(async (user) => ({
      userId: user.id,
      ...previewManualConversion({
        ...user,
        b2bOrganizationUser: await readB2bAccessSnapshot(db, user.id),
      }),
    })),
  );
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        version: MANUAL_ACCESS_VERSION,
        screens: USER_ACCESS_SCREENS.map((s) => s.id),
        controls: USER_ACCESS_DENY_CONTROLS.map((c) => c.id),
        rows,
      }),
    )
    .digest('hex');
  return { version: MANUAL_ACCESS_VERSION, fingerprint, rows };
}

/** All accounts convert atomically; stale previews and failed equivalence abort the entire batch. */
export async function applyManualAccessMigration(
  db: DatabaseClient,
  expectedFingerprint: string,
) {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('iam-administrator-membership'))::text`;
      const plan = await planManualAccessMigration(tx as DatabaseClient);
      if (plan.fingerprint !== expectedFingerprint)
        throw new Error('STALE_MANUAL_ACCESS_PREVIEW');
      for (const [code, name] of [
        ...MANUAL_NEW_PERMISSIONS,
        ...PORTAL_SECTION_PERMISSIONS.map(
          (code) =>
            [
              code,
              B2B_DOSSIER_SECTIONS.find(
                (s) => code === `b2b.portal.section.${s.id}`,
              )?.label ?? code,
            ] as const,
        ),
      ])
        await tx.permission.upsert({
          where: { code },
          update: { name },
          create: { code, name, module: code.split('.')[0]! },
        });
      let converted = 0;
      for (const row of plan.rows) {
        if (row.alreadyManual) continue;
        await persistManualSnapshot(
          tx,
          row.userId,
          'دسترسی دستی',
          row.selection,
        );
        const user = await tx.user.findUniqueOrThrow({
          where: { id: row.userId },
          include: manualUserInclude,
        });
        const actual = manualAccessSelection(user);
        if (JSON.stringify(actual) !== JSON.stringify(row.selection))
          throw new Error('MANUAL_ACCESS_EQUIVALENCE_FAILED');
        await tx.auditEvent.create({
          data: {
            actorUserId: null,
            action: 'iam.user.manual_access.migrate',
            entityType: 'User',
            entityId: row.userId,
            outcome: 'SUCCESS',
            metadata: {
              workItem: 'MANUAL-USER-ACCESS-V3-1012',
              version: MANUAL_ACCESS_VERSION,
              previousRevision: row.revision,
              before: { ...row.selection },
              after: { ...actual },
            },
          },
        });
        converted++;
      }
      return {
        version: MANUAL_ACCESS_VERSION,
        converted,
        unchanged: plan.rows.length - converted,
        equivalent: true,
      };
    },
    { isolationLevel: 'Serializable', timeout: 180000 },
  );
}
