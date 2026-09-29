import { describe, expect, it, vi } from 'vitest';
import {
  ForbiddenException,
  NotFoundException,
  type ExecutionContext,
} from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { ReservationOperationInterceptor } from './reservation-operation.interceptor';
import { ReservationRequestsController } from './reservations-runtime.module';

function setup(
  method = 'PATCH',
  handlerName = 'rename',
  route = 'passengers/:passengerId',
) {
  const actor = {
    userId: 'operator',
    branchIds: ['allowed'],
    permissions: ['reservations.read'],
  };
  const detail = vi.fn().mockResolvedValue({ branchId: 'allowed' });
  const record = vi.fn().mockResolvedValue(undefined);
  const interceptor = new ReservationOperationInterceptor(
    { detail } as never,
    { recordReservationOperation: record } as never,
  );
  const handler = { [handlerName]: () => {} }[handlerName];
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        params: { intakeId: 'intake' },
        route: { path: route },
        actor,
        body: { passport: 'never-copy' },
      }),
    }),
    getHandler: () => handler,
  } as unknown as ExecutionContext;
  return { actor, detail, record, interceptor, context };
}
describe('reservation mutation responsibility', () => {
  it('records only the responsible actor/authorized intake after successful completion', async () => {
    const s = setup();
    expect(
      await lastValueFrom(
        s.interceptor.intercept(s.context, { handle: () => of({ ok: true }) }),
      ),
    ).toEqual({ ok: true });
    expect(s.record).toHaveBeenCalledWith(
      'intake',
      'allowed',
      s.actor,
      'reservations.rename',
    );
    expect(JSON.stringify(s.record.mock.calls)).not.toContain('never-copy');
  });
  it('does not replace responsibility after a denied or failed operation', async () => {
    const s = setup();
    await expect(
      lastValueFrom(
        s.interceptor.intercept(s.context, {
          handle: () => throwError(() => new ForbiddenException()),
        }),
      ),
    ).rejects.toThrow();
    expect(s.record).not.toHaveBeenCalled();
  });
  it('checks intake branch before mutation execution', async () => {
    const s = setup();
    s.detail.mockRejectedValue(new NotFoundException());
    const handle = vi.fn(() => of({ ok: true }));
    await expect(
      lastValueFrom(s.interceptor.intercept(s.context, { handle })),
    ).rejects.toThrow();
    expect(handle).not.toHaveBeenCalled();
    expect(s.record).not.toHaveBeenCalled();
  });
  it.each([
    ['GET', 'read', 'documents'],
    ['PATCH', 'deliveryUpdate', ':id/delivery'],
    [
      'PATCH',
      'updateSupplierPayment',
      ':id/service-purchases/:purchaseId/payment',
    ],
    ['POST', 'record', ':id/hotel-purchase'],
    ['POST', 'recordServicePurchase', ':id/service-purchases'],
    ['PATCH', 'workflowUpdate', ':id/workflow'],
    ['PATCH', 'updateArrangement', ':id/arrangement'],
  ])(
    'does not manufacture new activity for %s %s',
    async (method, handler, route) => {
      const s = setup(method, handler, route);
      await lastValueFrom(
        s.interceptor.intercept(s.context, { handle: () => of({}) }),
      );
      expect(s.detail).not.toHaveBeenCalled();
      expect(s.record).not.toHaveBeenCalled();
    },
  );
});

function summaryFixture() {
  const detail = vi.fn().mockResolvedValue({ branchId: 'allowed' });
  const read = vi.fn().mockResolvedValue({
    approved: true,
    updatedAt: '2026-09-29T08:00:00.000Z',
    updatedByUserId: 'finance',
    reason: 'never-expose',
  });
  const latest = vi.fn().mockResolvedValue({
    actorUserId: 'files',
    occurredAt: new Date('2026-09-29T09:00:00Z'),
  });
  const historical = vi.fn().mockResolvedValue({
    actorUserId: 'reservation',
    occurredAt: new Date('2026-09-29T07:00:00Z'),
  });
  const names = vi.fn().mockResolvedValue(
    new Map([
      ['finance', 'Financial responsible'],
      ['files', 'File responsible'],
      ['reservation', 'Reservation responsible'],
    ]),
  );
  const controller = new ReservationRequestsController(
    { lastRecordedOperation: historical } as never,
    {} as never,
    {} as never,
    { detail } as never,
    { read } as never,
    {} as never,
    {
      latestReservationOperation: latest,
      reservationResponsibilityNames: names,
    } as never,
  );
  const request = {
    actor: { permissions: ['reservations.read'], branchIds: ['allowed'] },
  } as never;
  return { controller, request, detail, read, latest, historical, names };
}
describe('authorized compact operation summary', () => {
  it('shows independent Finance approval and latest reservation actor with server times', async () => {
    const s = summaryFixture();
    const { data } = await s.controller.operationSummary('intake', s.request);
    expect(data.delivery).toEqual({
      approved: true,
      updatedAt: '2026-09-29T08:00:00.000Z',
      actorName: 'Financial responsible',
    });
    expect(data.lastOperation).toEqual({
      occurredAt: '2026-09-29T09:00:00.000Z',
      actorName: 'File responsible',
    });
    expect(JSON.stringify(data)).not.toContain('never-expose');
    expect(JSON.stringify(data)).not.toContain('actorUserId');
  });
  it('uses a newer native revision and preserves revocation time and actor', async () => {
    const s = summaryFixture();
    s.historical.mockResolvedValue({
      actorUserId: 'reservation',
      occurredAt: new Date('2026-09-29T10:00:00Z'),
    });
    s.read.mockResolvedValue({
      approved: false,
      updatedAt: '2026-09-29T10:10:00.000Z',
      updatedByUserId: 'finance',
    });
    const { data } = await s.controller.operationSummary('intake', s.request);
    expect(data.delivery.approved).toBe(false);
    expect(data.lastOperation?.actorName).toBe('Reservation responsible');
  });
  it('returns unknown rather than inventing historical responsibility', async () => {
    const s = summaryFixture();
    s.latest.mockResolvedValue(null);
    s.historical.mockResolvedValue(null);
    s.read.mockResolvedValue({
      approved: false,
      updatedAt: null,
      updatedByUserId: null,
    });
    expect(
      (await s.controller.operationSummary('intake', s.request)).data
        .lastOperation,
    ).toBeNull();
    expect(s.names).toHaveBeenCalledWith([], 'allowed', expect.anything());
  });
  it('blocks missing permissions and out-of-branch intake before Finance/actor reads', async () => {
    const s = summaryFixture();
    await expect(
      s.controller.operationSummary('intake', {
        actor: { permissions: [], branchIds: ['allowed'] },
      } as never),
    ).rejects.toThrow(ForbiddenException);
    s.detail.mockRejectedValue(new NotFoundException());
    await expect(
      s.controller.operationSummary('intake', s.request),
    ).rejects.toThrow(NotFoundException);
    expect(s.read).not.toHaveBeenCalled();
    expect(s.names).not.toHaveBeenCalled();
  });
});
