import { expect, it, vi } from 'vitest';
import { ReservationInsuranceController } from './insurance.controller';

it('kicks automatic issuance only after the correction transaction commits and keeps the existing response', async () => {
  let commit: (value: unknown) => void = () => undefined;
  const result = {
    data: { id: 'synthetic', automatic: true, status: 'DRAFT' },
  };
  const insurance = {
    saveDraft: vi.fn(
      () =>
        new Promise((resolve) => {
          commit = resolve;
        }),
    ),
  };
  const automation = { requestImmediate: vi.fn() };
  const controller = new ReservationInsuranceController(
    insurance as never,
    {} as never,
    automation as never,
  );
  const actor = { userId: 'synthetic' };
  const pending = controller.save({ expectedVersion: 1 }, { actor } as never);
  expect(automation.requestImmediate).not.toHaveBeenCalled();
  commit(result);
  await expect(pending).resolves.toBe(result);
  expect(automation.requestImmediate).toHaveBeenCalledExactlyOnceWith(
    'synthetic',
  );
});

it('never starts issuance for rejected corrections or a manually saved draft', async () => {
  const insurance = {
    saveDraft: vi
      .fn()
      .mockRejectedValueOnce(new Error('invalid input'))
      .mockResolvedValueOnce({ data: { id: 'manual', automatic: false } }),
  };
  const automation = { requestImmediate: vi.fn() };
  const controller = new ReservationInsuranceController(
    insurance as never,
    {} as never,
    automation as never,
  );
  await expect(controller.save({}, { actor: {} } as never)).rejects.toThrow(
    'invalid input',
  );
  await controller.save({}, { actor: {} } as never);
  expect(automation.requestImmediate).not.toHaveBeenCalled();
});
