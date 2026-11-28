import { canViewRoute, getHrResource } from '@nora/contracts';
import { z } from 'zod';
import {
  normalizeCustomerListQuery,
  serializeCustomerListQuery,
} from '../customers/api/contracts';
import { serializeMasterDataListQuery } from '../master-data/api/contracts';
import type { AnswerPart } from './planned-answer';
import type { RecordRequest, RecordSubject } from './owner-record-intent';
import { formatInsuranceSummary } from './insurance-report';
import {
  callCenterRecords,
  reservationRequests,
} from './owner-operational-records';

export type OwnerRead = (
  path: string,
  body?: unknown,
  branchId?: string,
) => Promise<unknown>;
type Read = OwnerRead;
type Group = { id: string; name: string };
type Row = {
  id: string;
  label: string;
  branch?: string | null;
  company?: Group | null;
  contractId?: string | null | undefined;
};
type Records = { rows: Row[]; hasBranch: boolean; hasCompany: boolean };
const count = z.number().int().safe().nonnegative();
const id = z.string().min(1);
const fact = (n: number) => n.toLocaleString('fa-IR');
const hrefs: Record<RecordSubject, string> = {
  contracts: '/sales',
  registeredContracts: '/sales',
  confirmed: '/sales',
  personContracts: '/sales',
  agencyContracts: '/sales',
  salePassengers: '/sales',
  discountContracts: '/sales',
  tourPackages: '/sales/tours',
  cancelled: '/sales',
  unsettled: '/sales',
  settled: '/sales',
  positiveBalance: '/sales',
  hotelContracts: '/sales',
  visaContracts: '/sales',
  cancelledVisa: '/sales',
  customers: '/customers',
  newCustomers: '/customers',
  agencies: '/organizations',
  organizations: '/organizations',
  policies: '/reservations/insurance',
  reviewPolicies: '/reservations/insurance',
  insuranceSummary: '/reservations/insurance',
  callsWithoutOutcome: '/customer-affairs/call-center',
  callbacks: '/customer-affairs/call-center',
  reservationRequests: '/reservations',
  flightServices: '/ticket-purchases',
  hotelServices: '/ticket-purchases',
  users: '/system/users',
  roles: '/system/users',
  campaigns: '/marketing',
  employees: '/hr',
  formerEmployees: '/hr',
  archivedDocuments: '/documents',
  pendingScan: '/documents',
  hrLetters: '/correspondence',
  purchases: '/ticket-purchases',
  registeredPurchases: '/ticket-purchases',
  pendingPurchases: '/ticket-purchases',
  permits: '/finance/delivery',
  permitExceptions: '/finance/delivery',
  pendingReceipts: '/finance/requests',
  approvedReceipts: '/finance/requests',
  pettyExpenses: '/purchases',
  pettyFunds: '/purchases',
  postedJournals: '/finance/accounting/general-ledger/documents',
  draftJournals: '/finance/accounting/general-ledger/documents',
  dailyLeave: '/hr',
  hourlyLeave: '/hr',
  attendance: '/hr',
  advances: '/hr',
  hrPending: '/hr',
};

async function collect<T extends { id: string }>(
  load: (page: number) => Promise<{ data: T[]; page: number; total: number }>,
) {
  const rows = new Map<string, T>();
  let total: number | undefined;
  for (let page = 1; page <= 250; page++) {
    const result = await load(page);
    if (result.page !== page || (total !== undefined && total !== result.total))
      throw new Error('REPORT_LIST_CHANGED');
    total = result.total;
    for (const row of result.data) {
      if (rows.has(row.id)) throw new Error('REPORT_LIST_CHANGED');
      rows.set(row.id, row);
    }
    if (rows.size === total) return [...rows.values()];
    if (rows.size > total || !result.data.length)
      throw new Error('REPORT_INCOMPLETE_PAGE');
  }
  throw new Error('REPORT_PAGE_LIMIT');
}

function pages<T extends z.ZodType<{ id: string }>>(
  read: Read,
  url: (page: number) => string,
  row: T,
) {
  const result = z.object({
    data: z.array(row),
    meta: z.object({ page: count, total: count }),
  });
  return collect<z.output<T>>(async (page) => {
    const value = result.parse(await read(url(page)));
    return { data: value.data, ...value.meta };
  });
}
const sale = z.object({
  id,
  contractNumber: id,
  branchId: id,
  settlementStatus: id,
  passengerRows: z.array(z.object({ id, displayName: z.string() })).optional(),
  hasDiscount: z.boolean().optional(),
  confirmedAt: z.string().datetime().nullable().optional(),
  issuerCompany: z.object({ id, persianName: id }).nullable().optional(),
  balances: z.array(
    z.object({ outstanding: z.string().regex(/^-?\d+(?:\.\d+)?$/) }),
  ),
});
async function sales(subject: RecordSubject, read: Read): Promise<Records> {
  const filter = new URLSearchParams({
    sortBy: 'contractNumber',
    sortDirection: 'asc',
    pageSize: '50',
  });
  if (subject === 'registeredContracts') filter.set('recordSet', 'REGISTERED');
  if (subject === 'salePassengers')
    filter.set('reportProjection', 'PASSENGER_ROWS');
  if (subject === 'discountContracts')
    filter.set('reportProjection', 'DISCOUNT');
  if (subject === 'personContracts') filter.set('customerType', 'IN_PERSON');
  if (subject === 'agencyContracts') filter.set('customerType', 'AGENCY');
  if (subject === 'cancelled' || subject === 'cancelledVisa')
    filter.set('status', 'CANCELLED');
  if (subject === 'settled') filter.set('settlementStatus', 'SETTLED');
  if (subject === 'hotelContracts') filter.set('serviceKind', 'HOTEL');
  if (subject === 'visaContracts' || subject === 'cancelledVisa')
    filter.set('serviceKind', 'VISA');
  const all = await pages(
    read,
    (page) => '/sales/contracts?' + filter + '&page=' + page,
    sale,
  );
  if (subject === 'confirmed' && all.some((r) => r.confirmedAt === undefined))
    throw new Error('MISSING_CONFIRMATION_FIELD');
  if (
    subject === 'discountContracts' &&
    all.some((r) => r.hasDiscount === undefined)
  )
    throw new Error('MISSING_DISCOUNT_FIELD');
  const matched = all.filter((r) => {
    if (subject === 'unsettled')
      return ['UNPAID', 'PARTIALLY_SETTLED'].includes(r.settlementStatus);
    if (subject === 'confirmed') return Boolean(r.confirmedAt);
    if (subject === 'discountContracts') return r.hasDiscount === true;
    if (subject === 'positiveBalance')
      return r.balances.some(
        (b) => !b.outstanding.startsWith('-') && /[1-9]/.test(b.outstanding),
      );
    return true;
  });
  return {
    hasBranch: true,
    hasCompany: all.every((r) => r.issuerCompany !== undefined),
    rows: matched.flatMap((r) => {
      const company = r.issuerCompany
        ? { id: r.issuerCompany.id, name: r.issuerCompany.persianName }
        : null;
      if (subject === 'salePassengers') {
        if (!r.passengerRows) throw new Error('MISSING_PASSENGER_ROWS');
        return r.passengerRows.map((p) => ({
          id: p.id,
          label: r.contractNumber + ' — ' + p.displayName,
          branch: r.branchId,
          company,
        }));
      }
      return [
        { id: r.id, label: r.contractNumber, branch: r.branchId, company },
      ];
    }),
  };
}

async function hrRequests(
  subject: RecordSubject,
  read: Read,
): Promise<Records> {
  const row = z.object({
    id,
    code: id,
    branchId: id,
    section: id,
    tab: id,
    status: id,
    values: z.array(z.string()),
    data: z.object({ requestSubtype: z.string().optional() }),
  });
  const schema = z.object({ page: count, total: count, items: z.array(row) });
  const work = z.object({
    data: z.array(
      z.object({
        id,
        trackingNumber: id,
        branchId: id,
        subject: id,
        status: id,
        description: z.string(),
        leave: z.object({ mode: z.enum(['روزانه', 'ساعتی']) }).nullable(),
      }),
    ),
  });
  const [native, workbench] = await Promise.all([
    collect(async (p) => {
      const r = schema.parse(
        await read('/hr/records?approvalOnly=true&pageSize=100&page=' + p),
      );
      return { data: r.items, page: r.page, total: r.total };
    }),
    read('/customer-affairs/workbench/hr-requests').then(
      (v) => work.parse(v).data,
    ),
  ]);
  if (workbench.length >= 200) throw new Error('HR_WORKBENCH_LIMIT');
  const rows: Row[] = [];
  for (const r of native) {
    if (r.code.startsWith('WB-') || !getHrResource(r.section, r.tab)?.approval)
      continue;
    const key = r.section + '.' + r.tab;
    const subtype = r.data.requestSubtype ?? '';
    const leave =
      ['time.leave', 'requests.leave', 'requests.radanLeave'].includes(key) ||
      subtype.startsWith('مرخصی');
    const hourly = subtype.includes('ساعتی') || r.values[4] === 'ساعتی';
    const match =
      subject === 'hrPending'
        ? r.status === 'در انتظار تأیید'
        : subject === 'advances'
          ? key === 'expenses.advances' || subtype === 'مساعده'
          : subject === 'attendance'
            ? ['time.corrections', 'requests.attendance'].includes(key) ||
              subtype === 'اصلاح تردد'
            : leave && (subject === 'hourlyLeave') === hourly;
    if (match) rows.push({ id: r.id, label: r.code, branch: r.branchId });
  }
  for (const r of workbench) {
    const match =
      subject === 'hrPending'
        ? r.status === 'NEW'
        : subject === 'attendance'
          ? r.description.startsWith('اصلاح تردد\n')
          : subject === 'dailyLeave'
            ? r.leave?.mode === 'روزانه'
            : subject === 'hourlyLeave' && r.leave?.mode === 'ساعتی';
    if (match)
      rows.push({
        id: r.id,
        label: r.trackingNumber + ' — ' + r.subject,
        branch: r.branchId,
      });
  }
  return { hasBranch: true, hasCompany: false, rows };
}

async function loadRecords(
  subject: RecordSubject,
  read: Read,
  branches: readonly string[],
): Promise<Records> {
  const route = hrefs[subject];
  if (route === '/sales') return sales(subject, read);
  if (subject === 'callsWithoutOutcome' || subject === 'callbacks')
    return callCenterRecords(subject, read, branches);
  if (subject === 'reservationRequests') return reservationRequests(read);
  if (subject === 'postedJournals' || subject === 'draftJournals') {
    const status = subject === 'postedJournals' ? 'POSTED' : 'DRAFT';
    const records = await pages(
      read,
      (page) =>
        '/finance/accounting/journal-register?status=' +
        status +
        '&page=' +
        page,
      z.object({
        id,
        number: count.nullable(),
        branchId: id,
        company: z.object({ id, name: id }).nullable(),
      }),
    );
    return {
      hasBranch: true,
      hasCompany: true,
      rows: records.map((r) => ({
        id: r.id,
        label: r.number === null ? r.id : String(r.number),
        branch: r.branchId,
        company: r.company,
      })),
    };
  }
  if (subject === 'tourPackages') {
    const { data } = z
      .object({ data: z.array(z.object({ id, branchId: id, name: id })) })
      .parse(await read('/ticket-catalog/tours/packages'));
    if (data.length >= 200) throw new Error('TOUR_PACKAGE_LIST_LIMIT');
    return {
      hasBranch: true,
      hasCompany: false,
      rows: data.map((r) => ({ id: r.id, label: r.name, branch: r.branchId })),
    };
  }
  if (route === '/customers') {
    const all = await pages(
      read,
      (page) =>
        '/customers?' +
        serializeCustomerListQuery(
          normalizeCustomerListQuery({
            kind: 'person',
            role: 'customer',
            page,
            pageSize: 50,
          }),
        ),
      z.object({
        id,
        displayName: id,
        kind: z.literal('person'),
        roles: z.array(z.string()),
        ownerBranchId: id,
        createdAt: z.string().datetime(),
      }),
    );
    const cutoff = new Date();
    cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
    if (all.some((r) => !r.roles.includes('customer')))
      throw new Error('CUSTOMER_ROLE_MISMATCH');
    return {
      hasCompany: false,
      hasBranch: true,
      rows: all
        .filter(
          (r) => subject !== 'newCustomers' || new Date(r.createdAt) >= cutoff,
        )
        .map((r) => ({
          id: r.id,
          label: r.displayName,
          branch: r.ownerBranchId,
        })),
    };
  }
  if (route === '/organizations') {
    const all = await pages(
      read,
      (page) =>
        '/master-data/organizations?' +
        serializeMasterDataListQuery({
          search: '',
          organizationRole:
            subject === 'agencies' ? 'AGENCY' : 'CORPORATE_CUSTOMER',
          status: 'all',
          sortBy: 'updatedAt',
          sortDirection: 'desc',
          page,
          pageSize: 50,
        }),
      z.object({ id, name: id, code: z.string() }),
    );
    return {
      hasBranch: false,
      hasCompany: false,
      rows: all.map((r) => ({ id: r.id, label: r.name + ' — ' + r.code })),
    };
  }
  if (route === '/reservations/insurance') {
    const schema = z.object({
      count,
      page: count,
      data: z.array(
        z.object({
          id,
          policyNumber: z.string().nullable(),
          contractId: id.nullable().optional(),
          branchId: id,
          status: id,
          contractNumber: z.string(),
        }),
      ),
    });
    const all = await collect(async (page) => {
      const r = schema.parse(
        await read('/reservations/insurance/policies?page=' + page),
      );
      return { page: r.page, total: r.count, data: r.data };
    });
    return {
      hasBranch: true,
      hasCompany: false,
      rows: all
        .filter(
          (r) =>
            subject === 'policies' ||
            ['INPUT_ERROR', 'PROVIDER_ERROR'].includes(r.status),
        )
        .map((r) => ({
          id: r.id,
          label: r.policyNumber ?? (r.contractNumber || r.id),
          branch: r.branchId,
          contractId: r.contractId,
        })),
    };
  }
  if (subject === 'employees' || subject === 'formerEmployees') {
    const all = await pages(
      read,
      (page) => '/hr/employee-roster?page=' + page,
      z.object({
        id,
        name: id,
        status: id,
        branchId: id,
        companyId: id,
        companyName: id,
      }),
    );
    return {
      hasBranch: true,
      hasCompany: true,
      rows: all
        .filter(
          (r) => r.status === (subject === 'employees' ? 'فعال' : 'غیرفعال'),
        )
        .map((r) => ({
          id: r.id,
          label: r.name,
          branch: r.branchId,
          company: { id: r.companyId, name: r.companyName },
        })),
    };
  }
  if (route === '/documents' || subject === 'hrLetters') {
    const filter =
      subject === 'hrLetters'
        ? 'incoming?isIncomingLetter=true&archiveStatus=ACTIVE&domain=HUMAN_RESOURCES'
        : subject === 'pendingScan'
          ? '?isIncomingLetter=false&scanStatus=PENDING_SCAN'
          : '?isIncomingLetter=false&archiveStatus=ARCHIVED';
    const url = '/documents' + (subject === 'hrLetters' ? '/' : '') + filter;
    const all = await pages(
      read,
      (p) => url + '&pageSize=25&page=' + p,
      z.object({ id, archiveCode: id, branchId: id }),
    );
    return {
      hasBranch: true,
      hasCompany: false,
      rows: all.map((r) => ({
        id: r.id,
        label: r.archiveCode,
        branch: r.branchId,
      })),
    };
  }
  if (route === '/ticket-purchases') {
    const kind =
      subject === 'flightServices'
        ? 'FLIGHT'
        : subject === 'hotelServices'
          ? 'HOTEL'
          : 'ALL';
    const status =
      subject === 'registeredPurchases'
        ? 'REGISTERED'
        : subject === 'pendingPurchases'
          ? 'UNREGISTERED'
          : 'ALL';
    const schema = z.object({
      data: z.array(
        z.object({
          id,
          branchId: id,
          contractId: id.optional(),
          snapshot: z.object({ contractNumber: id }),
        }),
      ),
      meta: z.object({
        page: count,
        services: z.array(z.object({ id, clientKey: id })),
        summary: z.object({
          total: count,
          registered: count,
          unregistered: count,
        }),
      }),
    });
    const rows = await collect(async (p) => {
      const { data, meta } = schema.parse(
        await read(
          '/reservations/requests/purchases?kind=' +
            kind +
            '&status=' +
            status +
            '&page=' +
            p,
        ),
      );
      const items = new Map(data.map((r) => [r.id, r]));
      const services = meta.services.map((s) => {
        const r = items.get(s.id);
        if (!r) throw new Error('PURCHASE_MISSING_INTAKE');
        return {
          id: s.id + ':' + s.clientKey,
          label: r.snapshot.contractNumber + ' — ' + s.clientKey,
          branch: r.branchId,
          contractId: r.contractId,
        };
      });
      const total =
        status === 'REGISTERED'
          ? meta.summary.registered
          : status === 'UNREGISTERED'
            ? meta.summary.unregistered
            : meta.summary.total;
      return { data: services, total, page: meta.page };
    });
    return { rows, hasBranch: true, hasCompany: false };
  }
  if (route === '/finance/delivery') {
    const { data } = z
      .object({
        data: z.array(
          z.object({
            contractId: id,
            contractNumber: id,
            branchId: id,
            delivery: z.object({
              approved: z.boolean(),
              basis: z.string().nullable(),
              exceptionExpiresAt: z.string().nullable(),
            }),
          }),
        ),
      })
      .parse(await read('/finance/customer-document-delivery'));
    if (data.length >= 100) throw new Error('FINANCE_QUEUE_LIMIT');
    const now = Date.now();
    const rows = data.filter(
      (r) =>
        r.delivery.approved &&
        (r.delivery.basis !== 'MANAGER_EXCEPTION' ||
          (r.delivery.exceptionExpiresAt !== null &&
            Date.parse(r.delivery.exceptionExpiresAt) > now)) &&
        (subject !== 'permitExceptions' ||
          r.delivery.basis === 'MANAGER_EXCEPTION'),
    );
    return {
      hasBranch: true,
      hasCompany: false,
      rows: rows.map((r) => ({
        id: r.contractId,
        contractId: r.contractId,
        label: r.contractNumber,
        branch: r.branchId,
      })),
    };
  }
  if (route === '/finance/requests') {
    const group = subject === 'approvedReceipts' ? 'APPROVED' : 'PENDING';
    const schema = z.object({
      page: count,
      total: count,
      sources: z.array(z.object({ source: id, connection: id })),
      items: z.array(
        z.object({
          id,
          sourceReference: id,
          sourceContextReference: id,
          title: id,
          branchReference: id,
        }),
      ),
    });
    const all = await collect(async (p) => {
      const status = group === 'APPROVED' ? 'RECEIPT_CONFIRMED' : 'NEW';
      const r = schema.parse(
        await read(
          '/finance/inbox/page?source=SALES&category=RECEIPT&approvalGroup=' +
            group +
            '&status=' +
            status +
            '&pageSize=25&page=' +
            p,
        ),
      );
      if (
        !r.sources.some(
          (s) => s.source === 'SALES' && s.connection === 'CONNECTED',
        )
      )
        throw new Error('FINANCE_SOURCE_UNAVAILABLE');
      return { data: r.items, page: r.page, total: r.total };
    });
    return {
      hasCompany: false,
      hasBranch: true,
      rows: all.map((r) => ({
        id: r.sourceReference,
        contractId: r.sourceContextReference,
        label: r.title,
        branch: r.branchReference,
      })),
    };
  }
  if (subject === 'pettyExpenses') {
    const schema = z.object({
      page: count,
      hasMore: z.boolean(),
      items: z.array(z.object({ id, title: id, branchId: id })),
    });
    const seen = new Map<string, Row>();
    for (let page = 1; page <= 250; page++) {
      const result = schema.parse(
        await read('/procurement/petty-registrations?page=' + page),
      );
      if (result.page !== page || (result.hasMore && !result.items.length))
        throw new Error('PETTY_LIST_CHANGED');
      for (const r of result.items) {
        if (seen.has(r.id)) throw new Error('PETTY_LIST_CHANGED');
        seen.set(r.id, { id: r.id, label: r.title, branch: r.branchId });
      }
      if (!result.hasMore)
        return { hasBranch: true, hasCompany: false, rows: [...seen.values()] };
    }
    throw new Error('PETTY_PAGE_LIMIT');
  }
  if (subject === 'pettyFunds') {
    const rows: Row[] = [];
    for (const branch of branches) {
      const fund = z
        .object({ id, currencyCode: id })
        .nullable()
        .parse(
          await read(
            '/procurement/petty-fund?branchId=' + encodeURIComponent(branch),
          ),
        );
      if (fund)
        rows.push({
          id: fund.id,
          label: 'تنخواه ' + fund.currencyCode,
          branch,
        });
    }
    return { rows, hasCompany: false, hasBranch: true };
  }
  if (route === '/hr') return hrRequests(subject, read);
  if (subject === 'users') {
    const users = z
      .array(z.object({ id, displayName: id, status: id }))
      .parse(await read('/iam/users'));
    return {
      hasBranch: false,
      hasCompany: false,
      rows: users
        .filter((u) => u.status === 'ACTIVE')
        .map((u) => ({ id: u.id, label: u.displayName })),
    };
  }
  if (subject === 'roles') {
    const { roles } = z
      .object({ roles: z.array(z.object({ id, name: id })) })
      .parse(await read('/iam/access-options'));
    return {
      hasBranch: false,
      hasCompany: false,
      rows: roles.map((r) => ({ id: r.id, label: r.name })),
    };
  }
  const schema = z.object({
    page: count,
    total: count,
    data: z.array(
      z.object({ id, name: id, branchId: id, executionCompany: z.string() }),
    ),
  });
  const all = await collect(async (page) =>
    schema.parse(
      await read('/marketing/campaigns/page?pageSize=20&page=' + page),
    ),
  );
  return {
    hasBranch: true,
    hasCompany: true,
    rows: all.map((r) => ({
      id: r.id,
      label: r.name,
      branch: r.branchId,
      company: r.executionCompany
        ? { id: r.executionCompany, name: r.executionCompany }
        : null,
    })),
  };
}

export async function runOwnerRecordReport(
  question: string,
  request: RecordRequest,
  actor: { permissions: readonly string[]; branchIds: readonly string[] },
  company: { selection: string } | null,
  read: Read,
): Promise<AnswerPart> {
  const { subject, shape, title } = request;
  const href = hrefs[subject];
  const issue = (status: AnswerPart['status'], text: string): AnswerPart => ({
    question,
    status,
    text,
    links: [],
  });
  if (
    !canViewRoute(actor.permissions, href) ||
    ((subject === 'positiveBalance' || subject === 'discountContracts') &&
      !actor.permissions.includes('sales.payments.read'))
  )
    return issue('denied', 'مجوز مشاهدهٔ این گزارش در حساب فعلی وجود ندارد.');
  if (company?.selection !== 'ALL')
    return issue(
      'unavailable',
      'این گزارش در نمای «همه شرکت‌ها» و در دامنهٔ مجاز حساب قابل مشاهده است.',
    );
  if (!actor.permissions.includes('legal-entity.aggregate.read'))
    return issue(
      'denied',
      'مجوز گزارش تجمیعی شرکت‌ها برای این حساب وجود ندارد.',
    );
  if (subject === 'insuranceSummary')
    return {
      question,
      status: 'answer',
      text: formatInsuranceSummary(
        await read('/reservations/insurance/policies?page=1'),
      ),
      links: [{ href, label: 'مشاهدهٔ بیمه‌نامه‌ها' }],
      source: 'reservations/insurance/policies',
      observedAt: new Date().toISOString(),
    };
  const data = await loadRecords(subject, read, actor.branchIds);
  const rows = data.rows;
  if (
    shape === 'company' &&
    !data.hasCompany &&
    rows.length &&
    rows.every((r) => r.contractId !== undefined) &&
    canViewRoute(actor.permissions, '/sales')
  ) {
    const contracts = await sales('registeredContracts', read);
    const issuers = new Map(contracts.rows.map((r) => [r.id, r.company]));
    if (
      contracts.hasCompany &&
      rows.every((r) => r.contractId === null || issuers.has(r.contractId!))
    ) {
      for (const row of rows)
        row.company = row.contractId
          ? (issuers.get(row.contractId) ?? null)
          : null;
      data.hasCompany = true;
    }
  }
  // A scope drift or an unsupported dimension must never become a plausible zero.
  if (
    data.hasBranch &&
    rows.some((r) => r.branch && !actor.branchIds.includes(r.branch))
  )
    return issue('denied', 'دامنهٔ شعب پاسخ با دسترسی حساب تطبیق ندارد.');
  const total = 'تعداد ' + title + ' در محدودهٔ مجاز: ' + fact(rows.length);
  const lines = [total];
  if (subject === 'postedJournals' || subject === 'draftJournals')
    lines.push('بازه: همهٔ دوره‌های مالی دفاتر مجاز.');
  let status: AnswerPart['status'] = rows.length ? 'answer' : 'empty';
  if (shape === 'list') {
    lines.push(
      ...rows
        .slice()
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .slice(0, 10)
        .map((r) => (r.label === r.id ? r.id : r.id + ' — ' + r.label)),
    );
    if (rows.length > 10)
      lines.push('۱۰ مورد اول به ترتیب شناسه نمایش داده شد.');
  }
  if (shape === 'branch' || shape === 'company') {
    const branch = shape === 'branch';
    if (rows.length && !(branch ? data.hasBranch : data.hasCompany)) {
      lines.push(
        branch
          ? 'منبع این پنل شعبهٔ هر رکورد را مشخص نمی‌کند؛ تفکیک شعبه و شمارش موارد بدون شعبه در دسترس نیست.'
          : 'منبع این پنل شرکت هر رکورد را مشخص نمی‌کند؛ رتبه‌بندی شرکت‌ها در دسترس نیست.',
      );
      status = 'partial';
    } else {
      const groups = new Map<string, { name: string; count: number }>();
      if (branch && actor.permissions.includes('iam.users.read')) {
        const { branches } = z
          .object({ branches: z.array(z.object({ id, name: id })) })
          .parse(await read('/iam/users/access-options'));
        for (const b of branches)
          if (actor.branchIds.includes(b.id))
            groups.set(b.id, { name: b.name, count: 0 });
      }
      if (
        !branch &&
        (href === '/sales' ||
          rows.every((r) => r.contractId !== undefined) ||
          !rows.length)
      ) {
        const options = z
          .object({ data: z.array(z.object({ id, persianName: id })) })
          .parse(await read('/legal-entities/selectable'));
        for (const c of options.data)
          groups.set(c.id, { name: c.persianName, count: 0 });
      }
      let missing = 0;
      for (const row of rows) {
        const group = branch
          ? row.branch
            ? { id: row.branch, name: row.branch }
            : null
          : row.company;
        if (!group) {
          missing++;
          continue;
        }
        const entry = groups.get(group.id) ?? { name: group.name, count: 0 };
        entry.count++;
        groups.set(group.id, entry);
      }
      for (const g of [...groups.values()].sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fa'),
      ))
        lines.push(g.name + ' — ' + fact(g.count));
      lines.push((branch ? 'بدون شعبه' : 'بدون شرکت') + ' — ' + fact(missing));
    }
  }
  return {
    question,
    status,
    text: lines.join('\n'),
    observedAt: new Date().toISOString(),
    source: href.slice(1),
    links: [{ href, label: 'مشاهده در پنل' }],
  };
}
