import { describe, expect, it, vi } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { Prisma, type DatabaseClient } from '@nora/database';
import type { ReportSource } from '../common/report-source';
import { boundedSource, sourceFilters } from '../common/report-source';
import { readCustomerReporting } from '../customers/customer-reporting.public';
import { readDocumentComplianceReporting } from '../documents/document-reporting.public';
import { readHrAttendanceReporting } from '../hr/hr-reporting.public';
import { readTicketCapacityReporting } from '../ticket-catalog/ticket-reporting.public';
import { readHotelRateReporting } from '../reservations/hotel-rate-reporting.public';
import { readReservationReporting } from '../reservations/reservation-reporting.public';
import { readExportAuditReporting } from './reporting-native-audit';
import { assembleOperationalResult } from './reporting-native-operational';
import { ReportingExportService } from './reporting-export.service';
import type { LocalDocumentStorage } from '../documents/documents.storage';

vi.mock('../sales/sales-reporting-eligibility.public', () => ({
  readSalesReportingEligibility: vi.fn(async () => ['contract']),
}));
const at = new Date('2026-11-01T10:00:00Z');
const actor = {
  userId: 'user',
  branchIds: ['branch'],
  permissions: ['reporting.read'],
};
const query = {
  filters: {},
  page: 1,
  pageSize: 5,
  timezone: 'Asia/Tehran' as const,
};
const source: ReportSource = {
  projection: 'tickets.reporting.capacity.v1',
  chartMeasure: 'allocated',
  columns: [
    { key: 'primaryDimension', label: 'پرواز', kind: 'TEXT' },
    { key: 'allocated', label: 'تخصیص فعال', kind: 'NUMBER' },
  ],
  rows: Array.from({ length: 12 }, (_, n) => ({
    id: String(n).padStart(2, '0'),
    at,
    updatedAt: at,
    values: { primaryDimension: `پرواز ${n}`, allocated: n },
  })),
  warnings: [],
};
const db = (value: unknown) => value as DatabaseClient;

describe('operational dataset, pagination and exact export columns', () => {
  it('sorts before five-row pagination and exports the complete same dataset', () => {
    const preview = assembleOperationalResult(
      'ticket_capacity',
      { ...query, page: 2 },
      actor,
      source,
    );
    const all = assembleOperationalResult(
      'ticket_capacity',
      query,
      actor,
      source,
      true,
    );
    expect(preview.rows.map((r) => r.sourceValues?.allocated)).toEqual([
      6, 5, 4, 3, 2,
    ]);
    expect(all.rows).toHaveLength(12);
    expect(preview.total).toBe(12);
    expect(preview.totalsByCurrency).toEqual([]);
    expect(source.rows[0]?.values.allocated).toBe(0);
    expect(preview.sourceDataAsOfUtc).toBe(at.toISOString());
  });
  it('uses Decimal ordering rather than floating point for money', () => {
    const money: ReportSource = {
      ...source,
      chartMeasure: 'amount',
      columns: [{ key: 'amount', label: 'مبلغ', kind: 'MONEY' }],
      rows: ['9999999999999999.01', '9999999999999999.02'].map((v) => ({
        id: v,
        at,
        updatedAt: at,
        values: { amount: v },
      })),
    };
    expect(
      assembleOperationalResult('ticket_capacity', query, actor, money).rows[0]
        ?.sourceValues?.amount,
    ).toBe('9999999999999999.02');
  });
  it('sorts unavailable numeric values last without turning them into zero', () => {
    const withUnknown: ReportSource = {
      ...source,
      rows: [
        { id: 'unknown', at, updatedAt: at, values: { allocated: 'نامشخص' } },
        ...source.rows,
      ],
    };
    const result = assembleOperationalResult(
      'ticket_capacity',
      { ...query, sort: { column: 'allocated', direction: 'ASC' } },
      actor,
      withUnknown,
      true,
    );
    expect(result.rows.at(-1)?.sourceValues?.allocated).toBe('نامشخص');
    expect(result.rows[0]?.sourceValues?.allocated).toBe(0);
  });
  it('does not accept unsupported sort columns or a mismatched source', () => {
    expect(() =>
      assembleOperationalResult(
        'ticket_capacity',
        { ...query, sort: { column: 'salary', direction: 'ASC' } },
        actor,
        source,
      ),
    ).toThrow();
    expect(() =>
      assembleOperationalResult(
        'customer_portfolio_growth',
        query,
        actor,
        source,
      ),
    ).toThrow('Report source mismatch');
  });
  it('preserves source columns and values in CSV and styled Excel, without fake sales', () => {
    const all = assembleOperationalResult(
      'ticket_capacity',
      query,
      actor,
      source,
      true,
    );
    const exporter = new ReportingExportService({} as LocalDocumentStorage);
    const csv = exporter.build('CSV', all, 'ظرفیت').buffer.toString('utf8');
    const zip = unzipSync(
      new Uint8Array(exporter.build('XLSX', all, 'ظرفیت').buffer),
    );
    const xml = strFromU8(zip['xl/worksheets/sheet1.xml']!);
    expect(csv).toContain('تخصیص فعال');
    expect(csv).toContain('پرواز 11,11');
    expect(xml).toContain('پرواز 11');
    expect(xml).toContain('<v>11</v>');
    expect(xml).not.toContain('سود ناخالص');
    expect(xml).toContain('showGridLines="0"');
    expect(strFromU8(zip['xl/styles.xml']!)).toContain('B Nazanin');
  });
  it('rejects unsupported company, array and unknown filters, and refuses truncation', () => {
    expect(() =>
      sourceFilters({ filters: {}, legalEntityId: 'company' }, []),
    ).toThrow();
    expect(() => sourceFilters({ filters: { salary: '1' } }, [])).toThrow();
    expect(() =>
      sourceFilters({ filters: { branch: ['branch'] } }, ['branch']).scalar(
        'branch',
      ),
    ).toThrow();
    expect(() => boundedSource(Array.from({ length: 10001 }))).toThrow();
  });
});

describe('owning producer permissions and source-specific predicates', () => {
  it('Reporting permission alone cannot read operational sources', async () => {
    for (const read of [
      readCustomerReporting,
      readDocumentComplianceReporting,
      readHrAttendanceReporting,
      readTicketCapacityReporting,
      readHotelRateReporting,
    ])
      await expect(read(db({}), actor, query)).rejects.toThrow();
  });
  it('customer registrations exclude merged and passenger-only identities and intersect branches', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([
        { id: 'c', kind: 'PERSON', createdAt: at, updatedAt: at },
      ]);
    const result = await readCustomerReporting(
      db({ customer: { findMany } }),
      { ...actor, permissions: ['customers.read'] },
      { filters: { branch: 'foreign' } },
    );
    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({
      ownerBranchId: { in: [] },
      isCustomer: true,
      mergedIntoId: null,
    });
    expect(result.rows[0]?.values.recordCount).toBe(1);
  });
  it('HR self/team permissions do not widen to personnel aggregates', async () => {
    await expect(
      readHrAttendanceReporting(
        db({}),
        { ...actor, permissions: ['hr.self', 'hr.team'] },
        query,
      ),
    ).rejects.toThrow();
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'r',
        employeeId: 'e',
        employee: { unit: 'واحد نمونه' },
        effectiveAt: at,
        updatedAt: at,
        status: 'حاضر',
      },
    ]);
    const result = await readHrAttendanceReporting(
      db({ hrRecord: { findMany } }),
      { ...actor, permissions: ['hr.read'] },
      query,
    );
    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({
      branchId: { in: ['branch'] },
      deletedAt: null,
      section: 'time',
      tab: 'attendance',
      employee: { deletedAt: null },
    });
    expect(result.rows[0]?.values.recordCount).toBe(1);
  });
  it('document aggregate excludes confidential/deleted/foreign feedback and uses native domains', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await readDocumentComplianceReporting(
      db({ document: { findMany } }),
      { ...actor, permissions: ['documents.read'] },
      query,
    );
    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({
      branchId: { in: ['branch'] },
      confidentiality: 'INTERNAL',
      archiveStatus: { not: 'DELETED' },
      documentType: { domain: { in: ['GENERAL'] } },
      NOT: {
        sourceModule: 'WORKBENCH',
        sourceEntityType: 'WorkbenchFeedback',
        ownerUserId: { not: 'user' },
      },
    });
  });
  it('capacity counts only active allocations and unexpired active holds without clipping deficits', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'offer',
        createdAt: at,
        departureAt: at,
        carrierName: 'نمونه',
        serviceNumber: '1',
        totalCapacity: 10,
        status: 'ACTIVE',
        capacityAllocations: [{ quantity: 9, createdAt: at }],
        capacityHolds: [{ quantity: 2, createdAt: at }],
      },
    ]);
    const result = await readTicketCapacityReporting(
      db({ ticketPublishedOffer: { findMany } }),
      { ...actor, permissions: ['ticket_catalog.read'] },
      query,
    );
    expect(result.rows[0]?.values.remaining).toBe(-1);
    expect(
      findMany.mock.calls[0]?.[0].select.capacityAllocations.where.status,
    ).toBe('ACTIVE');
    expect(
      findMany.mock.calls[0]?.[0].select.capacityHolds.where.expiresAt.gt,
    ).toBeInstanceOf(Date);
  });
  it('hotel rates use only the exact current version of a nonarchived pack', async () => {
    const rate = {
      id: 'rate',
      hotelName: 'هتل نمونه',
      brokerName: 'کارگزار نمونه',
      base: new Prisma.Decimal('10.5'),
      currency: 'USD',
      roomRates: [],
    };
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'pack',
        currentVersion: 2,
        updatedAt: at,
        versions: [
          {
            id: 'old',
            version: 1,
            checkIn: at,
            checkOut: at,
            rows: [{ ...rate, id: 'old-rate' }],
          },
          { id: 'new', version: 2, checkIn: at, checkOut: at, rows: [rate] },
        ],
      },
    ]);
    const result = await readHotelRateReporting(
      db({ reservationHotelRatePack: { findMany } }),
      { ...actor, permissions: ['reservations.read'] },
      query,
    );
    expect(result.rows.map((r) => r.id)).toEqual(['rate']);
    expect(findMany.mock.calls[0]?.[0].where.archivedAt).toBe(null);
  });
  it('export audit remains own-only even for report managers', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await readExportAuditReporting(
      db({ reportingExportArtifact: { findMany } }),
      { ...actor, permissions: ['reporting.audit.read', 'reporting.manage'] },
      query,
    );
    expect(findMany.mock.calls[0]?.[0].where.creatorUserId).toBe('user');
    await expect(
      readExportAuditReporting(
        db({}),
        { ...actor, permissions: ['reporting.audit.read'] },
        { filters: { status: 'INVALID' } },
      ),
    ).rejects.toThrow();
  });
});

describe('reservation version, purchase and issued-person grains', () => {
  const purchase = {
    id: 'p',
    createdAt: at,
    version: 1,
    amount: new Prisma.Decimal(20),
    currencyCode: 'USD',
    serviceKind: 'HOTEL',
    serviceClientKey: 'a',
    coveredServiceClientKeys: ['a', 'b'],
    supplierOrganizationId: 'supplier',
    supplierBrokerId: null,
    supplierNameSnapshot: 'تأمین‌کننده نمونه',
  };
  const intake = {
    id: 'i',
    contractId: 'contract',
    contractVersion: 2,
    snapshot: { contractNumber: 'T-1' },
    status: 'QUEUED',
    receivedAt: at,
    workflowRevisions: [],
    ticketDocuments: [],
    servicePurchases: [purchase],
  };
  const reservationActor = { ...actor, permissions: ['reservations.read'] };
  it('counts a grouped purchase once and ignores its superseded predecessor across intake versions', async () => {
    const findMany = vi.fn().mockResolvedValue([
      intake,
      {
        ...intake,
        id: 'old',
        contractVersion: 1,
        servicePurchases: [
          { ...purchase, id: 'old-p', amount: new Prisma.Decimal(900) },
        ],
      },
    ]);
    const result = await readReservationReporting(
      db({ reservationIntake: { findMany } }),
      'purchase_by_supplier',
      reservationActor,
      query,
    );
    expect(result.rows[0]?.values).toMatchObject({
      recordCount: 1,
      registeredAmount: '20',
    });
    expect(findMany.mock.calls[0]?.[0].where.contractId).toEqual({
      in: ['contract'],
    });
  });
  it('refuses partially replaced grouped prices rather than fabricating allocation', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        ...intake,
        servicePurchases: [
          { ...purchase, id: 'new', coveredServiceClientKeys: ['a'] },
          purchase,
        ],
      },
    ]);
    await expect(
      readReservationReporting(
        db({ reservationIntake: { findMany } }),
        'purchase_by_supplier',
        reservationActor,
        query,
      ),
    ).rejects.toThrow('هم‌پوشانی');
  });
  it('does not report zero time for an unissued case and deduplicates a passenger across versions', async () => {
    const findMany = vi.fn().mockResolvedValue([intake]);
    expect(
      (
        await readReservationReporting(
          db({ reservationIntake: { findMany } }),
          'reservation_cycle_time',
          reservationActor,
          query,
        )
      ).rows,
    ).toHaveLength(0);
    const doc = {
      id: 'd',
      customerId: 'customer',
      issuedAt: new Date(at.getTime() + 60000),
    };
    findMany.mockResolvedValue([
      { ...intake, ticketDocuments: [doc] },
      {
        ...intake,
        id: 'old',
        contractVersion: 1,
        ticketDocuments: [{ ...doc, id: 'old-d' }],
      },
    ]);
    const result = await readReservationReporting(
      db({ reservationIntake: { findMany } }),
      'tickets_manifest',
      reservationActor,
      query,
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.values.recordCount).toBe(1);
  });
});
