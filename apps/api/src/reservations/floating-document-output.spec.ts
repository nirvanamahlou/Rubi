import { expect, it, vi } from 'vitest';
import { TravelWorkflowService } from './travel-workflow.service';
import { initialTravelWorkflow } from './travel-workflow';
import type {
  AuthenticatedActor,
  SalesReservationRequestV1,
} from '@nora/contracts';
const actor = {
  userId: 'sales',
  branchIds: ['branch'],
  permissions: ['sales.contracts.read.own'],
} as unknown as AuthenticatedActor;
const snapshot = {
  serviceSelections: [
    { kind: 'FLIGHT', metadata: { purchaseSupplyType: 'FLOATING' } },
  ],
  hotelSelection: { hotelId: 'hotel' },
} as unknown as SalesReservationRequestV1;
function setup() {
  const current = vi
    .fn()
    .mockResolvedValue({
      data: {
        legalEntity: {
          id: 'company',
          code: 'JAHAN_BASTAN',
          persianName: 'Synthetic company',
          logoFileId: null,
        },
      },
    });
  return {
    current,
    service: new TravelWorkflowService(
      {} as never,
      { current } as never,
      {} as never,
      {} as never,
      {} as never,
    ),
  };
}
it('prepares floating voucher output with the active company without a supplier confirmation or workflow write', async () => {
  const { service, current } = setup();
  const intake = { snapshot, workflow: initialTravelWorkflow() };
  const before = structuredClone(intake);
  const result = await service.floatingDocumentOutput(intake, actor);
  expect(result.workflow).toMatchObject({
    voucherIssued: true,
    supplierStatus: 'NEW',
    version: 0,
    branding: { companyCode: 'JAHAN_BASTAN', name: 'Synthetic company' },
  });
  expect(intake).toEqual(before);
  expect(current).toHaveBeenCalledWith(actor);
});
it('preserves an explicit agency letterhead and keeps ticket-only contracts free of hotel vouchers', async () => {
  const { service, current } = setup();
  const branding = {
    kind: 'AGENCY' as const,
    name: 'Chosen agency',
    referenceId: 'agency',
  };
  const result = await service.floatingDocumentOutput(
    {
      snapshot: { ...snapshot, hotelSelection: null },
      workflow: { ...initialTravelWorkflow(), branding },
    },
    actor,
  );
  expect(result.workflow.branding).toEqual(branding);
  expect(result.workflow.voucherIssued).toBe(false);
  expect(current).not.toHaveBeenCalled();
});
it('does not auto-ready ordinary or cancelled requests', async () => {
  const { service, current } = setup();
  for (const input of [
    {
      snapshot: { ...snapshot, serviceSelections: [] },
      workflow: initialTravelWorkflow(),
    },
    {
      snapshot,
      workflow: {
        ...initialTravelWorkflow(),
        supplierStatus: 'CANCELLED' as const,
      },
    },
  ]) {
    expect(await service.floatingDocumentOutput(input, actor)).toBe(input);
  }
  expect(current).not.toHaveBeenCalled();
});
