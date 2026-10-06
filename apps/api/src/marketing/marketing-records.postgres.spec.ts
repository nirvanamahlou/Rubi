import { randomUUID } from 'node:crypto';

import type {
  AuthenticatedActor,
  MarketingCampaignInputV1,
} from '@nora/contracts';
import { createDatabaseClient } from '@nora/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import { MarketingRecordsService } from './marketing-records.service';

const enabled = process.env.NORA_RUN_MARKETING_POSTGRES_TESTS === '1';
const databaseUrl = process.env.DATABASE_URL ?? '';

describe.skipIf(!enabled)(
  'Marketing records PostgreSQL transaction proof',
  () => {
    if (enabled) {
      const url = new URL(databaseUrl);
      if (!['localhost', '127.0.0.1'].includes(url.hostname))
        throw new Error(
          'Marketing PostgreSQL proof requires a local CI database.',
        );
    }

    const client = createDatabaseClient(
      databaseUrl || 'postgresql://unused:unused@localhost/unused',
    );
    const service = new MarketingRecordsService({
      client,
    } as unknown as DatabaseService);
    const userId = randomUUID();
    const branchId = randomUUID();
    const suffix = randomUUID().slice(0, 8);
    const actor: AuthenticatedActor = {
      userId,
      sessionId: randomUUID(),
      branchIds: [branchId],
      permissions: ['marketing.campaign.create', 'marketing.campaign.update'],
    };
    const input = (code: string): MarketingCampaignInputV1 => ({
      internalCode: code,
      name: `کمپین تراکنش ${suffix}`,
      campaignType: 'SALES',
      objective: 'اثبات واقعی اتمی بودن تراکنش مارکتینگ',
      executionCompany: 'NIAYESH_SEIR_SAHAR',
      channels: ['SMS'],
      ownerUserId: userId,
      segmentId: null,
      salesTarget: '10000000000000000000.1250',
      targetCurrencyCode: 'IRR',
      budgetAmount: '2000.5000',
      budgetCurrencyCode: 'IRR',
      startsAt: '2099-01-01T00:00:00.000Z',
      endsAt: '2099-02-01T00:00:00.000Z',
      frequencyCap: 2,
      progressPercent: '1.2500',
      spendLines: [{ label: 'پیامک', amount: '10.1250', currencyCode: 'IRR' }],
      links: ['https://example.test/marketing-proof'],
    });

    beforeAll(async () => {
      await client.user.create({
        data: {
          id: userId,
          username: `marketing-proof-${suffix}`,
          displayName: 'Marketing PostgreSQL Proof',
          passwordHash: 'INVALID-NO-LOGIN',
        },
      });
      await client.branch.create({
        data: {
          id: branchId,
          code: `MKT-PROOF-${suffix}`,
          name: 'Marketing PostgreSQL Proof',
        },
      });
    });

    afterAll(async () => {
      await client.marketingAuditEvent.deleteMany({ where: { branchId } });
      await client.marketingCommand.deleteMany({ where: { branchId } });
      await client.marketingCampaign.deleteMany({ where: { branchId } });
      await client.branch.deleteMany({ where: { id: branchId } });
      await client.user.deleteMany({ where: { id: userId } });
      await client.$disconnect();
    });

    it('proves same-key replay and rejects altered payload in the real database', async () => {
      const key = randomUUID();
      const request = input(`MKT-REPLAY-${suffix}`.toUpperCase());
      const first = await service.createCampaign(
        request,
        actor,
        branchId,
        key,
        'postgres-replay',
      );
      const replay = await service.createCampaign(
        request,
        actor,
        branchId,
        key,
        'postgres-replay',
      );
      expect(replay).toEqual(first);
      await expect(
        service.createCampaign(
          { ...request, name: 'درخواست تغییرکرده' },
          actor,
          branchId,
          key,
          'postgres-replay',
        ),
      ).rejects.toThrow('IDEMPOTENCY_CONFLICT');
      expect(
        await client.marketingCampaign.count({
          where: { branchId, internalCode: request.internalCode },
        }),
      ).toBe(1);
      expect(
        await client.marketingCommand.count({
          where: { branchId, idempotencyKey: key },
        }),
      ).toBe(1);
      expect(
        await client.marketingAuditEvent.count({
          where: { branchId, entityId: first.data.id },
        }),
      ).toBe(1);
    });

    it('allows exactly one concurrent CAS update and one matching command/audit', async () => {
      const created = await service.createCampaign(
        input(`MKT-CAS-${suffix}`.toUpperCase()),
        actor,
        branchId,
        randomUUID(),
        'postgres-cas-create',
      );
      const update = {
        ...input(`MKT-CAS-${suffix}`.toUpperCase()),
        name: 'نسخه جدید کمپین',
        expectedVersion: created.data.version,
      };
      const outcomes = await Promise.allSettled([
        service.updateCampaign(
          created.data.id,
          update,
          actor,
          randomUUID(),
          'postgres-cas-a',
        ),
        service.updateCampaign(
          created.data.id,
          update,
          actor,
          randomUUID(),
          'postgres-cas-b',
        ),
      ]);
      expect(
        outcomes.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        outcomes.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1);
      expect(
        await client.marketingCampaign.findUniqueOrThrow({
          where: { id: created.data.id },
          select: { version: true, name: true },
        }),
      ).toEqual({ version: 2, name: 'نسخه جدید کمپین' });
      expect(
        await client.marketingCommand.count({
          where: {
            branchId,
            resultEntityId: created.data.id,
            operation: 'CAMPAIGN_UPDATE',
          },
        }),
      ).toBe(1);
      expect(
        await client.marketingAuditEvent.count({
          where: {
            branchId,
            entityId: created.data.id,
            action: 'UPDATE',
          },
        }),
      ).toBe(1);
    });

    it('rolls back entity, command and audit when the final audit insert fails', async () => {
      const key = randomUUID();
      const request = input(`MKT-ROLLBACK-${suffix}`.toUpperCase());
      await expect(
        service.createCampaign(request, actor, branchId, key, 'x'.repeat(500)),
      ).rejects.toThrow();
      expect(
        await client.marketingCampaign.count({
          where: { branchId, internalCode: request.internalCode },
        }),
      ).toBe(0);
      expect(
        await client.marketingCommand.count({
          where: { branchId, idempotencyKey: key },
        }),
      ).toBe(0);
      expect(
        await client.marketingAuditEvent.count({
          where: { branchId, traceId: 'x'.repeat(500) },
        }),
      ).toBe(0);
    });
  },
);
