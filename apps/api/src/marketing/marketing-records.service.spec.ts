import type {
  AuthenticatedActor,
  MarketingAssetInputV1,
  MarketingCampaignInputV1,
} from '@nora/contracts';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@nora/database';
import { describe, expect, it, vi } from 'vitest';

import { CustomerAffairsMarketingIntakeService } from '../customer-affairs/customer-affairs-marketing-intake.service';
import type { CustomerContactCrypto } from '../customers/customer-contact.crypto';
import type { DatabaseService } from '../database/database.service';
import { MarketingRecordsService } from './marketing-records.service';

const branchId = '33333333-3333-4333-8333-333333333333';
const userId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';

function actor(permissions: string[]): AuthenticatedActor {
  return {
    userId,
    sessionId,
    branchIds: [branchId],
    permissions: permissions as AuthenticatedActor['permissions'],
  };
}

const campaignInput: MarketingCampaignInputV1 = {
  internalCode: 'CMP-1',
  name: 'کمپین پایدار',
  campaignType: 'SALES',
  objective: 'فروش قابل اندازه‌گیری',
  executionCompany: 'NIAYESH_SEIR_SAHAR',
  channels: ['SMS'],
  ownerUserId: userId,
  segmentId: null,
  salesTarget: '1000',
  targetCurrencyCode: 'IRR',
  budgetAmount: '500',
  budgetCurrencyCode: 'IRR',
  startsAt: '2026-10-01T00:00:00.000Z',
  endsAt: '2026-10-31T00:00:00.000Z',
  frequencyCap: 2,
  progressPercent: '0',
  spendLines: [],
  links: ['https://example.test/campaign'],
};

function campaignRow(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-10-01T00:00:00.000Z');
  return {
    id: 'campaign-1',
    branchId,
    internalCode: 'CMP-1',
    name: 'کمپین پایدار',
    campaignType: 'SALES',
    objective: 'هدف',
    executionCompany: 'NIAYESH_SEIR_SAHAR',
    channels: ['SMS'],
    ownerUserId: userId,
    segmentId: null,
    salesTarget: new Prisma.Decimal(1000),
    targetCurrencyCode: 'IRR',
    budgetAmount: new Prisma.Decimal(500),
    budgetCurrencyCode: 'IRR',
    startsAt: now,
    endsAt: new Date('2026-10-31T00:00:00.000Z'),
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    frequencyCap: 2,
    progressPercent: new Prisma.Decimal(0),
    links: [],
    status: 'DRAFT',
    publicationRequestedAt: null,
    scheduledFor: null,
    version: 1,
    declaredByUserId: userId,
    declaredAt: now,
    createdAt: now,
    updatedAt: now,
    createdByUserId: userId,
    updatedByUserId: userId,
    spendLines: [],
    ...overrides,
  };
}

function service(client: Record<string, unknown>) {
  return new MarketingRecordsService({ client } as unknown as DatabaseService);
}

describe('MarketingRecordsService durable boundaries', () => {
  it('checks current permissions before any list, mutation, or replay lookup', async () => {
    const transaction = vi.fn();
    const records = service({
      $transaction: transaction,
      marketingCampaign: { findMany: vi.fn() },
      marketingAsset: { findMany: vi.fn() },
    });
    const revoked = actor([]);

    await expect(records.listCampaigns(revoked)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      records.createCampaign(campaignInput, revoked, branchId, 'key'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      records.publishCampaign('campaign-1', 1, null, revoked, 'key'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(records.listAssets(undefined, revoked)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('protects exported campaign reference validation with current attribution permissions and branch scope', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'campaign-1' });
    const records = service({ marketingCampaign: { findFirst } });
    const authorized = actor(['marketing.read', 'marketing.attribution.read']);

    await records.validateCampaignReference('campaign-1', branchId, authorized);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'campaign-1', branchId },
      select: { id: true },
    });

    await expect(
      records.validateCampaignReference(
        'campaign-1',
        branchId,
        actor(['marketing.read']),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      records.validateCampaignReference(
        'campaign-1',
        branchId,
        actor(['marketing.attribution.read']),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      records.validateCampaignReference('campaign-1', branchId, {
        ...authorized,
        branchIds: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it('forces campaign creation to DRAFT and writes command plus audit in one transaction', async () => {
    const created = campaignRow();
    const tx = {
      marketingCommand: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      userBranch: { findUnique: vi.fn().mockResolvedValue({}) },
      marketingAsset: { findFirst: vi.fn() },
      marketingCampaign: { create: vi.fn().mockResolvedValue(created) },
      marketingAuditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const transaction = vi.fn(async (work: (client: typeof tx) => unknown) =>
      work(tx),
    );
    const records = service({ $transaction: transaction });

    await records.createCampaign(
      campaignInput,
      actor(['marketing.campaign.create']),
      branchId,
      'create-key',
    );

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.marketingCampaign.create.mock.calls[0]?.[0].data.status).toBe(
      'DRAFT',
    );
    expect(tx.marketingCommand.create).toHaveBeenCalledTimes(1);
    expect(tx.marketingAuditEvent.create).toHaveBeenCalledTimes(1);
  });

  it('rejects stale CAS and a same-key request with a changed payload', async () => {
    const current = campaignRow();
    const staleTx = {
      marketingCampaign: {
        findFirst: vi.fn().mockResolvedValue(current),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      marketingCommand: { findUnique: vi.fn().mockResolvedValue(null) },
      userBranch: { findUnique: vi.fn().mockResolvedValue({}) },
      marketingAsset: { findFirst: vi.fn() },
    };
    const stale = service({
      $transaction: (work: (client: typeof staleTx) => unknown) =>
        work(staleTx),
    });
    await expect(
      stale.updateCampaign(
        'campaign-1',
        { ...campaignInput, expectedVersion: 99 },
        actor(['marketing.campaign.update']),
        'update-key',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      staleTx.marketingCampaign.updateMany.mock.calls[0]?.[0].data,
    ).not.toHaveProperty('status');

    const replayTx = {
      marketingCommand: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ requestFingerprint: 'different' }),
      },
    };
    const replay = service({
      $transaction: (work: (client: typeof replayTx) => unknown) =>
        work(replayTx),
    });
    await expect(
      replay.createCampaign(
        { ...campaignInput, name: 'درخواست دیگر' },
        actor(['marketing.campaign.create']),
        branchId,
        'same-key',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects cross-branch references before saving an asset', async () => {
    const tx = {
      marketingCommand: { findUnique: vi.fn().mockResolvedValue(null) },
      marketingCampaign: { findFirst: vi.fn().mockResolvedValue(null) },
      marketingAsset: { findFirst: vi.fn() },
    };
    const records = service({
      $transaction: (work: (client: typeof tx) => unknown) => work(tx),
    });
    await expect(
      records.saveAsset(
        null,
        {
          kind: 'FORM',
          name: 'فرم',
          status: 'DRAFT',
          campaignId: 'campaign-other-branch',
          payload: {
            type: 'LEAD',
            landingPage: 'https://example.test/form',
            completionRate: '10',
            responseCount: '2',
          },
        },
        actor(['marketing.read', 'marketing.campaign.update']),
        branchId,
        'asset-key',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each<MarketingAssetInputV1>([
    {
      kind: 'SHORT_LINK',
      name: 'لینک',
      status: 'ROOT',
      payload: {
        targetUrl: 'https://example.test',
        shortUrl: 'https://n.test/x',
        clicks: '0',
        conversions: '0',
      },
    },
    {
      kind: 'FORM',
      name: 'فرم',
      status: 'DRAFT',
      payload: {
        type: 'LEAD',
        landingPage: 'javascript:alert(1)',
        completionRate: '0',
        responseCount: '0',
      },
    },
    {
      kind: 'FORM',
      name: 'فرم',
      status: 'DRAFT',
      payload: {
        type: 'LEAD',
        landingPage: 'https://example.test',
        completionRate: '101',
        responseCount: '-1',
      },
    },
    {
      kind: 'MESSAGE',
      name: 'پیام',
      status: 'DRAFT',
      payload: { channel: 'SMS', audience: 'عمومی', body: 'تماس 09121234567' },
    },
    {
      kind: 'AUTOMATION',
      name: 'گراف',
      status: 'DRAFT',
      payload: {
        nodes: [
          { id: 'a', title: 'شروع' },
          { id: 'b', title: 'پایان' },
        ],
        edges: [
          {
            source: 'a',
            target: 'b',
            sourcePort: 'center',
            targetPort: 'left',
          },
        ],
      },
    },
    {
      kind: 'SEGMENT',
      name: 'سگمنت',
      status: 'ACTIVE',
      payload: {
        rules: [{ expression: 'status = active', phone: '09121234567' }],
      },
    },
  ])('rejects invalid typed asset payload %#', async (input) => {
    const records = service({ $transaction: vi.fn() });
    await expect(
      records.saveAsset(
        null,
        input,
        actor([
          'marketing.read',
          input.kind === 'SEGMENT'
            ? 'marketing.audience.manage'
            : 'marketing.campaign.update',
        ]),
        branchId,
        'asset-key',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects campaign dates without an explicit timezone', async () => {
    const records = service({ $transaction: vi.fn() });
    await expect(
      records.createCampaign(
        { ...campaignInput, startsAt: '2026-10-01T09:00:00' },
        actor(['marketing.campaign.create']),
        branchId,
        'date-key',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects cross-user owner assignment without reading IAM tables', async () => {
    const transaction = vi.fn();
    const records = service({ $transaction: transaction });
    await expect(
      records.createCampaign(
        {
          ...campaignInput,
          ownerUserId: '99999999-9999-4999-8999-999999999999',
        },
        actor(['marketing.campaign.create']),
        branchId,
        'owner-key',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('propagates audit failure from the same transaction instead of reporting a save', async () => {
    const tx = {
      marketingCommand: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      userBranch: { findUnique: vi.fn().mockResolvedValue({}) },
      marketingAsset: { findFirst: vi.fn() },
      marketingCampaign: { create: vi.fn().mockResolvedValue(campaignRow()) },
      marketingAuditEvent: {
        create: vi.fn().mockRejectedValue(new Error('audit unavailable')),
      },
    };
    const records = service({
      $transaction: (work: (client: typeof tx) => unknown) => work(tx),
    });
    await expect(
      records.createCampaign(
        campaignInput,
        actor(['marketing.campaign.create']),
        branchId,
        'key',
      ),
    ).rejects.toThrow('audit unavailable');
  });
});

describe('CustomerAffairsMarketingIntakeService owner boundary', () => {
  it('requires both Customer Affairs and Marketing permission even for a replay', async () => {
    const transaction = vi.fn();
    const intake = new CustomerAffairsMarketingIntakeService(
      { client: { $transaction: transaction } } as unknown as DatabaseService,
      {} as CustomerContactCrypto,
      {} as MarketingRecordsService,
    );
    await expect(
      intake.create(
        { phone: '09121234567', sourceCategory: 'WEB', status: 'NEW' },
        actor(['customer_affairs.lead.create']),
        branchId,
        'replay-key',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      intake.list(actor(['customer_affairs.lead.read'])),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      intake.score(
        'intake-1',
        ['PHONE_VALID'],
        1,
        actor(['customer_affairs.lead.update']),
        'score-key',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      intake.sourceCounts(
        '2026-01-01T00:00:00.000Z',
        '2026-02-01T00:00:00.000Z',
        actor(['customer_affairs.lead.read']),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('passes the current actor to Marketing campaign attribution validation', async () => {
    const transaction = vi.fn();
    const validateCampaignReference = vi
      .fn()
      .mockRejectedValue(new ForbiddenException());
    const marketing = {
      validateCampaignReference,
    } as unknown as MarketingRecordsService;
    const crypto = {
      protect: vi.fn().mockReturnValue({
        encryptedValue: 'ciphertext',
        encryptionIv: 'iv',
        encryptionAuthTag: 'tag',
        encryptionKeyVersion: 1,
        maskedValue: '*******4567',
        valueFingerprint: 'keyed-fingerprint',
      }),
    } as unknown as CustomerContactCrypto;
    const intake = new CustomerAffairsMarketingIntakeService(
      { client: { $transaction: transaction } } as unknown as DatabaseService,
      crypto,
      marketing,
    );
    const currentActor = actor([
      'customer_affairs.lead.create',
      'marketing.audience.manage',
      'marketing.read',
      'marketing.attribution.read',
    ]);

    await expect(
      intake.create(
        {
          phone: '09121234567',
          sourceCategory: 'WEB',
          campaignId: 'campaign-1',
          status: 'NEW',
        },
        currentActor,
        branchId,
        'campaign-attribution-key',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(validateCampaignReference).toHaveBeenCalledWith(
      'campaign-1',
      branchId,
      currentActor,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('persists encrypted phone fields and keeps raw phone out of command and audit snapshots', async () => {
    const rawPhone = '09121234567';
    const now = new Date('2026-10-06T00:00:00.000Z');
    const row = {
      id: 'intake-1',
      branchId,
      phoneEncrypted: 'ciphertext',
      phoneIv: 'iv',
      phoneAuthTag: 'tag',
      phoneKeyVersion: 1,
      phoneFingerprint: 'keyed-fingerprint',
      phoneMasked: '*******4567',
      sourceCategory: 'WEB',
      campaignId: null,
      status: 'NEW',
      assigneeUserId: null,
      lastFollowUpAt: null,
      score: 0,
      scoreRuleIds: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdByUserId: userId,
      updatedByUserId: userId,
    };
    const tx = {
      customerAffairsCommand: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      customerAffairsMarketingIntake: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(row),
      },
      customerAffairsAuditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const database = {
      client: {
        $transaction: (work: (client: typeof tx) => unknown) => work(tx),
      },
    } as unknown as DatabaseService;
    const crypto = {
      protect: vi.fn().mockReturnValue({
        encryptedValue: 'ciphertext',
        encryptionIv: 'iv',
        encryptionAuthTag: 'tag',
        encryptionKeyVersion: 1,
        maskedValue: '*******4567',
        valueFingerprint: 'keyed-fingerprint',
      }),
    } as unknown as CustomerContactCrypto;
    const intake = new CustomerAffairsMarketingIntakeService(
      database,
      crypto,
      {} as MarketingRecordsService,
    );

    await intake.create(
      { phone: rawPhone, sourceCategory: 'WEB', status: 'NEW' },
      actor(['customer_affairs.lead.create', 'marketing.audience.manage']),
      branchId,
      'intake-key',
    );

    const persisted =
      tx.customerAffairsMarketingIntake.create.mock.calls[0]?.[0].data;
    expect(persisted).toMatchObject({
      phoneEncrypted: 'ciphertext',
      phoneFingerprint: 'keyed-fingerprint',
    });
    expect(
      JSON.stringify(tx.customerAffairsCommand.create.mock.calls),
    ).not.toContain(rawPhone);
    expect(
      JSON.stringify(tx.customerAffairsAuditEvent.create.mock.calls),
    ).not.toContain(rawPhone);
  });

  it('rejects cross-user assignee assignment without reading IAM tables', async () => {
    const transaction = vi.fn();
    const intake = new CustomerAffairsMarketingIntakeService(
      { client: { $transaction: transaction } } as unknown as DatabaseService,
      {
        protect: vi.fn().mockReturnValue({
          encryptedValue: 'ciphertext',
          encryptionIv: 'iv',
          encryptionAuthTag: 'tag',
          encryptionKeyVersion: 1,
          maskedValue: '*******4567',
          valueFingerprint: 'fingerprint',
        }),
      } as unknown as CustomerContactCrypto,
      {} as MarketingRecordsService,
    );
    await expect(
      intake.create(
        {
          phone: '09121234567',
          sourceCategory: 'WEB',
          status: 'NEW',
          assigneeUserId: '99999999-9999-4999-8999-999999999999',
        },
        actor(['customer_affairs.lead.create', 'marketing.audience.manage']),
        branchId,
        'assignee-key',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns full-range grouped source counts with no raw PII', async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { sourceCategory: 'REFERRAL', _count: { _all: 3 } },
      { sourceCategory: 'WEB', _count: { _all: 7 } },
    ]);
    const intake = new CustomerAffairsMarketingIntakeService(
      {
        client: { customerAffairsMarketingIntake: { groupBy } },
      } as unknown as DatabaseService,
      {} as CustomerContactCrypto,
      {} as MarketingRecordsService,
    );
    const result = await intake.sourceCounts(
      '2026-01-01T00:00:00.000Z',
      '2026-12-31T00:00:00.000Z',
      actor(['customer_affairs.lead.read', 'marketing.audience.read']),
    );
    expect(result).toMatchObject({ total: 10, containsRawPii: false });
    expect(result.counts).toEqual([
      { sourceCategory: 'REFERRAL', count: 3 },
      { sourceCategory: 'WEB', count: 7 },
    ]);
    expect(groupBy.mock.calls[0]?.[0].where.createdAt).toMatchObject({
      gte: new Date('2026-01-01T00:00:00.000Z'),
      lt: new Date('2026-12-31T00:00:00.000Z'),
    });
  });
});
