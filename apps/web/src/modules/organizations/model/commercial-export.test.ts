import { describe, it, expect, vi } from 'vitest';
import type {
  B2bAgreementCaseV1,
  B2bAgencyAgreedRateV1,
} from '@rubi/contracts';
import { blankAgreementTerms } from './agreement-terms';
import {
  agreementReport,
  collectAgreementExport,
  commercialWorkbookRows,
  ratesReport,
} from './commercial-export';
import { createOrganizationXlsx, unzipWorkbook } from './organization-xlsx';
import {
  buildCommercialPdf,
  isolateCommercialIdentifiers,
} from './commercial-pdf';

const record = (id = 'a'): B2bAgreementCaseV1 => ({
  id,
  organizationId: 'org',
  branchId: 'branch',
  role: 'AGENCY',
  code: id,
  title: 'قرارداد',
  startsAt: '2026-09-01',
  endsAt: null,
  status: 'DRAFT',
  version: 1,
  activeRevisionId: null,
  revisions: [
    {
      ...blankAgreementTerms(),
      id: 'revision',
      number: 2,
      status: 'DRAFT',
      title: '=SUM(A1)',
      startsAt: '2026-09-01',
      createdAt: '2026-09-01',
      createdByUserId: 'private',
      submittedByUserId: null,
      submittedAt: null,
      reviewedByUserId: null,
      reviewedAt: null,
      reviewReason: null,
      creditPolicies: [
        {
          currencyCode: 'USD',
          creditLimit: '9999999999999999.1234',
          effectiveFrom: '2026-09-01',
          expiresAt: '2026-09-30',
          dueDays: 5,
          limitType: 'HARD',
          overdueAction: 'BLOCK',
        },
      ],
      guarantees: ['2026-09-01', '2026-10-01'].map((date, i) => ({
        kind: 'CHEQUE',
        reference: String(i),
        amount: '100.0001',
        currencyCode: 'USD',
        issuer: 'بانک',
        receivedAt: date,
        expiresAt: null,
        status: 'REQUIRED',
        documentId: null,
      })),
    },
  ],
});
const range = { from: '2026-09-01', to: '2026-09-30' };
describe('commercial exports', () => {
  it('isolates dates and exact decimal strings in Persian PDF text', () => {
    expect(isolateCommercialIdentifiers('شروع: 2026-09-11')).toBe(
      'شروع: \u20662026-09-11\u2069',
    );
    expect(isolateCommercialIdentifiers('مبلغ: 100.0001 USD')).toBe(
      'مبلغ: \u2066100.0001\u2069 \u2066USD\u2069',
    );
  });
  it('collects every page, deduplicates, and fails rather than exporting partial data', async () => {
    const read = vi.fn(async (page: number) => ({
      data: page === 1 ? [record()] : [record(), record('b')],
      meta: { totalPages: 2 },
    }));
    expect(
      (await collectAgreementExport(read, () => true)).map((r) => r.id),
    ).toEqual(['a', 'b']);
    expect(read).toHaveBeenLastCalledWith(2);
    await expect(
      collectAgreementExport(
        async (page) => {
          if (page === 2) throw Error('denied');
          return read(page);
        },
        () => true,
      ),
    ).rejects.toThrow('denied');
  });
  it('cancels stale scope before creating a report', async () => {
    let active = true;
    await expect(
      collectAgreementExport(
        async () => {
          active = false;
          return { data: [record()], meta: { totalPages: 1 } };
        },
        () => active,
      ),
    ).rejects.toThrow('لغو');
  });
  it('keeps exact currency decimals and latest draft status without private actor identifiers', () => {
    const report = agreementReport([record()], 'agreements', range, [
      'شعبه نمونه',
    ]);
    const cells = commercialWorkbookRows(report).flat();
    expect(cells).toContain('9999999999999999.1234');
    expect(cells).toContain('USD');
    expect(cells).toContain('پیش‌نویس');
    expect(cells).not.toContain('private');
  });
  it('filters child guarantee dates individually and handles empty/inverted ranges', () => {
    expect(
      agreementReport([record()], 'guarantees', range, []).sections[0]?.rows,
    ).toHaveLength(1);
    expect(
      agreementReport(
        [record()],
        'agreements',
        { from: '2027-01-01', to: '' },
        [],
      ).sections[0]?.rows,
    ).toHaveLength(0);
    expect(
      agreementReport(
        [record()],
        'agreements',
        { from: '2026-10-01', to: '2026-01-01' },
        [],
      ).sections[0]?.rows,
    ).toHaveLength(0);
  });
  it('separates discount from commission and preserves percentages and dates', () => {
    const rate = {
      code: 'r',
      title: 'نرخ',
      kind: 'DISCOUNT_PERCENT',
      value: '2.1234',
      currencyCode: null,
      serviceReference: 'FLIGHT',
      validFrom: '2026-09-01',
      validTo: null,
      isActive: false,
    } as B2bAgencyAgreedRateV1;
    expect(
      ratesReport([rate], 'COMMISSION_PERCENT', range, []).sections[0]?.rows,
    ).toHaveLength(0);
    expect(
      ratesReport([rate], 'DISCOUNT_PERCENT', range, []).sections[0]?.rows[0],
    ).toContain('2.1234');
  });
  it('writes Excel cells as text, including formula-like titles and exact decimals', async () => {
    const bytes = createOrganizationXlsx(
      commercialWorkbookRows(
        agreementReport([record()], 'agreements', range, []),
      ),
    );
    const files = await unzipWorkbook(new Uint8Array(bytes).buffer);
    const xml = files.get('xl/worksheets/sheet1.xml');
    expect(xml).toContain('=SUM(A1)');
    expect(xml).toContain('9999999999999999.1234');
    expect(xml).not.toContain('<f>');
  });
  it('generates multiple PDF pages with valid cross-reference byte offsets', () => {
    const bytes = buildCommercialPdf([
      new Uint8Array([255, 216, 255, 217]),
      new Uint8Array([255, 216, 255, 217]),
    ]);
    const pdf = new TextDecoder('latin1').decode(bytes);
    expect(pdf).toContain('/Count 2');
    expect(pdf).toContain('/MediaBox [0 0 595 842]');
    const start = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    expect(pdf.slice(start, start + 4)).toBe('xref');
    for (const match of pdf.matchAll(/(\d{10}) 00000 n/g)) {
      expect(pdf.slice(Number(match[1]), Number(match[1]) + 20)).toMatch(
        /^\d+ 0 obj/,
      );
    }
  });
});
