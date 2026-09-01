import 'reflect-metadata';
import {
  BadRequestException,
  ForbiddenException,
  ValidationPipe,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import { CurrencyRateQuoteDto } from './currency-rate.dto';
import { CurrencyRateService } from './currency-rate.service';

const maker: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: ['33333333-3333-4333-8333-333333333333'],
  permissions: ['master_data.create', 'master_data.currency_rate.create'],
};
const input = {
  fromCurrencyCode: 'USD',
  toCurrencyCode: 'IRR',
  buyRate: '1.1234567890',
  sellRate: '2.1234567890',
  source: 'Test quote',
  observedAt: '2026-08-31T12:00:00Z',
};
function setup() {
  let nextId = 0;
  const tx = {
    masterCurrency: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'from', code: 'USD' },
        { id: 'to', code: 'IRR' },
      ]),
    },
    masterDraftExchangeRate: {
      create: vi
        .fn()
        .mockImplementation(async ({ data }) => ({
          ...data,
          id: `rate-${++nextId}`,
          version: 1,
        })),
    },
    masterDataAuditEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  const transaction = vi
    .fn()
    .mockImplementation((fn: (value: typeof tx) => unknown) => fn(tx));
  const database = {
    client: { $transaction: transaction },
  } as unknown as DatabaseService;
  return { service: new CurrencyRateService(database), tx, transaction };
}

describe('manual currency quotes', () => {
  it('appends BUY and SELL and their audits in one transaction with backend-owned metadata', async () => {
    const { service, tx, transaction } = setup();
    const result = await service.createQuote(input, maker);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.masterDraftExchangeRate.create).toHaveBeenCalledTimes(2);
    expect(tx.masterDataAuditEvent.create).toHaveBeenCalledTimes(2);
    expect(result.data.map((row) => [row.rateType, row.rate])).toEqual([
      ['BUY', input.buyRate],
      ['SELL', input.sellRate],
    ]);
    for (const row of result.data)
      expect(row).toMatchObject({
        status: 'DRAFT',
        version: 1,
        isAuthoritative: false,
        createdByUserId: maker.userId,
        approvedByUserId: null,
      });
    expect(tx.masterCurrency.findMany).toHaveBeenCalledWith({
      where: { code: { in: ['USD', 'IRR'] }, isActive: true },
    });
    expect(tx.masterDataAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: maker.userId,
        actorBranchId: maker.branchIds[0],
        resource: 'exchange-rates',
      }),
    });
  });
  it('allows one side without inventing the other side', async () => {
    const { service, tx } = setup();
    const buyOnly = { ...input };
    Reflect.deleteProperty(buyOnly, 'sellRate');
    expect((await service.createQuote(buyOnly, maker)).data).toHaveLength(1);
    expect(tx.masterDraftExchangeRate.create).toHaveBeenCalledTimes(1);
  });
  it.each(['0', '-1', '1e2', '1.12345678901', '100000000000000'])(
    'rejects invalid decimal %s before writing',
    async (buyRate) => {
      const { service, transaction } = setup();
      await expect(
        service.createQuote({ ...input, buyRate }, maker),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(transaction).not.toHaveBeenCalled();
    },
  );
  it('rejects empty sides, same currency, timezone-less times and reversed validity', async () => {
    const { service } = setup();
    const empty = { ...input };
    Reflect.deleteProperty(empty, 'buyRate');
    Reflect.deleteProperty(empty, 'sellRate');
    for (const invalid of [
      empty,
      { ...input, toCurrencyCode: 'USD' },
      { ...input, observedAt: '2026-08-31T12:00' },
      { ...input, validTo: '2026-08-30T12:00:00Z' },
    ])
      await expect(service.createQuote(invalid, maker)).rejects.toBeInstanceOf(
        BadRequestException,
      );
  });
  it('requires both permissions and a permitted audit branch', async () => {
    const { service, transaction } = setup();
    for (const permissions of [
      [],
      ['master_data.create'],
      ['master_data.currency_rate.create'],
    ] as AuthenticatedActor['permissions'][])
      await expect(
        service.createQuote(input, { ...maker, permissions }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.createQuote(input, maker, 'other-branch'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });
  it('does not write rates for missing or inactive currencies', async () => {
    const { service, tx } = setup();
    tx.masterCurrency.findMany.mockResolvedValue([]);
    await expect(service.createQuote(input, maker)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.masterDraftExchangeRate.create).not.toHaveBeenCalled();
  });
  it('propagates a second-side or audit failure out of the transaction, never reports partial success', async () => {
    for (const target of ['rate', 'audit']) {
      const { service, tx } = setup();
      const failing =
        target === 'rate'
          ? tx.masterDraftExchangeRate.create
          : tx.masterDataAuditEvent.create;
      failing
        .mockResolvedValueOnce({
          ...input,
          id: 'first',
          rate: input.buyRate,
          rateType: 'BUY',
          version: 1,
        })
        .mockRejectedValueOnce(new Error('transaction failure'));
      await expect(service.createQuote(input, maker)).rejects.toThrow(
        'transaction failure',
      );
    }
  });
});

describe('quote runtime DTO', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const transform = (value: unknown) =>
    pipe.transform(value, { type: 'body', metatype: CurrencyRateQuoteDto });
  it('normalizes currency codes and validates a real body DTO', async () => {
    await expect(
      transform({
        ...input,
        fromCurrencyCode: ' usd ',
        source: ' Test quote ',
      }),
    ).resolves.toMatchObject(input);
  });
  it.each([
    'status',
    'createdByUserId',
    'isAuthoritative',
    'approvedByUserId',
    'isBase',
  ])('rejects client supplied %s', async (key) => {
    await expect(
      transform({ ...input, [key]: 'forged' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects invalid dates, numeric rate JSON, overflow and unknown fields', async () => {
    for (const invalid of [
      { ...input, observedAt: '2026-02-31T12:00:00Z' },
      { ...input, buyRate: 1.5 },
      { ...input, buyRate: '1.12345678901' },
      { ...input, source: ' ' },
    ])
      await expect(transform(invalid)).rejects.toBeInstanceOf(
        BadRequestException,
      );
  });
});
