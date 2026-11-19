import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { readCallCenterRequestStatus } from './call-center-request-guide';

const { branches, queue } = vi.hoisted(() => ({
  branches: vi.fn(),
  queue: vi.fn(),
}));
vi.mock('@/modules/call-center/read-client', () => ({ readApi: { branches } }));
vi.mock('@/modules/call-center/workflow-client', () => ({
  workflowApi: { queue },
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
});
