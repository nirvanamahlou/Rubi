import { beforeEach, expect, it, vi } from 'vitest';
import type * as ReactModule from 'react';
import type { InsurancePolicyRowV1 } from '@nora/contracts';
import { InsuranceDraft } from './policies';
const h = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  request: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useEffect: vi.fn(),
  useState: (initial: unknown) => {
    const index = h.index++;
    if (!(index in h.states))
      h.states[index] = typeof initial === 'function' ? initial() : initial;
    return [
      h.states[index],
      (value: unknown) => {
        h.states[index] =
          typeof value === 'function' ? value(h.states[index]) : value;
      },
    ];
  },
}));
vi.mock('./client', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  insuranceRequest: h.request,
}));
const target = {
  id: 'policy',
  intakeId: 'intake',
  customerId: 'person',
  branchId: 'branch',
  version: 1,
  automatic: true,
} as InsurancePolicyRowV1;
const saved = vi.fn();
beforeEach(() => {
  h.index = 0;
  saved.mockReset();
  h.request.mockReset();
  h.states = [
    { config: { countries: [] } },
    '',
    false,
    false,
    {
      intakeId: 'intake',
      customerId: 'person',
      expectedVersion: 1,
      destinationCode: '5',
      planCode: '76',
      departureDate: '2027-01-01',
      durationDays: 7,
      notes: '',
      passenger: {
        version: 1,
        firstName: ' Test ',
        lastName: ' Person ',
        nationalCode: '0000000000',
        firstNameLatin: ' TEST ',
        lastNameLatin: ' PERSON ',
        nationalityCode: 'IRN',
        passportNo: 'FAKE1234',
        mobile: '00000000000',
        email: 'test@example.invalid',
        gender: 'F',
        birthDate: '2000-01-01',
      },
    },
  ];
});
it('waits for durable correction acknowledgement and preserves identifier zeros while trimming surrounding name spaces', async () => {
  let complete: (value: unknown) => void = () => undefined;
  h.request.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  const form = InsuranceDraft({ target, saved });
  form.props.onSubmit({ preventDefault: vi.fn() });
  expect(saved).not.toHaveBeenCalled();
  const [path, request] = h.request.mock.calls[0]!;
  expect(path).toBe('draft');
  expect(request.method).toBe('PUT');
  expect(JSON.parse(request.body).passenger).toMatchObject({
    firstName: 'Test',
    lastName: 'Person',
    firstNameLatin: 'TEST',
    nationalCode: '0000000000',
  });
  complete({ data: { id: 'policy', automatic: true, status: 'DRAFT' } });
  await vi.waitFor(() => expect(saved).toHaveBeenCalledOnce());
});
it('keeps an invalid correction open with the specific server reason', async () => {
  h.request.mockRejectedValueOnce(new Error('ایمیل بیمه‌شده'));
  InsuranceDraft({ target, saved }).props.onSubmit({ preventDefault: vi.fn() });
  await vi.waitFor(() => expect(h.states[1]).toBe('ایمیل بیمه‌شده'));
  expect(saved).not.toHaveBeenCalled();
  expect(h.states[2]).toBe(false);
});
