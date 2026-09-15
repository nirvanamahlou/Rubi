import { describe, expect, it, vi } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';

import type { LocalDocumentStorage } from '../documents/documents.storage';
import { validateStorageObjectKey } from '../documents/documents.validation';
import { ReportingExportService } from './reporting-export.service';
import type { TravelReportResultV1 } from './reporting.contracts';

describe('ReportingExportService storage boundary', () => {
  it('places the title, UTC time, two-row filter table and typed dataset in Excel', () => {
    const service = new ReportingExportService({} as LocalDocumentStorage);
    const result = {
      reportCode: 'contract_service_profit',
      sourceProjection: 'reporting.travel.facts.v1',
      generatedAtUtc: '2026-09-15T10:00:00.000Z',
      columns: [
        { key: 'grainId', label: 'شناسه', kind: 'TEXT' },
        { key: 'orderCount', label: 'تعداد سفارش', kind: 'NUMBER' },
        { key: 'salesAmount', label: 'فروش', kind: 'MONEY' },
      ],
      rows: [
        { grainId: '000123', orderCount: 1234567, salesAmount: '1234567.89' },
        { grainId: '000456', orderCount: 9, salesAmount: '12345678901234567890.12' },
      ],
      filterSnapshot: {
        branchIds: [],
        filters: {
          fromUtc: '2026-09-01T00:00:00.000Z',
          currencyCode: 'IRR',
        },
      },
    } as unknown as TravelReportResultV1;

    const workbook = unzipSync(new Uint8Array(service.build('XLSX', result, 'سود قرارداد و خدمت').buffer));
    const sheet = strFromU8(workbook['xl/worksheets/sheet1.xml']!);
    const table = strFromU8(workbook['xl/tables/table1.xml']!);
    const styles = strFromU8(workbook['xl/styles.xml']!);

    expect(sheet).toContain('<row r="1">');
    expect(sheet).toContain('سود قرارداد و خدمت');
    expect(sheet).toContain('زمان تولید UTC');
    expect(sheet).toContain('2026-09-15T10:00:00.000Z');
    expect(sheet).not.toContain('contract_service_profit');
    expect(sheet).not.toContain('reporting.travel.facts.v1');
    expect(sheet).toMatch(/<row r="2">.*از تاریخ \(UTC\).*ارز.*<\/row>/);
    expect(sheet).toMatch(/<row r="3"[^>]*>.*2026-09-01T00:00:00.000Z.*IRR.*<\/row>/);
    expect(sheet).toMatch(/<row r="4">.*شناسه.*تعداد سفارش.*فروش.*<\/row>/);
    expect(sheet).toContain('<c r="A5" t="inlineStr"><is><t>000123</t></is></c>');
    expect(sheet).toContain('<c r="B5" s="4"><v>1234567</v></c>');
    expect(sheet).toContain('<c r="C5" s="4"><v>1234567.89</v></c>');
    expect(sheet).toContain('12,345,678,901,234,567,890.12');
    expect(styles).toContain('formatCode="#,##0.##########"');
    expect(table).toContain('ref="A4:C6"');
  });

  it('stores exports with the versioned key accepted by Documents storage', async () => {
    const putQuarantined = vi.fn().mockResolvedValue(undefined);
    const service = new ReportingExportService({
      putQuarantined,
    } as unknown as LocalDocumentStorage);
    const exportId = '4b646cf7-c56c-4d4a-9a69-18450ad2b14d';
    const buffer = Buffer.from('report');

    const key = await service.store(exportId, 'xlsx', buffer);

    expect(key).toMatch(
      /^documents\/4b646cf7-c56c-4d4a-9a69-18450ad2b14d\/v1\/[0-9a-f-]{36}\.bin$/,
    );
    expect(validateStorageObjectKey(key)).toBe(true);
    expect(putQuarantined).toHaveBeenCalledWith(key, buffer);
  });
});
