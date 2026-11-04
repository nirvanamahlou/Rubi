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
export const unavailableRadanReports = new Set<string>(['forgiveness', 'arpa']);
export interface RadanReportFilters {
  employeeId: string;
  employeeIds?: readonly string[];
  groupIds?: readonly string[];
  contractTypes?: readonly string[];
  coefficients?: readonly string[];
  from?: string;
  to?: string;
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
const reportClockFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
/** Legacy clockings use the same Tehran wall-clock interpretation as HR's canonical UTC conversion. */
export function reportClockingTime(row: HrRecordDto): number {
  const stamp = row.data.startsAt ? Date.parse(row.data.startsAt) : NaN;
  if (Number.isFinite(stamp)) return stamp;
  const date = row.values[row.columns.indexOf('تاریخ تردد')] ?? '',
    clock = row.values[row.columns.indexOf('ساعت تردد')] ?? '';
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)
  )
    return NaN;
  const desired = Date.parse(`${date}T${clock}:00Z`);
  if (!Number.isFinite(desired)) return NaN;
  let guess = desired;
  const local = (at: number) => {
    const parts = reportClockFormatter.formatToParts(new Date(at));
    const read = (type: string) =>
      parts.find((part) => part.type === type)?.value;
    return `${read('year')}-${read('month')}-${read('day')}T${read('hour')}:${read('minute')}:00Z`;
  };
  for (let index = 0; index < 3; index++)
    guess += desired - Date.parse(local(guess));
  return local(guess) === `${date}T${clock}:00Z` ? guess : NaN;
}
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
  const groupIds =
    filters.groupIds ?? (filters.groupId ? [filters.groupId] : null);
  const employeeIds = filters.employeeIds?.length
    ? filters.employeeIds
    : filters.employeeId
      ? [filters.employeeId]
      : [];
  const contractTypes = filters.contractTypes?.length
    ? filters.contractTypes
    : filters.contractType
      ? [filters.contractType]
      : [];
  // Caller supplies only authorized records. Group membership uses canonical employee/parent FKs.
  const members = new Set(
    references
      .filter(
        (r) =>
          r.section === 'organization' &&
          r.tab === 'groupMembers' &&
          groupIds?.includes(r.parentId ?? '') &&
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
          contractTypes.includes(
            r.values[r.columns.indexOf('نوع قرارداد')] ?? '',
          ) &&
          !['لغوشده', 'ردشده', 'غیرفعال'].includes(r.status) &&
          !r.deletedAt &&
          (!filters.to ||
            !r.values[r.columns.indexOf('تاریخ شروع')] ||
            r.values[r.columns.indexOf('تاریخ شروع')]! <= filters.to) &&
          (!filters.from ||
            !r.values[r.columns.indexOf('تاریخ پایان')] ||
            r.values[r.columns.indexOf('تاریخ پایان')]! >= filters.from),
      )
      .map((r) => r.employeeId),
  );
  const people = employees
    .filter(
      (e) =>
        (!employeeIds.length || employeeIds.includes(e.id)) &&
        (groupIds === null || members.has(e.id)) &&
        (!contractTypes.length || contracts.has(e.id)),
    )
    .sort((a, b) =>
      (filters.sort === 'name'
        ? a.name
        : filters.sort === 'identification'
          ? a.id
          : filters.sort === 'lastName'
            ? a.name.split(' ').slice(1).join(' ')
            : a.personnelCode
      ).localeCompare(
        filters.sort === 'name'
          ? b.name
          : filters.sort === 'identification'
            ? b.id
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
        'عنوان شغلی',
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
  const requestMinutes = (row: HrRecordDto): number | null => {
    const read = (label: string) =>
      row.values[row.columns.indexOf(label)] ?? '';
    const start = (
        read('از تاریخ') ||
        read('تاریخ رفت') ||
        row.data.startsAt ||
        ''
      ).slice(0, 10),
      end = (
        read('تا تاریخ') ||
        read('تاریخ برگشت') ||
        row.data.endsAt ||
        ''
      ).slice(0, 10);
    if (
      (filters.from && start && start < filters.from) ||
      (filters.to && end && end > filters.to)
    )
      return null;
    return typeof row.data.minutes === 'number' &&
      Number.isFinite(row.data.minutes) &&
      row.data.minutes >= 0
      ? row.data.minutes
      : null;
  };
  const attendance = source.filter(
    (r) => r.section === 'time' && r.tab === 'attendance',
  );
  const date = (r: HrRecordDto) =>
    r.values[r.columns.indexOf('تاریخ کارکرد')] ?? r.effectiveAt ?? '';
  if (id === 'presence') {
    return {
      columns: ['کد پرسنلی', 'کارمند', 'وضعیت حضور', 'آخرین تردد', 'نوع تردد'],
      recordIds: people.map((person) => person.id),
      totalLabel: String(people.length),
      rows: people.map((person) => {
        const last = source
          .filter(
            (row) =>
              row.employeeId === person.id &&
              row.section === 'time' &&
              row.tab === 'checkins',
          )
          .sort(
            (a, b) =>
              reportClockingTime(b) - reportClockingTime(a) ||
              b.id.localeCompare(a.id),
          )[0];
        const kind = last?.values[last.columns.indexOf('نوع تردد')];
        return [
          person.personnelCode,
          person.name,
          kind === 'ورود' ? 'حاضر' : kind === 'خروج' ? 'خارج شده' : 'بدون تردد',
          last
            ? (last.data.startsAt ?? `${last.values[1]} ${last.values[2]}`)
            : '—',
          kind ?? '—',
        ];
      }),
    };
  }
  if (id === 'general') {
    const columns = filters.coefficients?.length
      ? [...filters.coefficients]
      : ['کارکرد', 'تاخیر', 'تعجیل', 'اضافه کار'];
    const approved = source.filter((row) =>
      ['تأییدشده', 'تاییدشده', 'فعال', 'آماده شروع'].includes(row.status),
    );
    const sum = (
      rows: readonly HrRecordDto[],
      read: (row: HrRecordDto) => number | null,
      missingIsZero = false,
    ) =>
      !rows.length
        ? missingIsZero
          ? 0
          : null
        : rows.some((row) => read(row) === null)
          ? null
          : rows.reduce((total, row) => total + read(row)!, 0);
    const selectedPeople = people.filter((person) =>
      source.some((row) => row.employeeId === person.id),
    );
    return {
      columns: ['کارمند', ...columns],
      recordIds: selectedPeople.map((person) => person.id),
      totalLabel: String(selectedPeople.length),
      rows: selectedPeople.map((person) => {
        const ownAttendance = attendance.filter(
          (row) => row.employeeId === person.id,
        );
        return [
          person.name,
          ...columns.map((column) => {
            const key = (
              {
                کارکرد: 'workedMinutes',
                تاخیر: 'lateMinutes',
                تأخیر: 'lateMinutes',
                تعجیل: 'earlyMinutes',
                'اضافه کار': 'overtimeMinutes',
              } as Record<
                string,
                | 'workedMinutes'
                | 'lateMinutes'
                | 'earlyMinutes'
                | 'overtimeMinutes'
              >
            )[column];
            if (key)
              return format(sum(ownAttendance, (row) => metric(row, key)));
            const calculated = (
              {
                'جمعه کاری': 'fridayMinutes',
                'اضافه کار / اضافه کار روز تعطیل': 'holidayOvertimeMinutes',
              } as Record<string, string>
            )[column];
            if (calculated)
              return format(
                sum(ownAttendance, (row) => {
                  const value = row.data.calculationMetrics?.[calculated];
                  return typeof value === 'number' &&
                    Number.isFinite(value) &&
                    value >= 0
                    ? value
                    : null;
                }),
              );
            const parts = column.split(' / '),
              component = parts[0];
            if (['مرخصی', 'ماموریت', 'دورکاری'].includes(component ?? '')) {
              let unknownClassification = false;
              const requests = approved
                .filter(
                  (row) =>
                    row.employeeId === person.id &&
                    (component === 'مرخصی'
                      ? ['leave', 'radanLeave'].includes(row.tab)
                      : component === 'ماموریت'
                        ? ['mission', 'radanMission'].includes(row.tab)
                        : row.tab === 'remote'),
                )
                .filter((row) => {
                  const read = (label: string) =>
                    row.values[row.columns.indexOf(label)] ?? '';
                  const mode =
                    read('نوع مدت') ||
                    read('نوع دورکاری') ||
                    (row.columns.includes('تعداد روز') ? 'روزانه' : '');
                  const kind = (read('نوع مرخصی') || read('نوع مأموریت'))
                    .replaceAll('‌', ' ')
                    .replaceAll(
                      String.fromCharCode(0x0623),
                      String.fromCharCode(0x0627),
                    );
                  if (parts[1] && !mode) {
                    unknownClassification = true;
                    return false;
                  }
                  if (parts[1] && mode !== parts[1]) return false;
                  if (parts[2] && !kind) {
                    unknownClassification = true;
                    return false;
                  }
                  return !parts[2] || kind === parts[2];
                });
              return unknownClassification
                ? '—'
                : format(sum(requests, requestMinutes, true));
            }
            return '—';
          }),
        ];
      }),
    };
  }
  if (id === 'calculation')
    return {
      columns: [
        'کارمند',
        'تاریخ کارکرد',
        'آخرین محاسبه',
        'مبنای محاسبات',
        'تنظیمات',
        'وضعیت',
      ],
      rows: attendance.map((row) => [
        people.find((person) => person.id === row.employeeId)?.name ?? '—',
        date(row),
        row.updatedAt,
        row.data.calculationBasis ?? '—',
        references.find(
          (config) => config.id === row.data.calculationSettingsId,
        )?.values[0] ?? '—',
        row.status,
      ]),
      recordIds: attendance.map((row) => row.id),
      totalLabel: String(attendance.length),
    };
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
              own.some((r) => requestMinutes(r) === null)
                ? null
                : own.reduce((sum, r) => sum + requestMinutes(r)!, 0),
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
              ? r.data.exceptionCodes?.some((code) =>
                  [
                    'ورود تکراری',
                    'خروج بدون ورود',
                    'خروج ثبت نشده',
                    'نوع تردد ناشناخته',
                  ].includes(code),
                ) === true
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
          const total = own.some((r) => requestMinutes(r) === null)
            ? null
            : own.reduce((sum, r) => sum + requestMinutes(r)!, 0);
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
        format(requestMinutes(r)),
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
