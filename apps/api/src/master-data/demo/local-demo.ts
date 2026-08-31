import { ConfigService } from '@nestjs/config';
import type { AuthenticatedActor } from '@rubi/contracts';
import { createDatabaseClient, type DatabaseClient } from '@rubi/database';
import type { DatabaseService } from '../../database/database.service';
import { MasterDataContactCrypto } from '../master-data-contact.crypto';
import { MasterDataRepository } from '../master-data.repository';
import { MasterDataService } from '../master-data.service';
import {
  DEMO_PREFIX,
  masterDataDemoRecords,
  type DemoResource,
} from './demo-data';
import {
  REALISTIC_DEMO_REVISION,
  realisticMasterDataDemoRecords,
} from './realistic-demo-data';

// Offline fixture attribution only. No IAM user, permission, session or token is created.
export const DEMO_ACTOR_ID = 'f0000000-0000-4000-8000-000000000001';
const actor: AuthenticatedActor = {
  userId: DEMO_ACTOR_ID,
  sessionId: 'f0000000-0000-4000-8000-000000000002',
  branchIds: ['f0000000-0000-4000-8000-000000000003'],
  permissions: [
    'master_data.read',
    'master_data.create',
    'master_data.update',
    'master_data.status.manage',
  ],
};

export function assertLocalDemoTarget(
  databaseUrl: string,
  environment: string,
) {
  const url = new URL(databaseUrl);
  if (
    url.hash ||
    [...url.searchParams].some(
      ([key, value]) => key !== 'schema' || value !== 'public',
    )
  )
    throw new Error('Connection overrides are not permitted for demo data.');
  if (environment !== 'development' && environment !== 'test')
    throw new Error('Demo data is restricted to development/test.');
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.port !== '55432' ||
    !/^\/(?:rubi|rubi_md_demo_test_[a-f0-9]{32})$/.test(url.pathname)
  )
    throw new Error(
      'Only the explicitly named local Rubi database is allowed.',
    );
}

export type DemoReport = {
  applied: boolean;
  created: number;
  reused: number;
  refreshed: number;
  records: { key: string; resource: DemoResource; id: string }[];
};
class PreviewRollback extends Error {
  constructor(readonly report: DemoReport) {
    super('Preview rolled back');
  }
}

export async function seedLocalMasterDataDemo(input: {
  databaseUrl: string;
  environment: string;
  contactKey: string;
  apply: boolean;
  realistic?: boolean;
}): Promise<DemoReport> {
  assertLocalDemoTarget(input.databaseUrl, input.environment);
  const crypto = new MasterDataContactCrypto(
    new ConfigService({
      MASTER_DATA_IMPORT_TOKEN_KEY_BASE64: input.contactKey,
    }),
  );
  const database = createDatabaseClient(input.databaseUrl);
  try {
    return await database.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(83031, 3)`;
        // The repository's per-write transactions join this all-or-nothing batch.
        const client = new Proxy(transaction, {
          get(target, property) {
            if (property === '$transaction')
              return (
                operation: (tx: typeof transaction) => Promise<unknown>,
              ) => operation(transaction);
            return Reflect.get(target, property, target);
          },
        }) as unknown as DatabaseClient;
        const service = new MasterDataService(
          new MasterDataRepository({ client } as DatabaseService),
          crypto,
        );
        const ids = new Map<string, string>();
        const report: DemoReport = {
          applied: input.apply,
          created: 0,
          reused: 0,
          refreshed: 0,
          records: [],
        };
        const fixtures = input.realistic
          ? realisticMasterDataDemoRecords()
          : masterDataDemoRecords();
        const completedRefresh =
          input.realistic &&
          (await transaction.masterDataAuditEvent.findFirst({
            where: {
              actorUserId: DEMO_ACTOR_ID,
              action: 'master_data.demo.refresh',
              traceId: `${DEMO_PREFIX}/${REALISTIC_DEMO_REVISION}`,
            },
          }));
        // Validate the entire connected fixture set before changing any identity or relationship.
        // A user edit/deactivation means this pack is no longer disposable demo data.
        if (input.realistic && !completedRefresh) {
          for (const fixture of fixtures) {
            const marker = await transaction.masterDataAuditEvent.findFirst({
              where: {
                actorUserId: DEMO_ACTOR_ID,
                action: 'master_data.demo.seed',
                traceId: `${DEMO_PREFIX}/${fixture.key}`,
              },
            });
            if (!marker) continue;
            if (!marker.entityId || marker.resource !== fixture.resource)
              throw new Error(`Invalid demo marker: ${fixture.key}`);
            const existing = await service.detail(
              fixture.resource,
              marker.entityId,
            );
            if (
              existing.data.version !== 1 ||
              existing.data.status !== 'active'
            )
              throw new Error(
                `Demo refresh stopped: ${fixture.key} was edited; no records were changed.`,
              );
            const userEdits = await transaction.masterDataAuditEvent.count({
              where: {
                resource: fixture.resource,
                entityId: marker.entityId,
                actorUserId: { not: DEMO_ACTOR_ID },
              },
            });
            if (userEdits)
              throw new Error(
                `Demo refresh stopped: ${fixture.key} has user history; no records were changed.`,
              );
          }
        }
        for (const fixture of fixtures) {
          const traceId = `${DEMO_PREFIX}/${fixture.key}`;
          const marker = await transaction.masterDataAuditEvent.findFirst({
            where: {
              actorUserId: DEMO_ACTOR_ID,
              action: 'master_data.demo.seed',
              traceId,
            },
          });
          let id: string;
          if (marker) {
            if (!marker.entityId || marker.resource !== fixture.resource)
              throw new Error(`Invalid demo marker: ${fixture.key}`);
            // Preserve even manually edited fixtures. Never recreate a deleted one silently.
            id = (await service.detail(fixture.resource, marker.entityId)).data
              .id;
            if (input.realistic && !completedRefresh) {
              const values = fixture.values((key) => {
                const reference = ids.get(key);
                if (!reference)
                  throw new Error(`Missing demo dependency: ${key}`);
                return reference;
              });
              await service.update(fixture.resource, id, values, 1, actor);
              report.refreshed++;
            } else report.reused++;
          } else {
            const values = fixture.values((key) => {
              const reference = ids.get(key);
              if (!reference)
                throw new Error(`Missing demo dependency: ${key}`);
              return reference;
            });
            try {
              id = (await service.create(fixture.resource, values, actor)).data
                .id;
            } catch (error) {
              throw new Error(
                `Demo fixture ${fixture.key} failed: ${error instanceof Error ? error.message : 'validation failed'}`,
              );
            }
            await transaction.masterDataAuditEvent.create({
              data: {
                actorUserId: DEMO_ACTOR_ID,
                actorBranchId: actor.branchIds[0]!,
                action: 'master_data.demo.seed',
                resource: fixture.resource,
                entityId: id,
                outcome: 'SUCCESS',
                traceId,
                entityVersion: 1,
                reason:
                  'Explicit local synthetic demo seed; not an interactive user operation.',
                afterSnapshot: {
                  batch: DEMO_PREFIX,
                  key: fixture.key,
                  synthetic: true,
                },
              },
            });
            report.created++;
          }
          ids.set(fixture.key, id);
          report.records.push({
            key: fixture.key,
            resource: fixture.resource,
            id,
          });
        }
        if (input.realistic && !completedRefresh) {
          await transaction.masterDataAuditEvent.create({
            data: {
              actorUserId: DEMO_ACTOR_ID,
              actorBranchId: actor.branchIds[0]!,
              action: 'master_data.demo.refresh',
              resource: 'countries',
              outcome: 'SUCCESS',
              traceId: `${DEMO_PREFIX}/${REALISTIC_DEMO_REVISION}`,
              reason:
                'Explicit local fixture refresh; fictional businesses, no real contacts, credentials, FX rates or integrations.',
              afterSnapshot: {
                synthetic: true,
                revision: REALISTIC_DEMO_REVISION,
                refreshed: report.refreshed,
                created: report.created,
              },
            },
          });
        }
        if (!input.apply) throw new PreviewRollback(report);
        return report;
      },
      { maxWait: 10000, timeout: 120000 },
    );
  } catch (error) {
    if (error instanceof PreviewRollback) return error.report;
    throw error;
  } finally {
    await database.$disconnect();
  }
}
