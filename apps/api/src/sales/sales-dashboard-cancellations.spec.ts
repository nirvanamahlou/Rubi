import { expect, it, vi } from 'vitest';
import { SalesRepository } from './sales.repository';

it('excludes Sales and latest Reservations cancellations from dashboard counts and balances', async () => {
  const where = { legalEntityId: 'company', hiddenAt: null };
  const sales = vi.fn().mockResolvedValue([
    { id: 'live', status: 'SENT_TO_RESERVATIONS' },
    { id: 'sales-cancelled', status: 'CANCELLED' },
    { id: 'reservation-cancelled', status: 'SENT_TO_RESERVATIONS' },
    { id: 'reopened', status: 'SENT_TO_RESERVATIONS' },
  ]);
  const intakes = vi.fn().mockResolvedValue([
    {
      contractId: 'reservation-cancelled',
      workflowRevisions: [
        { state: { supplierStatus: 'CANCELLED' }, createdAt: new Date() },
      ],
    },
    {
      contractId: 'reopened',
      workflowRevisions: [
        { state: { supplierStatus: 'DRAFT' }, createdAt: new Date() },
      ],
    },
  ]);
  const repository = Object.assign(Object.create(SalesRepository.prototype), {
    database: {
      client: {
        salesContract: { findMany: sales },
        reservationIntake: { findMany: intakes },
      },
    },
  }) as SalesRepository;
  expect((await repository.dashboardRows(where)).map((r) => r.id)).toEqual([
    'live',
    'reopened',
  ]);
  expect(sales).toHaveBeenCalledWith(expect.objectContaining({ where }));
  expect(intakes).toHaveBeenCalledWith(
    expect.objectContaining({
      distinct: ['contractId'],
      orderBy: [{ contractId: 'asc' }, { contractVersion: 'desc' }],
    }),
  );
});

it('does not query reservation lifecycle for an empty authorized company', async () => {
  const intakes = vi.fn();
  const repository = Object.assign(Object.create(SalesRepository.prototype), {
    database: {
      client: {
        salesContract: { findMany: vi.fn().mockResolvedValue([]) },
        reservationIntake: { findMany: intakes },
      },
    },
  }) as SalesRepository;
  expect(await repository.dashboardRows({ hiddenAt: null })).toEqual([]);
  expect(intakes).not.toHaveBeenCalled();
});
