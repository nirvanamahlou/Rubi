import { describe, expect, it, vi } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';

import type { LocalDocumentStorage } from '../documents/documents.storage';
import { validateStorageObjectKey } from '../documents/documents.validation';
import { ReportingExportService } from './reporting-export.service';
import type { TravelReportResultV1 } from './reporting.contracts';

describe('ReportingExportService storage boundary', () => {
  it('uses the compact report, timestamp, filters and banded dataset Excel table', () => {
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
        {
          grainId: '000456',
          orderCount: 9,
          salesAmount: '12345678901234567890.12',
        },
      ],
      filterSnapshot: {
        branchIds: [],
        filters: {
          fromUtc: '2026-09-01T00:00:00.000Z',
          currencyCode: 'IRR',
        },
      },
    } as unknown as TravelReportResultV1;

    const workbook = unzipSync(
      new Uint8Array(
        service.build('XLSX', result, 'سود قرارداد و خدمت').buffer,
      ),
    );
    const sheet = strFromU8(workbook['xl/worksheets/sheet1.xml']!);
    const styles = strFromU8(workbook['xl/styles.xml']!);
    const table = strFromU8(workbook['xl/tables/table1.xml']!);
    const relationships = strFromU8(
      workbook['xl/worksheets/_rels/sheet1.xml.rels']!,
    );
    const contentTypes = strFromU8(workbook['[Content_Types].xml']!);

    expect(sheet).toContain('<row r="1">');
    expect(sheet).toContain('سود قرارداد و خدمت');
    expect(sheet).toContain(
      '<c r="A1" s="5" t="inlineStr"><is><t>سود قرارداد و خدمت</t></is></c>',
    );
    expect(sheet).toContain('زمان تولید گزارش');
    expect(sheet).toContain('تاریخ شمسی');
    expect(sheet).toContain('ساعت خروجی گرفتن');
    expect(sheet).toContain('۱۴۰۵/۰۶/۲۴');
    expect(sheet).toContain('۱۳:۳۰:۰۰');
    expect(sheet).not.toContain('2026-09-15T10:00:00.000Z');
    expect(sheet).not.toContain('contract_service_profit');
    expect(sheet).not.toContain('reporting.travel.facts.v1');
    expect(sheet).toMatch(/<row r="5">.*از تاریخ \(UTC\).*ارز.*<\/row>/);
    expect(sheet).toMatch(
      /<row r="6"[^>]*>.*2026-09-01T00:00:00.000Z.*IRR.*<\/row>/,
    );
    expect(sheet).toMatch(/<row r="7">.*شناسه.*تعداد سفارش.*فروش.*<\/row>/);
    expect(sheet).toContain(
      '<c r="A8" t="inlineStr"><is><t>000123</t></is></c>',
    );
    expect(sheet).toContain('<c r="B8" s="4"><v>1234567</v></c>');
    expect(sheet).toContain('<c r="C8" s="4"><v>1234567.89</v></c>');
    expect(sheet).toContain('12,345,678,901,234,567,890.12');
    expect(styles).toContain('formatCode="#,##0.##########"');
    expect(styles).toContain('horizontal="center" vertical="center"');
    expect(styles).toContain('<sz val="16"/>');
    expect(sheet).toContain('showGridLines="0"');
    expect(sheet).toContain('<mergeCell ref="A1:C1"/>');
    expect(sheet).toContain('<mergeCell ref="A2:B2"/>');
    expect(sheet).toContain('ySplit="7" topLeftCell="A8"');
    expect(sheet).toContain(
      '<tableParts count="1"><tablePart r:id="rId1"/></tableParts>',
    );
    expect(table).toContain('ref="A7:C9"');
    expect(table).toContain('<autoFilter ref="A7:C9"/>');
    expect(table).toContain('name="TableStyleMedium2"');
    expect(table).toContain('showRowStripes="1"');
    expect(relationships).toContain(
      'relationships/table" Target="../tables/table1.xml"',
    );
    expect(contentTypes).toContain('/xl/tables/table1.xml');
  });

  it('makes duplicate or blank headers valid for a native Excel table', () => {
    const service = new ReportingExportService({} as LocalDocumentStorage);
    const result = {
      reportCode: 'duplicate_headers',
      sourceProjection: 'reporting.travel.facts.v1',
      generatedAtUtc: '2026-09-15T10:00:00.000Z',
      columns: [
        { key: 'first', label: 'مقدار', kind: 'NUMBER' },
        { key: 'second', label: 'مقدار', kind: 'NUMBER' },
        { key: 'third', label: ' ', kind: 'NUMBER' },
      ],
      rows: [{ first: 1, second: 2, third: 3 }],
      filterSnapshot: { branchIds: [], filters: {} },
    } as unknown as TravelReportResultV1;

    const workbook = unzipSync(
      new Uint8Array(service.build('XLSX', result, 'گزارش').buffer),
    );
    const sheet = strFromU8(workbook['xl/worksheets/sheet1.xml']!);
    const table = strFromU8(workbook['xl/tables/table1.xml']!);

    expect(sheet).toContain('<row r="7">');
    expect(sheet).toContain('مقدار (2)');
    expect(sheet).toContain('ستون 3');
    expect(table).toContain('<tableColumn id="1" name="مقدار"/>');
    expect(table).toContain('<tableColumn id="2" name="مقدار (2)"/>');
    expect(table).toContain('<tableColumn id="3" name="ستون 3"/>');
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
