import { describe, it, expect, vi, afterEach } from 'vitest';
import type { SalesContractDetail } from '@nora/contracts';
import { contractAdvice } from './contract-advice';
import {
  portfolioKind,
  portfolioReport,
  recordReport,
} from './contract-reports';
import { salesApi } from '@/modules/sales/api/client';
import { paymentReceiptsApi } from '@/modules/sales/api/payment-receipts';
vi.mock('@/modules/sales/api/client', () => ({
  salesApi: {
    list: vi.fn(),
    detail: vi.fn(),
    statusHistory: vi.fn(),
    contractAudit: vi.fn(),
    readPurchaseContext: vi.fn(),
  },
}));
vi.mock('@/modules/sales/api/payment-receipts', () => ({
  paymentReceiptsApi: { entries: vi.fn(), list: vi.fn() },
}));
afterEach(() => vi.resetAllMocks());
const contract = {
  id: 'synthetic',
  status: 'CONFIRMED',
  contractNumber: 'A123',
  reservationStatus: 'QUEUED',
  payments: [],
  servicesDetail: [],
} as unknown as SalesContractDetail;
describe('read-only contract reports', () => {
  it('selects assigned work across sellers and excludes work assigned to someone else', async () => {
    vi.mocked(salesApi.list).mockResolvedValue({
      data: [
        {
          ...contract,
          id: 'mine',
          assignedUserId: 'owner',
          ownerUserId: 'other',
        },
        {
          ...contract,
          id: 'theirs',
          contractNumber: 'hidden',
          ownerUserId: 'owner',
          assignedUserId: 'other',
        },
      ],
      meta: { total: 2, page: 1, pageSize: 100 },
    });
    const report = await portfolioReport(
      'قراردادهای من برای پیگیری صفحه ۱',
      'owner',
    );
    expect(salesApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 }),
    );
    expect(report).toContain('A123');
    expect(report).toContain('صفحه 1');
    expect(report).not.toContain('hidden');
    expect(portfolioKind('قراردادهای نیازمند اقدام')).toBeUndefined();
  });
  it('paginates the authorized portfolio and distinguishes denied read from a missing row', async () => {
    vi.mocked(salesApi.list).mockResolvedValue({
      data: [contract],
      meta: { page: 2, pageSize: 10, total: 11 },
    });
    vi.mocked(salesApi.detail).mockRejectedValue({ status: 403 });
    const report = await portfolioReport(
      'مغایرت مالی قراردادها صفحه ۲',
      'owner',
    );
    expect(salesApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 10 }),
    );
    expect(report).toContain('دسترسی');
    expect(report).toContain('A123');
  });
  it('does not measure a stall from last modification when there is no transition', async () => {
    vi.mocked(salesApi.list).mockResolvedValue({
      data: [contract],
      meta: { total: 1, page: 1, pageSize: 10 },
    });
    vi.mocked(salesApi.statusHistory).mockResolvedValue({ data: [] });
    expect(
      await portfolioReport('کدام قرارداد من متوقف است؟', 'owner'),
    ).toContain('زمان ورود به وضعیت ثبت نشده');
    expect(salesApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUserId: 'owner' }),
    );
  });
  it('does not turn a denied receipt source into a zero receipt count', async () => {
    vi.mocked(paymentReceiptsApi.entries).mockRejectedValue({ status: 403 });
    const result = await recordReport('مغایرت رسید', {
      ...contract,
      payments: [
        {
          id: 'p1',
          amount: '180',
          currencyCode: 'USD',
          dueAt: '2026-11-10T00:00:00Z',
          status: 'SCHEDULED',
        } as SalesContractDetail['payments'][number],
      ],
    });
    expect(result).toContain('دسترسی');
    expect(result).toContain('180 USD');
    expect(result).not.toContain('تعداد مدارک ثبت‌شده: 0');
    expect(paymentReceiptsApi.list).not.toHaveBeenCalled();
  });
  it('distinguishes absent approval from denial and does not issue documents', async () => {
    expect(await recordReport('مدارک', contract)).toContain(
      'در این پاسخ موجود نیست',
    );
    expect(
      await recordReport('مدارک', {
        ...contract,
        customerDocumentDeliveryApproved: false,
      }),
    ).toContain('تأیید مالی ندارد');
    expect(salesApi.readPurchaseContext).not.toHaveBeenCalled();
  });
  it('reports audit metadata without emitting snapshots', async () => {
    vi.mocked(salesApi.statusHistory).mockResolvedValue({ data: [] });
    vi.mocked(salesApi.contractAudit).mockResolvedValue({
      data: [
        {
          action: 'amended',
          outcome: 'SUCCESS',
          occurredAt: '2026-10-01T12:00:00Z',
          beforeSnapshot: 'private',
        } as { action: string; outcome: string; occurredAt: string },
      ],
    });
    const result = await recordReport('تغییرات', contract);
    expect(result).toContain('amended');
    expect(result).not.toContain('private');
  });
  it('combines independent edge cases without interpreting a numbered record as a general question', () => {
    const advice = contractAdvice(
      'اگر قرارداد تکراری شد و قیمت تغییر کرد؟',
      true,
    );
    expect(advice).toContain('فرم جدید');
    expect(advice).toContain('ظرفیت');
    expect(contractAdvice('قرارداد ۱۲۳ تکراری است', true)).toBeUndefined();
  });
});
