import { describe, expect, it, vi } from 'vitest';
import {
  ProcurementApiError,
  procurementRequest,
} from '@/modules/procurement/api';
import catalog from './petty-cash.generated.json';
import {
  pettyCashReadError,
  readPettyCashGuide,
  resolvePettyCashGuide,
} from './petty-cash-guide';

vi.mock('@/modules/procurement/api', async (actual) => ({
  ...(await actual<typeof import('@/modules/procurement/api')>()),
  procurementRequest: vi.fn(),
}));

const id = '12345678-1234-4234-8234-123456789abc';
const signal = new AbortController().signal;

describe('petty cash guide', () => {
  it.each(catalog)('routes the example for $id', ({ id, examples }) => {
    expect(resolvePettyCashGuide(examples[0]!, '/purchases')).toMatchObject({
      kind: 'guide',
      topic: { id },
    });
  });

  it('handles follow-up, exact amounts and other panels', () => {
    expect(
      resolvePettyCashGuide('بعدش چی؟', '/workbench', 'expense'),
    ).toMatchObject({ kind: 'guide', followUp: true });
    expect(
      resolvePettyCashGuide('موجودی تنخواه چقدر است؟', '/workbench'),
    ).toMatchObject({ kind: 'clarify' });
    expect(
      resolvePettyCashGuide('خرید بلیط را از کجا ثبت کنم؟', '/purchases'),
    ).toBeUndefined();
    expect(
      resolvePettyCashGuide(
        'درخواست من در چه مرحله‌ای است؟',
        '/purchases',
        undefined,
        id,
      ),
    ).toMatchObject({ kind: 'request', code: id });
  });

  it('reads only an exact authorized request and provides the existing deep link', async () => {
    vi.mocked(procurementRequest).mockResolvedValueOnce({
      items: [
        {
          id,
          number: 'PR-' + id,
          status: 'IN_REVIEW',
          requesterUserId: 'sensitive',
        },
      ],
      hasMore: false,
    });
    const result = await readPettyCashGuide(
      { kind: 'request', code: 'pr-' + id },
      signal,
    );
    expect(result.text).toContain('در بررسی');
    expect(result.text).not.toContain('sensitive');
    expect(result.href).toBe('/purchases?section=requests&request=' + id);
    expect(procurementRequest).toHaveBeenLastCalledWith(
      expect.stringContaining('/requests?search='),
      { signal },
    );
  });

  it('distinguishes incomplete lookup from a missing request and permission failure', async () => {
    vi.mocked(procurementRequest).mockResolvedValueOnce({
      items: [],
      hasMore: true,
    });
    expect(
      (await readPettyCashGuide({ kind: 'request', code: 'pr-' + id }, signal))
        .text,
    ).toContain('نتیجهٔ یکتا');
    expect(pettyCashReadError(new ProcurementApiError('', 403))).toContain(
      'دسترسی',
    );
    expect(pettyCashReadError(new ProcurementApiError('', 404))).toContain(
      'پیدا نشد',
    );
    expect(pettyCashReadError(new Error())).toContain('ناموفق');
  });

  it('preserves decimal and currency, omits banking fields and distinguishes an unconfigured fund', async () => {
    const intent = {
      kind: 'fund',
      branchQuery: 'موجودی تنخواه شعبه دفتر مرکزی چقدر است',
    } as const;
    vi.mocked(procurementRequest)
      .mockResolvedValueOnce({ branches: [{ id, label: 'دفتر مرکزی' }] })
      .mockResolvedValueOnce({
        balance: '12345678901234567890.001',
        currencyCode: 'IRR',
        cardNumber: 'secret',
      });
    const result = await readPettyCashGuide(intent, signal);
    expect(result.text).toContain('12345678901234567890.001 IRR');
    expect(result.text).not.toContain('secret');
    vi.mocked(procurementRequest)
      .mockResolvedValueOnce({ branches: [{ id, label: 'دفتر مرکزی' }] })
      .mockResolvedValueOnce(null);
    expect((await readPettyCashGuide(intent, signal)).text).toContain(
      'تنظیم نشده',
    );
  });
});
