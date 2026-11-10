import { beforeEach, expect, it, vi } from 'vitest';
import type * as ReactModule from 'react';
import type { InsuranceStandaloneInputV1 } from '@nora/contracts';
import { StandaloneInsuranceDraft } from './standalone-draft';
const h = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  request: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useEffect: vi.fn(),
  useState: (initial: unknown) => {
    const i = h.index++;
    if (!(i in h.states))
      h.states[i] = typeof initial === 'function' ? initial() : initial;
    return [
      h.states[i],
      (value: unknown) => {
        h.states[i] = typeof value === 'function' ? value(h.states[i]) : value;
      },
    ];
  },
}));
vi.mock('./client', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  insuranceRequest: h.request,
}));
const branches = [{ id: 'branch', name: 'Synthetic branch' }],
  saved = vi.fn();
beforeEach(() => {
  h.states = [];
  h.index = 0;
  h.request.mockReset();
  saved.mockReset();
});
function completed() {
  StandaloneInsuranceDraft({ branches, saved });
  const draft = h.states[0] as InsuranceStandaloneInputV1;
  Object.assign(draft, {
    sourceCountryCode: '1',
    destinationCode: '5',
    planCode: '76',
    departureDate: '2027-01-01',
    durationDays: 7,
  });
  Object.assign(draft.passenger, {
    firstName: 'Synthetic',
    lastName: 'Applicant',
    firstNameLatin: 'SYNTHETIC',
    lastNameLatin: 'APPLICANT',
    nationalityCode: 'TUR',
    passportNo: 'SYNTHETIC123',
    birthDate: '1990-01-01',
    gender: 'F',
    mobile: '00000000000',
    email: 'synthetic@example.invalid',
  });
  h.states[1] = {
    config: {
      countries: [
        {
          active: true,
          providerCountryCode: '5',
          plans: [{ providerPlanCode: '76' }],
        },
      ],
    },
  };
  h.states[2] = {
    branchId: 'branch',
    countries: [{ id: 1, title: 'Synthetic' }],
    durations: [
      { days: 2, title: '2' },
      { days: 7, title: '7' },
    ],
  };
  h.index = 0;
  return draft;
}
it('opens a fresh full applicant form without a contract/customer or prefilled identity', () => {
  const form = StandaloneInsuranceDraft({ branches, saved });
  const draft = h.states[0] as InsuranceStandaloneInputV1;
  expect(draft.passenger).toMatchObject({
    firstName: '',
    passportNo: '',
    email: '',
    birthDate: '',
    gender: '',
  });
  expect(draft).not.toHaveProperty('intakeId');
  expect(draft).not.toHaveProperty('customerId');
  expect(draft.durationDays).toBe(0);
  form.props.onSubmit({ preventDefault: vi.fn() });
  expect(h.request).not.toHaveBeenCalled();
});
it('sends full standalone data, keeps the form after failure, and reuses its replay key on retry', async () => {
  const draft = completed();
  h.request
    .mockRejectedValueOnce(new Error('synthetic failure'))
    .mockResolvedValueOnce({ data: { id: 'policy' } });
  StandaloneInsuranceDraft({ branches, saved }).props.onSubmit({
    preventDefault: vi.fn(),
  });
  await vi.waitFor(() => expect(h.states[5]).toBe('synthetic failure'));
  expect(saved).not.toHaveBeenCalled();
  h.index = 0;
  StandaloneInsuranceDraft({ branches, saved }).props.onSubmit({
    preventDefault: vi.fn(),
  });
  await vi.waitFor(() => expect(saved).toHaveBeenCalledOnce());
  for (const [path, request] of h.request.mock.calls) {
    expect(path).toBe('standalone');
    expect(request.method).toBe('POST');
    const body = JSON.parse(request.body);
    expect(body.requestKey).toBe(draft.requestKey);
    expect(body.passenger.passportNo).toBe('SYNTHETIC123');
    expect(body).not.toHaveProperty('intakeId');
    expect(body).not.toHaveProperty('customerId');
  }
});
it('does not submit or silently round an unsupported duration', () => {
  const draft = completed();
  draft.durationDays = 1;
  StandaloneInsuranceDraft({ branches, saved }).props.onSubmit({
    preventDefault: vi.fn(),
  });
  expect(h.request).not.toHaveBeenCalled();
  expect(draft.durationDays).toBe(1);
});
