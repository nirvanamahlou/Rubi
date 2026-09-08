import { describe, expect, it, vi } from 'vitest';
import type { MasterDataRecord } from '@rubi/contracts';
import {
  loadSalesInsurancePlans,
  salesInsuranceService,
  selectSalesInsurance,
} from './sales-insurance';
import { emptySalesForm, salesPayload } from './sales-form';

const plan: MasterDataRecord = {
  id: '10000000-0000-4000-8000-000000000001',
  resource: 'insurance-plans',
  code: 'TEST-PLAN',
  name: 'طرح آزمایشی سفر',
  status: 'active',
  version: 3,
  attributes: {
    insurerId: 'test-insurer',
    insurerName: 'بیمه آزمایشی',
    internalNote: 'not a snapshot field',
  },
  createdAt: '2026-09-08T00:00:00Z',
  updatedAt: '2026-09-08T00:00:00Z',
};
describe('registered insurance selection', () => {
  it('loads every public active page, filters inactive records and deduplicates', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ data: [plan], meta: { total: 3 } })
      .mockResolvedValueOnce({
        data: [plan, { ...plan, id: 'inactive', status: 'inactive' }],
        meta: { total: 3 },
      });
    expect(await loadSalesInsurancePlans(list)).toEqual([plan]);
    expect(list).toHaveBeenNthCalledWith(
      2,
      'insurance-plans',
      expect.objectContaining({ status: 'active', page: 2 }),
    );
  });
  it('does not silently accept partial/failed results', async () => {
    await expect(
      loadSalesInsurancePlans(vi.fn().mockRejectedValue(new Error('offline'))),
    ).rejects.toThrow('offline');
    await expect(
      loadSalesInsurancePlans(
        vi.fn().mockResolvedValue({ data: [], meta: { total: 1 } }),
      ),
    ).rejects.toThrow('کامل');
    expect(
      await loadSalesInsurancePlans(
        vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
      ),
    ).toEqual([]);
  });
  it('rejects inactive/wrong-resource records and missing selection', () => {
    expect(() =>
      selectSalesInsurance({ ...plan, status: 'inactive' }),
    ).toThrow();
    expect(() =>
      selectSalesInsurance({ ...plan, resource: 'hotels' }),
    ).toThrow();
    expect(() => salesInsuranceService()).toThrow('طرح بیمه');
    expect(() =>
      salesPayload({ ...emptySalesForm, serviceKinds: ['INSURANCE'] }),
    ).toThrow('طرح بیمه');
  });
  it('keeps the registered reference and versioned selection for all passenger assignments, never an issued policy or free text', () => {
    const state = {
      ...emptySalesForm,
      serviceKinds: ['INSURANCE' as const],
      insurancePlan: selectSalesInsurance(plan),
      serviceDetails: {
        INSURANCE: { notes: 'legacy description', date: '2026-10-01' },
      },
      passengers: [
        {
          customerId: 'sample-person',
          displayName: 'Sample',
          birthDate: '1990-01-01',
        },
      ],
    };
    const payload = salesPayload(JSON.parse(JSON.stringify(state)));
    expect(payload.services).toEqual([
      {
        clientKey: 'insurance',
        kind: 'INSURANCE',
        referenceId: plan.id,
        titleSnapshot: `بیمه — ${plan.name}`,
        status: 'NEEDS_RESERVATION_CONFIRMATION',
        metadata: {
          insuranceSelectionVersion: 1,
          insurancePlanName: plan.name,
          insurancePlanCode: plan.code,
          insurancePlanRecordVersion: 3,
          insurerId: 'test-insurer',
          insurerName: 'بیمه آزمایشی',
        },
      },
    ]);
    expect(payload.passengers[0]?.serviceClientKeys).toContain('insurance');
    expect(JSON.stringify(payload)).not.toMatch(
      /legacy description|internalNote|policyNumber/,
    );
    expect(
      salesPayload({ ...state, serviceKinds: ['OTHER'] }).services.some(
        (s) => s.kind === 'INSURANCE',
      ),
    ).toBe(false);
  });
});
