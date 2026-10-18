import 'reflect-metadata';
import { it, expect, vi } from 'vitest';
import { TravelWorkflowService } from './travel-workflow.service';
import { SalesOperationalAmendmentService } from '../sales/sales-operational-amendment.module';
it('enriches missing historical child bands from the scoped Sales reader without rewriting stored intake', async () => {
  const snapshot = {
    passengerIds: ['c'],
    passengerAssignments: [
      { customerId: 'c', ageCategory: 'CHD', serviceClientKeys: [] },
    ],
    hotelSelection: { checkInDate: '2026-10-01' },
  };
  const row = {
    id: '10000000-0000-4000-8000-000000000001',
    contractId: 'contract',
    snapshot,
    workflowRevisions: [],
    arrangements: [],
    ticketDocuments: [],
    receivedAt: new Date('2026-09-01'),
  };
  const saved = structuredClone(row.snapshot);
  const client = {
    reservationIntake: { findFirst: vi.fn().mockResolvedValue(row) },
    salesContract: {
      findFirst: vi
        .fn()
        .mockResolvedValue({
          version: 1,
          departureDate: new Date('2026-10-01'),
          passengers: [{ customerId: 'c', birthDate: new Date('2018-10-01') }],
        }),
    },
  };
  const service = new TravelWorkflowService(
    { client } as never,
    {} as never,
    {} as never,
    {} as never,
    new SalesOperationalAmendmentService(),
  );
  const value = await service.detail(row.id, ['branch']);
  expect(value.snapshot.passengerAssignments![0]!.childAgeBand).toBe(
    'AGE_6_12',
  );
  expect(value.snapshot).not.toHaveProperty('birthDate');
  expect(row.snapshot).toEqual(saved);
});
