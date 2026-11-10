import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { parseStandaloneInsurance } from './standalone-insurance.service';
import { StandaloneInsuranceController } from './standalone-insurance.controller';
const input = () => ({
  branchId: randomUUID(),
  requestKey: randomUUID(),
  sourceCountryCode: '1',
  destinationCode: '5',
  planCode: '76',
  departureDate: '2027-01-01',
  durationDays: 7,
  notes: '',
  expectedVersion: 0,
  passenger: {
    version: 1,
    firstName: 'Synthetic',
    lastName: 'Applicant',
    firstNameLatin: 'SYNTHETIC',
    lastNameLatin: 'APPLICANT',
    nationalityCode: 'TUR',
    nationalCode: '',
    passportNo: 'SYNTHETIC123',
    birthDate: '1990-01-01',
    gender: 'F',
    mobile: '00000000000',
    email: 'synthetic@example.invalid',
  },
});
it('requires full new identity and rejects contract/provider/status injection and invalid dates', () => {
  expect(parseStandaloneInsurance(input())).not.toHaveProperty('contractId');
  for (const extra of [
    { contractId: randomUUID() },
    { customerId: randomUUID() },
    { intakeId: randomUUID() },
    { status: 'ISSUED' },
    { providerId: 'forged' },
  ])
    expect(() => parseStandaloneInsurance({ ...input(), ...extra })).toThrow();
  expect(() =>
    parseStandaloneInsurance({ ...input(), passenger: undefined }),
  ).toThrow();
  expect(() =>
    parseStandaloneInsurance({ ...input(), departureDate: '2027-02-30' }),
  ).toThrow();
  const invalid = input();
  invalid.passenger.birthDate = '2999-01-01';
  expect(() => parseStandaloneInsurance(invalid)).toThrow();
});
it('starts automatic issuance only after a standalone request commits and never starts a rejected save', async () => {
  let commit: (value: unknown) => void = () => undefined;
  const service = {
    save: vi.fn(
      () =>
        new Promise((resolve) => {
          commit = resolve;
        }),
    ),
  };
  const automation = { requestImmediate: vi.fn() };
  const controller = new StandaloneInsuranceController(
    service as never,
    automation as never,
  );
  const pending = controller.create(input(), { actor: {} } as never);
  expect(automation.requestImmediate).not.toHaveBeenCalled();
  commit({ data: { id: 'synthetic' } });
  await pending;
  expect(automation.requestImmediate).toHaveBeenCalledExactlyOnceWith(
    'synthetic',
  );
  service.save.mockRejectedValueOnce(new Error('validation failure'));
  await expect(controller.create({}, { actor: {} } as never)).rejects.toThrow();
  expect(automation.requestImmediate).toHaveBeenCalledTimes(1);
});
