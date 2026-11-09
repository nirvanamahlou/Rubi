import { expect, it, vi } from 'vitest';
import { SalesController } from './sales.controller';
function setup(approved = true) {
  const intake = {
    id: 'intake',
    branchId: 'branch',
    snapshot: {
      serviceSelections: [
        { kind: 'FLIGHT', metadata: { purchaseSupplyType: 'FLOATING' } },
      ],
    },
    workflow: { supplierStatus: 'NEW' },
  };
  const detail = vi.fn().mockResolvedValue({ data: { branchId: 'branch' } }),
    floatingDocumentOutput = vi.fn(async (value: typeof intake) => ({
      ...value,
      workflow: {
        ...value.workflow,
        branding: { kind: 'OWN' },
        voucherIssued: true,
      },
    }));
  const issueFloatingForDelivery = vi
    .fn()
    .mockResolvedValue([{ customerId: 'passenger', number: '100001' }]);
  const controller = new SalesController(
    {} as never,
    {} as never,
    { detail } as never,
    {} as never,
    {
      forContract: vi.fn().mockResolvedValue(intake),
      floatingDocumentOutput,
    } as never,
    { readCustomerContract: vi.fn().mockResolvedValue({ approved }) } as never,
    { issueFloatingForDelivery } as never,
  );
  return {
    controller,
    intake,
    detail,
    floatingDocumentOutput,
    issueFloatingForDelivery,
  };
}
const request = {
  actor: { userId: 'sales', branchIds: ['branch'], permissions: [] },
} as never;
it('prepares defaults and persistent automatic ticket numbers only after Sales and Finance authorize delivery', async () => {
  const x = setup();
  const result = await x.controller.travelDocuments('contract', request);
  expect(x.detail).toHaveBeenCalled();
  expect(result.data.workflow).toMatchObject({
    branding: { kind: 'OWN' },
    voucherIssued: true,
  });
  expect(result.data.ticketDocuments[0]?.number).toBe('100001');
  expect(x.issueFloatingForDelivery).toHaveBeenCalledTimes(1);
});
it.each(['finance', 'cancelled', 'sales'])(
  'does not issue documents when %s access is blocked',
  async (kind) => {
    const x = setup(kind !== 'finance');
    if (kind === 'cancelled') x.intake.workflow.supplierStatus = 'CANCELLED';
    if (kind === 'sales')
      x.detail.mockRejectedValue(new Error('not authorized'));
    await expect(
      x.controller.travelDocuments('contract', request),
    ).rejects.toThrow();
    expect(x.floatingDocumentOutput).not.toHaveBeenCalled();
    expect(x.issueFloatingForDelivery).not.toHaveBeenCalled();
  },
);
