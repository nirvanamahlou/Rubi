import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { HrPayrollFinancePublicService } from './hr-payroll-finance-public.service';

const id = '00000000-0000-4000-8000-000000000001';
const actor = {
  userId: id,
  branchIds: [id],
  permissions: ['hr.manage', 'hr.approve', 'hr.sensitive'],
} as unknown as AuthenticatedActor;
function setup() {
  const createRecord = vi.fn().mockResolvedValue({ id });
  const row = {
    id,
    version: 1,
    branchId: id,
    status: 'تأییدشده',
    employee: { id, name: 'نام جدید' },
    values: ['نام هنگام تأیید', '2026-10', '1000.25', '2026-10-28'],
    amounts: [
      {
        field: 'field2',
        amount: { isPositive: () => true, toString: () => '1000.25' },
        currency: 'IRR',
      },
    ],
  };
  const client = {
    hrEmployee: {
      findFirst: vi.fn().mockResolvedValue({ name: 'نام کارمند' }),
    },
    hrRecord: { findFirst: vi.fn().mockResolvedValue(row) },
  };
  return {
    createRecord,
    client,
    service: new HrPayrollFinancePublicService(
      { createRecord } as never,
      { client } as never,
    ),
  };
}
const input = {
  employeeId: id,
  period: '2026-10',
  amount: '1000.25',
  currencyCode: 'IRR',
  dueAt: '2026-10-28',
};
describe('HR approved salary public boundary', () => {
  it('requires all HR approval permissions before creating anything', async () => {
    const { service, createRecord } = setup();
    await expect(
      service.submit(input, id, { ...actor, permissions: ['hr.manage'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(createRecord).not.toHaveBeenCalled();
  });
  it.each([
    { amount: '0' },
    { amount: '-1' },
    { amount: '1e9' },
    { amount: '1.00001' },
    { period: '2026-13' },
    { dueAt: '2026-02-30' },
    { currencyCode: 'irr' },
  ])('rejects invalid input %s', async (invalid) => {
    const { service, createRecord } = setup();
    await expect(
      service.submit({ ...input, ...invalid }, id, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createRecord).not.toHaveBeenCalled();
  });
  it('creates an approved amount-only record and shares no private HR payload', async () => {
    const { service, createRecord } = setup();
    const source = await service.submit(input, id, actor);
    expect(createRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        section: 'payroll',
        tab: 'paymentRequests',
        status: 'تأییدشده',
        values: [id, '2026-10', '1000.25', '2026-10-28'],
        data: { currency: 'IRR' },
      }),
      id,
      actor,
    );
    expect(source).toEqual({
      id,
      version: 1,
      branchId: id,
      employeeId: id,
      employeeName: 'نام هنگام تأیید',
      period: '2026-10',
      amount: '1000.25',
      currencyCode: 'IRR',
      dueAt: '2026-10-28T20:29:59.999Z',
    });
  });
  it('reads only branch-scoped approved salary requests and their exact typed amount', async () => {
    const { service, client } = setup();
    await service.approvedSource(id, [id]);
    expect(client.hrRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id,
          branchId: { in: [id] },
          section: 'payroll',
          tab: 'paymentRequests',
          deletedAt: null,
        },
      }),
    );
  });
});
