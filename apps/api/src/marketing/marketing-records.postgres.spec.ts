import { randomUUID } from 'node:crypto';

import type {
  AuthenticatedActor,
  MarketingCampaignInputV1,
  MarketingAssetInputV1,
} from '@nora/contracts';
import { createDatabaseClient } from '@nora/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import { CustomerAffairsMarketingIntakeService } from '../customer-affairs/customer-affairs-marketing-intake.service';
import { MarketingRecordsService } from './marketing-records.service';
import { CustomerService } from '../customers/customer.service';
import { CustomerRepository } from '../customers/customer.repository';
import type { CustomerContactCrypto } from '../customers/customer-contact.crypto';
import type { CustomerNationalIdProtector } from '../customers/customer-national-id';
import { MasterOrganizationDirectory } from '../master-data/master-organization-directory';

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
    const database = { client } as unknown as DatabaseService;
    const customers = new CustomerService(
      new CustomerRepository(database),
      {} as CustomerContactCrypto,
      {} as CustomerNationalIdProtector,
    );
    const service = new MarketingRecordsService(
      database,
      customers,
      new MasterOrganizationDirectory(database),
    );
    const userId = randomUUID();
    const branchId = randomUUID();
    const suffix = randomUUID().slice(0, 8);
    const customerId = randomUUID();
    const agencyId = randomUUID();
    const promotionActor: AuthenticatedActor = {
      userId,
      sessionId: randomUUID(),
      branchIds: [branchId],
      permissions: [
        'marketing.read',
        'marketing.offer.manage',
        'customers.read',
        'master_data.read',
      ],
    };
    const promotion = (
      kind: 'COUPON' | 'OFFER',
      name: string,
    ): MarketingAssetInputV1 => ({
      kind,
      name: `${name}-${suffix}`,
      status: 'ACTIVE',
      scheduledAt: '2099-01-01T00:00:00.000Z',
      expiresAt: '2099-02-01T00:00:00.000Z',
      targetCustomerId: null,
      targetAgencyId: null,
      payload: {
        code: kind === 'COUPON' ? `CODE-${name}-${suffix}`.toUpperCase() : '',
        discountType: 'AMOUNT',
        value: '10000000000000000000.1250',
        currencyCode: 'IRR',
        minimumPurchase: '50.5000',
        usageLimit: 100,
        perCustomerLimit: 2,
        service: 'ALL',
        combinability: 'EXCLUSIVE',
        description: '',
      },
    });
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
      await client.customer.create({
        data: {
          id: customerId,
          kind: 'PERSON',
          firstName: 'مخاطب',
          lastName: 'آزمایشی',
          displayName: 'مخاطب آزمایشی پیشنهاد',
          ownerBranchId: branchId,
          createdByUserId: userId,
          updatedByUserId: userId,
        },
      });
      await client.customerConsent.create({
        data: {
          customerId,
          purpose: 'MARKETING',
          channel: 'ALL',
          status: 'GRANTED',
          source: 'TEST',
          reason: 'Isolated test consent',
          occurredAt: new Date(),
          recordedByUserId: userId,
        },
      });
      await client.masterOrganization.create({
        data: {
          id: agencyId,
          code: `PROMO-${suffix}`,
          legalName: 'آژانس آزمایشی',
          displayName: 'آژانس آزمایشی',
          createdByUserId: userId,
          updatedByUserId: userId,
          roles: { create: { roleCode: 'AGENCY', assignedByUserId: userId } },
        },
      });
    });

    afterAll(async () => {
      await client.customerAffairsMarketingIntake.deleteMany({
        where: { branchId },
      });
      await client.customerAffairsCommand.deleteMany({
        where: { actorUserId: userId },
      });
      await client.customerAffairsAuditEvent.deleteMany({
        where: { branchId },
      });
      await client.marketingAuditEvent.deleteMany({ where: { branchId } });
      await client.marketingCommand.deleteMany({ where: { branchId } });
      await client.marketingAsset.deleteMany({ where: { branchId } });
      await client.marketingCampaign.deleteMany({ where: { branchId } });
      await client.customerConsent.deleteMany({ where: { customerId } });
      await client.customer.deleteMany({ where: { id: customerId } });
      await client.masterOrganizationRole.deleteMany({
        where: { organizationId: agencyId },
      });
      await client.masterOrganization.deleteMany({ where: { id: agencyId } });
      await client.branch.deleteMany({ where: { id: branchId } });
      await client.user.deleteMany({ where: { id: userId } });
      await client.$disconnect();
    });

    it('pages filtered promotions without exposing another branch or deleted rows', async () => {
      const prefix = 'Pagination-' + suffix;
      const timestamp = new Date('2099-01-15T00:00:00Z');
      const records = Array.from({ length: 51 }, (_, index) => ({
        id: randomUUID(),
        branchId,
        kind: 'COUPON',
        name: prefix + '-' + index,
        status: 'ACTIVE',
        scheduledAt: new Date('2099-01-01T00:00:00Z'),
        expiresAt: new Date('2099-02-01T00:00:00Z'),
        promotionValue: '100',
        minimumPurchase: '0',
        promotionCurrencyCode: 'IRR',
        payload: { code: 'P%AGE-' + index, discountType: 'AMOUNT' },
        createdByUserId: userId,
        updatedByUserId: userId,
        updatedAt: timestamp,
      }));
      await client.marketingAsset.createMany({
        data: [
          ...records,
          {
            ...records[0]!,
            id: randomUUID(),
            name: prefix + '-deleted',
            status: 'DELETED',
          },
        ],
      });
      try {
        const query = {
          kind: 'COUPON' as const,
          status: 'ACTIVE',
          search: 'p%age',
          from: '2099-01-20',
          to: '2099-01-01',
        };
        const first = await service.listPromotions(query, promotionActor);
        const second = await service.listPromotions(
          { ...query, page: 2 },
          promotionActor,
        );
        expect(first).toMatchObject({ page: 1, hasNext: true });
        expect(second).toMatchObject({ page: 2, hasNext: false });
        expect(first.data).toHaveLength(50);
        expect(second.data).toHaveLength(1);
        expect([...first.data, ...second.data].map(({ id }) => id)).toEqual(
          records
            .map(({ id }) => id)
            .sort()
            .reverse(),
        );
        const otherBranch = await service.listPromotions(query, {
          ...promotionActor,
          branchIds: [randomUUID()],
        });
        expect(otherBranch).toEqual({ data: [], page: 1, hasNext: false });
        const past = await service.listPromotions(
          { ...query, to: '2098-12-31' },
          promotionActor,
        );
        expect(past.data).toEqual([]);
      } finally {
        await client.marketingAsset.deleteMany({
          where: { branchId, name: { startsWith: prefix } },
        });
      }
    });

    it('persists entry sources and named leads, deletes campaign audiences and campaigns with scoped replay/CAS', async () => {
      const permitted: AuthenticatedActor = {
        ...actor,
        permissions: [
          ...actor.permissions,
          'marketing.read',
          'marketing.audience.manage',
          'marketing.audience.read',
          'marketing.attribution.read',
          'customer_affairs.lead.create',
          'customer_affairs.lead.read',
        ],
      };
      const source = await service.saveAsset(
        null,
        {
          kind: 'SOURCE',
          name: `نمایشگاه-${suffix}`,
          status: 'ACTIVE',
          payload: {},
        },
        permitted,
        branchId,
        randomUUID(),
      );
      expect(
        (await service.listAssets('SOURCE', permitted)).data.map(
          (row) => row.id,
        ),
      ).toContain(source.data.id);
      const campaign = await service.createCampaign(
        input(`DELETE-${suffix}`),
        permitted,
        branchId,
        randomUUID(),
      );
      const audience = await service.saveAsset(
        null,
        {
          kind: 'AUDIENCE',
          name: `مخاطب-${suffix}`,
          status: 'ACTIVE',
          campaignId: campaign.data.id,
          payload: {},
        },
        permitted,
        branchId,
        randomUUID(),
      );
      const contactCrypto = {
        protect: () => ({
          encryptedValue: 'synthetic-test-only',
          encryptionIv: 'synthetic',
          encryptionAuthTag: 'synthetic',
          encryptionKeyVersion: 1,
          valueFingerprint: 'a'.repeat(64),
          maskedValue: '*******6789',
        }),
      } as unknown as CustomerContactCrypto;
      const intakes = new CustomerAffairsMarketingIntakeService(
        database,
        contactCrypto,
        service,
      );
      const leadInput = {
        phone: '09123456789',
        firstName: 'نام',
        lastName: 'آزمایشی',
        entryDate: '2026-11-02T20:30:00.000Z',
        sourceCategory: source.data.name,
        campaignId: campaign.data.id,
        status: 'NEW' as const,
      };
      const leadKey = randomUUID();
      const lead = await intakes.create(
        leadInput,
        permitted,
        branchId,
        leadKey,
      );
      expect((await intakes.list(permitted)).data).toContainEqual(
        expect.objectContaining({
          id: lead.data.id,
          firstName: 'نام',
          lastName: 'آزمایشی',
          entryDate: leadInput.entryDate,
          sourceCategory: source.data.name,
          maskedPhone: '*******6789',
        }),
      );
      await expect(
        intakes.create(
          { ...leadInput, firstName: 'تغییر' },
          permitted,
          branchId,
          leadKey,
        ),
      ).rejects.toThrow();
      await expect(
        service.deleteCampaign(
          campaign.data.id,
          1,
          { ...permitted, branchIds: [] },
          randomUUID(),
        ),
      ).rejects.toThrow();
      await expect(
        service.deleteCampaign(campaign.data.id, 9, permitted, randomUUID()),
      ).rejects.toThrow();
      const deleteKey = randomUUID();
      await service.deleteCampaign(campaign.data.id, 1, permitted, deleteKey);
      await service.deleteCampaign(campaign.data.id, 1, permitted, deleteKey);
      expect(
        (await service.listCampaigns(permitted)).data.map((row) => row.id),
      ).not.toContain(campaign.data.id);
      await expect(
        service.updateCampaign(
          campaign.data.id,
          { ...input('UPDATE'), expectedVersion: 2 },
          permitted,
          randomUUID(),
        ),
      ).rejects.toThrow();
      await expect(
        service.validateCampaignReference(
          campaign.data.id,
          branchId,
          permitted,
        ),
      ).rejects.toThrow();
      expect(
        await client.customerAffairsMarketingIntake.count({
          where: { id: lead.data.id },
        }),
      ).toBe(1);
      expect(
        await client.marketingAuditEvent.count({
          where: { entityId: campaign.data.id, action: 'DELETE' },
        }),
      ).toBe(1);
      await service.deleteAsset(audience.data.id, 1, permitted, randomUUID());
      expect(
        (await service.listAssets('AUDIENCE', permitted)).data.map(
          (row) => row.id,
        ),
      ).not.toContain(audience.data.id);
    }, 30000);

    it.each(['COUPON', 'OFFER'] as const)(
      'persists %s form payload and canonical audience across a new service/list read',
      async (kind) => {
        const request = {
          ...promotion(kind, `PERSIST-${kind}`),
          ...(kind === 'COUPON'
            ? { targetCustomerId: customerId }
            : { targetAgencyId: agencyId }),
        };
        const key = randomUUID();
        const first = await service.saveAsset(
          null,
          request,
          promotionActor,
          branchId,
          key,
        );
        const stored = await client.marketingAsset.findUniqueOrThrow({
          where: { id: first.data.id },
        });
        expect(stored.promotionValue?.toFixed(4)).toBe(
          '10000000000000000000.1250',
        );
        expect(stored.minimumPurchase?.toFixed(4)).toBe('50.5000');
        expect(stored.targetCustomerId).toBe(
          kind === 'COUPON' ? customerId : null,
        );
        expect(stored.targetAgencyId).toBe(kind === 'OFFER' ? agencyId : null);
        const reloaded = new MarketingRecordsService(
          database,
          customers,
          new MasterOrganizationDirectory(database),
        );
        expect(
          (await reloaded.listAssets(kind, promotionActor)).data,
        ).toContainEqual(first.data);
        expect(
          await service.saveAsset(null, request, promotionActor, branchId, key),
        ).toEqual(first);
        await expect(
          service.saveAsset(
            null,
            { ...request, name: 'Changed' },
            promotionActor,
            branchId,
            key,
          ),
        ).rejects.toMatchObject({ status: 409 });
        expect(
          await client.marketingAsset.count({ where: { id: stored.id } }),
        ).toBe(1);
      },
    );
    it('updates/deletes offers with CAS and omits deleted rows from reload', async () => {
      const request = promotion('OFFER', 'CAS');
      const created = await service.saveAsset(
        null,
        request,
        promotionActor,
        branchId,
        randomUUID(),
      );
      const update = {
        ...request,
        name: 'پیشنهاد ویرایش‌شده',
        expectedVersion: created.data.version,
      };
      const results = await Promise.allSettled([
        service.saveAsset(
          created.data.id,
          update,
          promotionActor,
          undefined,
          randomUUID(),
        ),
        service.saveAsset(
          created.data.id,
          update,
          promotionActor,
          undefined,
          randomUUID(),
        ),
      ]);
      expect(
        results.filter((item) => item.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(results.filter((item) => item.status === 'rejected')).toHaveLength(
        1,
      );
      const current = (
        await service.listAssets('OFFER', promotionActor)
      ).data.find((item) => item.id === created.data.id)!;
      expect(current.name).toBe(update.name);
      expect(current.version).toBe(2);
      await expect(
        service.deleteAsset(current.id, 1, promotionActor, randomUUID()),
      ).rejects.toMatchObject({ status: 409 });
      const key = randomUUID();
      const removed = await service.deleteAsset(
        current.id,
        current.version,
        promotionActor,
        key,
      );
      expect(removed.data.status).toBe('DELETED');
      await expect(
        service.saveAsset(
          current.id,
          {
            ...promotion('OFFER', 'REVIVE'),
            expectedVersion: removed.data.version,
          },
          promotionActor,
          branchId,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        await service.deleteAsset(
          current.id,
          current.version,
          promotionActor,
          key,
        ),
      ).toEqual(removed);
      expect(
        (await service.listAssets('OFFER', promotionActor)).data.some(
          (item) => item.id === current.id,
        ),
      ).toBe(false);
    });
    it('rejects invalid references, duplicate code, invalid rules and denied writes without inserting a record', async () => {
      const request = promotion('COUPON', 'INVALID');
      await expect(
        service.saveAsset(
          null,
          request,
          { ...promotionActor, permissions: ['marketing.read'] },
          branchId,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.saveAsset(
          null,
          { ...request, targetCustomerId: randomUUID() },
          promotionActor,
          branchId,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        service.saveAsset(
          null,
          { ...request, targetAgencyId: randomUUID() },
          promotionActor,
          branchId,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        service.saveAsset(
          null,
          {
            ...request,
            targetCustomerId: customerId,
            targetAgencyId: agencyId,
          },
          promotionActor,
          branchId,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        service.saveAsset(
          null,
          {
            ...request,
            payload: {
              ...request.payload,
              discountType: 'PERCENT',
              value: '101',
            },
          },
          promotionActor,
          branchId,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ status: 400 });
      const key = randomUUID();
      await expect(
        service.saveAsset(
          null,
          request,
          promotionActor,
          branchId,
          key,
          'x'.repeat(500),
        ),
      ).rejects.toThrow();
      expect(
        await client.marketingAsset.count({
          where: { branchId, name: request.name },
        }),
      ).toBe(0);
      expect(
        await client.marketingCommand.count({
          where: { branchId, idempotencyKey: key },
        }),
      ).toBe(0);
      await service.saveAsset(
        null,
        request,
        promotionActor,
        branchId,
        randomUUID(),
      );
      await expect(
        service.saveAsset(
          null,
          { ...request, name: 'عنوان دیگر با همان کد' },
          promotionActor,
          branchId,
          randomUUID(),
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        await client.marketingAsset.count({
          where: {
            branchId,
            kind: 'COUPON',
            payload: { path: ['code'], equals: String(request.payload.code) },
          },
        }),
      ).toBe(1);
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
      const alteredPayloadError = await service
        .createCampaign(
          { ...request, name: 'درخواست تغییرکرده' },
          actor,
          branchId,
          key,
          'postgres-replay',
        )
        .catch((error: unknown) => error);
      expect(alteredPayloadError).toMatchObject({
        response: expect.objectContaining({ code: 'IDEMPOTENCY_CONFLICT' }),
        status: 409,
      });
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
            action: 'UPDATE_DECLARATIONS',
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
