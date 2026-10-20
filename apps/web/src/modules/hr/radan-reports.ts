import type { HrEmployeeDto, HrRecordDto } from '@nora/contracts';
import type { HrPreviewDataset } from './hr-preview-data';

export const radanReports = [
  ['general', 'گزارش کلی'],
  ['daily', 'گزارش روزانه'],
  ['late', 'گزارش تاخیر'],
  ['early', 'گزارش تعجیل'],
  ['absence', 'گزارش غیبت'],
  ['mission', 'گزارش ماموریت'],
  ['leave', 'گزارش مرخصی'],
  ['overtime', 'گزارش اضافه کار'],
  ['work', 'گزارش کارکرد'],
  ['total', 'گزارش مجموع'],
  ['people', 'گزارش افراد'],
  ['presence', 'گزارش وضعیت حضور'],
  ['incomplete', 'گزارش ترددهای ناقص'],
  ['incompleteDetail', 'گزارش ترددهای ناقص با جزئیات'],
  ['calculation', 'گزارش اجرای محاسبات'],
  ['remote', 'گزارش دورکاری'],
  ['dailyMinutes', 'گزارش کارکرد به تفکیک روز (دقیقه)'],
  ['totalMinutes', 'گزارش مجموع (دقیقه)'],
  ['present', 'گزارش حاضرین'],
  ['forgiveness', 'گزارش بخشودگی'],
  ['arpa', 'گزارش آرپا'],
] as const;
export type RadanReportId = (typeof radanReports)[number][0];
export const unavailableRadanReports = new Set<string>([
  'calculation',
  'forgiveness',
  'arpa',
]);
export interface RadanReportFilters {
  employeeId: string;
  groupId: string;
  contractType: string;
  sort: string;
  aggregate: boolean;
  unit: 'clock' | 'minutes' | 'days' | 'default';
}
export const emptyRadanFilters: RadanReportFilters = {
  employeeId: '',
  groupId: '',
  contractType: '',
  sort: 'code',
  aggregate: false,
  unit: 'clock',
};
export function buildRadanReport(
  id: string,
  records: readonly HrRecordDto[],
  employees: readonly HrEmployeeDto[],
  filters: RadanReportFilters,
  references: readonly HrRecordDto[] = records,
): HrPreviewDataset {
  const empty = (columns: readonly string[]): HrPreviewDataset => ({
    columns,
    rows: [],
    totalLabel: '۰ رکورد',
  });
  if (unavailableRadanReports.has(id)) return empty(['کارمند', 'نتیجه']);
  // Caller supplies only authorized records. Group membership uses canonical employee/parent FKs.
  const members = new Set(
    references
      .filter(
        (r) =>
          r.section === 'organization' &&
          r.tab === 'groupMembers' &&
          r.parentId === filters.groupId &&
          r.status === 'فعال' &&
          !r.deletedAt,
      )
      .map((r) => r.employeeId),
  );
  const contracts = new Set(
    references
      .filter(
        (r) =>
          r.section === 'contracts' &&
          r.tab === 'active' &&
          r.values[r.columns.indexOf('نوع قرارداد')] === filters.contractType &&
          !['لغوشده', 'ردشده', 'غیرفعال'].includes(r.status) &&
          !r.deletedAt,
      )
      .map((r) => r.employeeId),
  );
  const people = employees
    .filter(
      (e) =>
        (!filters.employeeId || e.id === filters.employeeId) &&
        (!filters.groupId || members.has(e.id)) &&
        (!filters.contractType || contracts.has(e.id)),
    )
    .sort((a, b) =>
      (filters.sort === 'name'
        ? a.name
        : filters.sort === 'lastName'
          ? a.name.split(' ').slice(1).join(' ')
          : a.personnelCode
      ).localeCompare(
        filters.sort === 'name'
          ? b.name
          : filters.sort === 'lastName'
            ? b.name.split(' ').slice(1).join(' ')
            : b.personnelCode,
        'fa',
        { numeric: true },
      ),
    );
  const ids = new Set(people.map((e) => e.id));
  const rank = new Map(people.map((e, i) => [e.id, i]));
  const source = records
    .filter((r) => r.employeeId && ids.has(r.employeeId) && !r.deletedAt)
    .sort(
      (a, b) =>
        (rank.get(a.employeeId!) ?? 0) - (rank.get(b.employeeId!) ?? 0) ||
        (a.effectiveAt ?? '').localeCompare(b.effectiveAt ?? '') ||
        a.id.localeCompare(b.id),
    );
  if (id === 'people')
    return {
      columns: [
        'کد پرسنلی',
        'نام و نام خانوادگی',
        'واحد',
        'سمت',
        'نوع همکاری',
        'وضعیت',
      ],
      rows: people.map((e) => [
        e.personnelCode,
        e.name,
        e.unit,
        e.position,
        e.kind,
        e.status,
      ]),
      recordIds: people.map((e) => e.id),
      totalLabel: String(people.length),
    };
  const metric = (
    r: HrRecordDto,
    key: 'workedMinutes' | 'lateMinutes' | 'earlyMinutes' | 'overtimeMinutes',
  ) => {
    const v = r.data[key];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
  };
  const lengths = references
    .filter(
      (r) =>
        r.tab === 'calculationSettings' &&
        r.status === 'فعال' &&
        people.some((e) => e.branchId === r.branchId),
    )
    .map((r) => (r.values[2] === 'خیر' ? Number(r.values[3]) : NaN));
  const dayMinutes =
    lengths.length ===
      new Set(people.map((employee) => employee.branchId)).size &&
    lengths.length > 0 &&
    lengths.every((n) => Number.isFinite(n) && n > 0 && n === lengths[0])
      ? lengths[0]!
      : null;
  const format = (n: number | null) =>
    n === null
      ? '—'
      : filters.unit === 'days'
        ? dayMinutes
          ? String(Number((n / dayMinutes).toFixed(4)))
          : '—'
        : filters.unit === 'minutes' || id.includes('Minutes')
          ? String(n)
          : Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');
  const attendance = source.filter(
    (r) => r.section === 'time' && r.tab === 'attendance',
  );
  const date = (r: HrRecordDto) =>
    r.values[r.columns.indexOf('تاریخ کارکرد')] ?? r.effectiveAt ?? '';
  if (['leave', 'mission', 'remote'].includes(id)) {
    const match = source.filter((r) =>
      id === 'leave'
        ? ['leave', 'radanLeave'].includes(r.tab) &&
          ['time', 'requests'].includes(r.section)
        : id === 'mission'
          ? ['mission', 'radanMission'].includes(r.tab) &&
            ['time', 'expenses', 'requests'].includes(r.section)
          : r.section === 'time' && r.tab === 'remote',
    );
    const read = (r: HrRecordDto, ...labels: string[]) =>
      labels.map((label) => r.values[r.columns.indexOf(label)]).find(Boolean) ??
      '—';
    if (filters.aggregate) {
      const peopleWithRecords = people.filter((e) =>
        match.some((r) => r.employeeId === e.id),
      );
      return {
        columns: ['کارمند', 'مدت'],
        rows: peopleWithRecords.map((e) => {
          const own = match.filter((r) => r.employeeId === e.id);
          return [
            e.name,
            format(
              own.some((r) => typeof r.data.minutes !== 'number')
                ? null
                : own.reduce((sum, r) => sum + r.data.minutes!, 0),
            ),
          ];
        }),
        recordIds: peopleWithRecords.map((e) => e.id),
        totalLabel: String(peopleWithRecords.length),
      };
    }
    return {
      columns: [
        'کارمند',
        'نوع درخواست',
        'از تاریخ',
        'تا تاریخ',
        'مدت',
        'وضعیت',
      ],
      rows: match.map((r) => [
        people.find((e) => e.id === r.employeeId)?.name ?? '—',
        r.data.requestSubtype ??
          read(r, 'نوع مرخصی', 'نوع مأموریت', 'نوع دورکاری', 'مقصد'),
        read(r, 'از تاریخ', 'تاریخ رفت'),
        read(r, 'تا تاریخ', 'تاریخ برگشت'),
        format(typeof r.data.minutes === 'number' ? r.data.minutes : null),
        r.status,
      ]),
      recordIds: match.map((r) => r.id),
      totalLabel: String(match.length),
    };
  }
  const selected = attendance.filter((r) =>
    id === 'late'
      ? (metric(r, 'lateMinutes') ?? 0) > 0
      : id === 'early'
        ? (metric(r, 'earlyMinutes') ?? 0) > 0
        : id === 'absence'
          ? r.status === 'غایب'
          : ['present', 'presence'].includes(id)
            ? id === 'presence' || r.status === 'حاضر'
            : id.startsWith('incomplete')
              ? Boolean(r.data.exceptionCodes?.length)
              : true,
  );
  if (id === 'overtime') {
    const overtime = source.filter(
      (r) => r.section === 'time' && r.tab === 'overtime',
    );
    if (filters.aggregate) {
      const grouped = people
        .filter((e) => overtime.some((r) => r.employeeId === e.id))
        .map((e) => {
          const own = overtime.filter((r) => r.employeeId === e.id);
          const total = own.some((r) => typeof r.data.minutes !== 'number')
            ? null
            : own.reduce((sum, r) => sum + r.data.minutes!, 0);
          return [e.name, format(total)];
        });
      return {
        columns: ['کارمند', 'مدت اضافه‌کاری'],
        recordIds: people
          .filter((e) => overtime.some((r) => r.employeeId === e.id))
          .map((e) => e.id),
        rows: grouped,
        totalLabel: String(grouped.length),
      };
    }
    return {
      columns: ['کارمند', 'تاریخ', 'مدت اضافه‌کاری', 'وضعیت'],
      rows: overtime.map((r) => [
        people.find((e) => e.id === r.employeeId)?.name ?? '—',
        r.effectiveAt ?? '',
        format(r.data.minutes ?? null),
        r.status,
      ]),
      recordIds: overtime.map((r) => r.id),
      totalLabel: String(overtime.length),
    };
  }
  const columns = [
    'کارمند',
    'تاریخ',
    'کارکرد',
    'تأخیر',
    'تعجیل',
    'اضافه‌کار',
    'وضعیت',
    ...(id === 'incompleteDetail' ? ['جزئیات نقص'] : []),
  ];
  if (filters.aggregate || ['total', 'totalMinutes'].includes(id)) {
    const rows = people
      .filter((e) => selected.some((r) => r.employeeId === e.id))
      .map((e) => {
        const own = selected.filter((r) => r.employeeId === e.id);
        const total = (
          key:
            | 'workedMinutes'
            | 'lateMinutes'
            | 'earlyMinutes'
            | 'overtimeMinutes',
        ) =>
          own.some((r) => metric(r, key) === null)
            ? null
            : own.reduce((n, r) => n + metric(r, key)!, 0);
        return [
          e.name,
          ...(
            [
              'workedMinutes',
              'lateMinutes',
              'earlyMinutes',
              'overtimeMinutes',
            ] as const
          ).map((k) => format(total(k))),
        ];
      });
    return {
      columns: ['کارمند', 'کارکرد', 'تأخیر', 'تعجیل', 'اضافه‌کار'],
      recordIds: people
        .filter((e) => selected.some((r) => r.employeeId === e.id))
        .map((e) => e.id),
      rows,
      totalLabel: String(rows.length),
    };
  }
  return {
    columns,
    rows: selected.map((r) => [
      people.find((e) => e.id === r.employeeId)?.name ?? '—',
      date(r),
      format(metric(r, 'workedMinutes')),
      format(metric(r, 'lateMinutes')),
      format(metric(r, 'earlyMinutes')),
      format(metric(r, 'overtimeMinutes')),
      r.status,
      ...(id === 'incompleteDetail'
        ? [r.data.exceptionCodes?.join('، ') ?? '']
        : []),
    ]),
    recordIds: selected.map((r) => r.id),
    totalLabel: String(selected.length),
  };
}
