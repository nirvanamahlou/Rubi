import { expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { CustomerAffairsMarketingIntakeService } from './customer-affairs-marketing-intake.service';

it('derives order and sale from scoped contracts and counts a customer on the first confirmed payment', async () => {
  const date = new Date('2026-11-01T12:00:00Z');
  const paid = new Date('2026-11-03T12:00:00Z');
  const rows = ['lead', 'order', 'sale', 'repeat'].map((id) => ({
    id,
    branchId: 'branch',
    phoneFingerprint: id,
    phoneMasked: '******1234',
    sourceCategory: 'test',
    status: 'NEW',
    createdAt: date,
    updatedAt: date,
  }));
  const contacts = rows.map(({ id }) => ({
    customerId: id,
    valueFingerprint: id,
  }));
  const contract = (customerId: string, createdAt: Date, payment?: Date) => ({
    customerId,
    branchId: 'branch',
    createdAt,
    payments: payment ? [{ financeConfirmedAt: payment }] : [],
  });
  const contracts = [
    contract('order', date),
    contract('sale', date, paid),
    contract(
      'repeat',
      new Date('2026-10-01T12:00:00Z'),
      new Date('2026-10-02T12:00:00Z'),
    ),
    contract('repeat', date, paid),
  ];
  const sales = vi.fn().mockResolvedValue(contracts);
  const service = new CustomerAffairsMarketingIntakeService(
    {
      client: {
        customerAffairsMarketingIntake: {
          findMany: vi.fn().mockResolvedValue(rows),
        },
        customerContact: { findMany: vi.fn().mockResolvedValue(contacts) },
        salesContract: { findMany: sales },
      },
    } as never,
    {} as never,
    {} as never,
  );
  const actor = {
    branchIds: ['branch'],
    permissions: [
      'marketing.read',
      'marketing.audience.read',
      'customer_affairs.lead.read',
    ],
  } as AuthenticatedActor;
  expect((await service.list(actor)).data.map(({ stage }) => stage)).toEqual([
    'LEAD',
    'ORDER',
    'SALE',
    'SALE',
  ]);
  expect(sales.mock.calls[0]?.[0]).toMatchObject({
    where: {
      branchId: { in: ['branch'] },
      status: { not: 'CANCELLED' },
      hiddenAt: null,
    },
    select: { payments: { where: { status: 'FINANCE_CONFIRMED' } } },
  });
  expect((await service.leadActivity(actor)).data).toEqual([
    {
      date: '2026-11-01',
      source: 'test',
      leads: 4,
      orders: 3,
      convertedLeads: 2,
      customers: 0,
    },
    {
      date: '2026-11-03',
      source: 'test',
      leads: 0,
      orders: 0,
      convertedLeads: 0,
      customers: 1,
    },
  ]);
});
