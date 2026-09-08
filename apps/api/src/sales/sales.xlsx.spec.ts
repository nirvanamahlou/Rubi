import { describe, expect, it, vi } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import type { AuthenticatedActor, SalesContractSummary } from '@rubi/contracts';
import { buildSalesXlsx, SALES_EXPORT_LIMIT } from './sales.xlsx';
import { SalesService } from './sales.service';
import { SalesRepository } from './sales.repository';
import type {
  SalesCustomersPublicAdapter,
  SalesTicketAvailabilityPort,
} from './sales.adapters';
import type { DatabaseService } from '../database/database.service';

const sample = {
  id: 'sample',
  version: 1,
  branchId: 'branch',
  customerId: 'customer',
  ownerUserId: 'actor',
  assignedUserId: null,
  originId: 'origin',
  destinationId: 'destination',
  returnNotBefore: null,
  reservationStatus: 'QUEUED',
  createdAt: '2026-09-08T00:00:00Z',
  contractNumber: 'SC-TEST-000001',
  customerNameSnapshot: '=HYPERLINK("https://invalid.test")<&',
  passengerNames: ['not exported', 'also not exported'],
  services: ['FLIGHT', 'HOTEL'],
  status: 'SENT_TO_RESERVATIONS',
  settlementStatus: 'PARTIALLY_SETTLED',
  departureDate: '2026-09-18T00:00:00Z',
  updatedAt: '2026-09-08T22:00:00Z',
  balances: [
    {
      currencyCode: 'IRR',
      amount: '25000000',
      confirmedPaid: '10000000',
      pendingFinance: '5000000',
      outstanding: '15000000',
    },
    {
      currencyCode: 'USD',
      amount: '100.25',
      confirmedPaid: '0',
      pendingFinance: '0',
      outstanding: '100.25',
    },
  ],
} as SalesContractSummary;
const sheet = (records: SalesContractSummary[]) =>
  strFromU8(unzipSync(buildSalesXlsx(records))['xl/worksheets/sheet1.xml']!);

describe('Sales XLSX download', () => {
  it('writes real OOXML with numeric amounts, separate currencies, RTL, filters and frozen headings', () => {
    const bytes = buildSalesXlsx([sample]);
    expect([...bytes.slice(0, 2)]).toEqual([80, 75]);
    const files = unzipSync(bytes),
      data = strFromU8(files['xl/worksheets/sheet1.xml']!);
    expect(data).toContain('rightToLeft="1"');
    expect(data).toContain('ySplit="4"');
    expect(data).toContain('autoFilter ref="A4:L6"');
    expect(data).toContain('<c r="H5" s="7"><v>25000000</v></c>');
    expect(data).toContain('<c r="J5" s="7"><v>15000000</v></c>');
    expect(data).toContain('<c r="H6" s="2"><v>100.25</v></c>');
    expect(data).toContain('IRR');
    expect(data).toContain('USD');
    expect(data).not.toContain('not exported');
    expect(data).not.toContain('<f>');
    expect(data).toContain(
      '=HYPERLINK(&quot;https://invalid.test&quot;)&lt;&amp;',
    );
    expect(Object.keys(files)).not.toContain(
      'xl/externalLinks/externalLink1.xml',
    );
  });
  it('preserves empty balances, zero, negative and high precision amounts without fabricated values', () => {
    expect(sheet([{ ...sample, balances: [] }])).toContain(
      '<c r="H5" s="0" t="inlineStr"><is><t xml:space="preserve"></t>',
    );
    const data = sheet([
      {
        ...sample,
        balances: [
          {
            currencyCode: 'IRR',
            amount: '1234567890123456.78',
            confirmedPaid: '0',
            pendingFinance: '0',
            outstanding: '-0.125',
          },
        ],
      },
    ]);
    expect(data).toContain('>1234567890123456.78</t>');
    expect(data).toContain('<c r="I5" s="7"><v>0</v></c>');
    expect(data).toContain('<c r="J5" s="2"><v>-0.125</v></c>');
    expect(sheet([])).toContain('autoFilter ref="A4:L4"');
  });
  it('writes sortable Gregorian dates with Tehran date for last update', () => {
    const expected = Date.UTC(2026, 8, 9) / 86400000 + 25569;
    expect(sheet([sample])).toContain(`<c r="L5" s="3"><v>${expected}</v></c>`);
  });
  it.each(['own', 'branch', 'all'])(
    'retains %s authorization scope and tracking-search permission',
    async (scope) => {
      const list = vi.fn().mockResolvedValue({ data: [], total: 0 });
      const service = new SalesService(
        { list } as unknown as SalesRepository,
        {} as SalesCustomersPublicAdapter,
        {} as SalesTicketAvailabilityPort,
      );
      const actor = {
        userId: 'actor',
        branchIds: ['b'],
        permissions: ['sales.export', `sales.contracts.read.${scope}`],
      } as unknown as AuthenticatedActor;
      await service.exportXlsx(
        { search: 'TRACK', settlementStatus: 'UNPAID' },
        actor,
      );
      expect(list).toHaveBeenCalledWith(
        { search: 'TRACK', settlementStatus: 'UNPAID' },
        scope === 'all'
          ? {}
          : {
              branchId: { in: ['b'] },
              ...(scope === 'own'
                ? {
                    OR: [{ ownerUserId: 'actor' }, { assignedUserId: 'actor' }],
                  }
                : {}),
            },
        false,
        SALES_EXPORT_LIMIT,
      );
      await expect(
        service.exportXlsx({}, { ...actor, permissions: ['sales.export'] }),
      ).rejects.toThrow('مجوز');
      await expect(
        service.exportXlsx(
          {},
          { ...actor, permissions: ['sales.contracts.read.all'] },
        ),
      ).rejects.toThrow('مجوز');
      await expect(
        service.exportXlsx(
          { search: ['bad'] } as unknown as Parameters<
            typeof service.exportXlsx
          >[0],
          actor,
        ),
      ).rejects.toThrow('فیلتر');
      await expect(
        service.exportXlsx({ settlementStatus: 'bad' } as never, actor),
      ).rejects.toThrow('فیلتر');
      expect(list).toHaveBeenCalledTimes(1);
    },
  );
  it('exports beyond page 20 in one bounded ordered query, without offset or silent truncation', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new SalesRepository({
      client: { salesContract: { findMany } },
    } as unknown as DatabaseService);
    await repository.list(
      { page: 9, pageSize: 20, settlementStatus: 'UNPAID' },
      { branchId: 'b' },
      true,
      SALES_EXPORT_LIMIT,
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: SALES_EXPORT_LIMIT + 1,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      }),
    );
    expect(findMany.mock.calls[0]![0].skip).toBeUndefined();
    const service = new SalesService(
      {} as SalesRepository,
      {} as SalesCustomersPublicAdapter,
      {} as SalesTicketAvailabilityPort,
    );
    vi.spyOn(service, 'list').mockResolvedValue({
      data: Array(SALES_EXPORT_LIMIT + 1).fill(sample),
      meta: {
        total: SALES_EXPORT_LIMIT + 1,
        page: 1,
        pageSize: SALES_EXPORT_LIMIT,
      },
    });
    await expect(
      service.exportXlsx({}, {
        permissions: ['sales.export'],
      } as AuthenticatedActor),
    ).rejects.toThrow('۲۰۰۰');
  });
  it('audits exported contract versions without names or payment details', async () => {
    const recordListExport = vi.fn().mockResolvedValue({ count: 1 });
    const service = new SalesService(
      { recordListExport } as unknown as SalesRepository,
      {} as SalesCustomersPublicAdapter,
      {} as SalesTicketAvailabilityPort,
    );
    vi.spyOn(service, 'list').mockResolvedValue({
      data: [sample],
      meta: { total: 1, page: 1, pageSize: SALES_EXPORT_LIMIT },
    });
    await service.exportXlsx({}, {
      userId: 'actor',
      permissions: ['sales.export'],
    } as unknown as AuthenticatedActor);
    expect(recordListExport).toHaveBeenCalledWith([sample], 'actor');
  });
});
