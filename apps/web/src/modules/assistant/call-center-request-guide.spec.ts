import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import {
  callCenterIntent,
  readCallCenterMetric,
  readCallCenterRequestStatus,
} from './call-center-request-guide';

const { branches, queue, list, kpis } = vi.hoisted(() => ({
  branches: vi.fn(),
  queue: vi.fn(),
  list: vi.fn(),
  kpis: vi.fn(),
}));
vi.mock('@/modules/call-center/read-client', () => ({
  readApi: { branches, kpis },
}));
vi.mock('@/modules/call-center/workflow-client', () => ({
  workflowApi: { queue, list },
}));
vi.mock('@/modules/call-center/workflow', () => ({
  requestLabels: { WAITING_CUSTOMER: 'منتظر پاسخ مشتری' },
}));
const actor: AuthenticatedActor = {
  userId: 'synthetic',
  sessionId: 'test',
  branchIds: ['branch-1'],
  permissions: ['customer_affairs.call_center.read'],
};
const row = {
  id: '11111111-1111-4111-8111-111111111111',
  contactId: '22222222-2222-4222-8222-222222222222',
  branchId: 'branch-1',
  title: 'درخواست نمونه',
  ownerName: 'کارشناس نمونه',
  status: 'WAITING_CUSTOMER',
};
const signal = new AbortController().signal;

describe('Call Center status guide', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    branches.mockResolvedValue({
      data: [{ id: 'branch-1' }],
      meta: { defaultBranchId: 'branch-1' },
    });
    queue.mockResolvedValue({ data: [row], meta: { total: 1 } });
  });
  it('reads the native scoped queue and returns the recorded owner and status', async () => {
    const result = await readCallCenterRequestStatus(
      'درخواستم دست کیه؟',
      actor,
      signal,
    );
    expect(queue).toHaveBeenCalledWith('branch-1', 'MINE', 1, signal);
    expect(result).toContain('منتظر پاسخ مشتری');
    expect(result).toContain('کارشناس نمونه');
  });
  it('does not query a branch outside the actor scope', async () => {
    branches.mockResolvedValue({
      data: [{ id: 'other' }],
      meta: { defaultBranchId: 'other' },
    });
    await readCallCenterRequestStatus('درخواستم دست کیه؟', actor, signal);
    expect(queue).not.toHaveBeenCalled();
  });
  it('does not guess ownership from an ambiguous or incomplete queue', async () => {
    queue.mockResolvedValue({ data: [row], meta: { total: 51 } });
    expect(
      await readCallCenterRequestStatus('درخواستم دست کیه؟', actor, signal),
    ).not.toContain(row.ownerName);
    queue.mockResolvedValue({ data: [], meta: { total: 0 } });
    expect(
      await readCallCenterRequestStatus('درخواستم دست کیه؟', actor, signal),
    ).toContain('پیدا نشد');
  });

  it('searches the next page and reads current ownership and review separately', async () => {
    queue
      .mockReset()
      .mockResolvedValueOnce({
        data: [{ ...row, id: 'other', title: 'عنوان دیگر' }],
        meta: { total: 2 },
      })
      .mockResolvedValueOnce({ data: [row], meta: { total: 2 } });
    list.mockResolvedValue({
      data: [{ ...row, ownerName: 'مسئول جدید', review: { pending: true } }],
    });
    const answer = await readCallCenterRequestStatus(
      'وضعیت درخواست «درخواست نمونه» چیست؟',
      actor,
      signal,
    );
    expect(queue).toHaveBeenNthCalledWith(2, 'branch-1', 'ALL', 2, signal);
    expect(list).toHaveBeenCalledWith(
      'branch-1',
      row.contactId,
      signal,
      1,
      1,
      row.id,
    );
    expect(answer).toContain('مسئول جدید');
    expect(answer).toContain('در انتظار بررسی مدیر');
    expect(answer).not.toContain(row.ownerName);
  });

  it('does not open a record if its title is duplicated or the search is incomplete', async () => {
    queue.mockResolvedValueOnce({
      data: [row, { ...row, id: 'other' }],
      meta: { total: 2 },
    });
    expect(
      await readCallCenterRequestStatus(
        'وضعیت درخواست «درخواست نمونه»',
        actor,
        signal,
      ),
    ).toContain('شناسه');
    queue.mockReset().mockResolvedValue({ data: [row], meta: { total: 4 } });
    await readCallCenterRequestStatus(
      'وضعیت درخواست «درخواست نمونه»',
      actor,
      signal,
    );
    expect(queue).toHaveBeenCalledTimes(3);
    expect(list).not.toHaveBeenCalled();
  });

  it('discards a response when the active reading is aborted', async () => {
    const controller = new AbortController();
    queue.mockImplementation(() => {
      controller.abort();
      return Promise.resolve({ data: [row], meta: { total: 1 } });
    });
    await expect(
      readCallCenterRequestStatus(
        'درخواستم دست کیه؟',
        actor,
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('routes whole cards to native KPI reads and filtered questions to reports', async () => {
    expect(callCenterIntent('تعداد تماس های امروز چقدره؟', true)).toBe('today');
    expect(callCenterIntent('چند تماس ورودی امروز داشتم؟', true)).toBe(
      'report',
    );
    expect(
      callCenterIntent('چطور درخواست را ارجاع بدهم؟', true),
    ).toBeUndefined();
    expect(callCenterIntent('مرخصی من دست کیه؟', true)).toBeUndefined();
    expect(callCenterIntent('درخواستم الان دست کیه؟', false)).toBeUndefined();
    kpis.mockResolvedValue({
      data: { today: 3 },
      meta: { branchId: 'branch-1', asOf: '2026-11-19T08:00:00Z' },
    });
    expect(await readCallCenterMetric('today', actor, signal)).toContain('۳');
    expect(kpis).toHaveBeenCalledWith('branch-1', signal);
  });
});
