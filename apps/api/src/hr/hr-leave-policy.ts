import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  HR_DEFAULT_LEAVE_DAY_MINUTES,
  type WorkbenchLeaveInputV1,
} from '@nora/contracts';
import { digits, localClockParts } from './hr.validation';
import type { HrWorkflowData } from '@nora/contracts';
import { readLeaveRequestFields } from './hr-legacy-request-fields';

export function recordLeave(
  values: readonly string[],
  data: HrWorkflowData,
): WorkbenchLeaveInputV1 {
  return {
    ...readLeaveRequestFields(values),
    reason: data.reason ?? '',
    substituteUserId: data.substituteUserId ?? undefined,
    attachmentIds: data.leaveAttachmentIds,
  };
}

export function leavePolicyValues(values: readonly string[]): string[] {
  // Old annual policies remain legacy until explicitly saved in the new form.
  const fields =
    values.length === 6
      ? [
          values[1] ?? '',
          '',
          '',
          '1',
          '0',
          values[3] ?? 'خیر',
          values[4] ?? '0',
        ]
      : values.map((v, i) =>
          i === 4 && /^([01]\d|2[0-3]):[0-5]\d$/.test(digits(v)) ? '0' : v,
        );
  return fields.length === 7
    ? [...fields, String(HR_DEFAULT_LEAVE_DAY_MINUTES)]
    : fields;
}
export function parseMonthlyLeavePolicy(values: readonly string[]) {
  if (![7, 8, 9].includes(values.length)) return null;
  const v = values.map(digits);
  const dayMinutes = v[7]?.trim() || String(HR_DEFAULT_LEAVE_DAY_MINUTES);
  if (
    !/^\d{1,4}$/.test(dayMinutes) ||
    Number(dayMinutes) < 1 ||
    Number(dayMinutes) > 1440 ||
    !['استحقاقی', 'استعلاجی'].includes(v[0]!) ||
    !/^\d{1,2}(\.\d{1,2})?$/.test(v[1]!) ||
    Number(v[1]) > 31 ||
    !/^\d{1,3}(\.\d{1,2})?$/.test(v[2]!) ||
    Number(v[2]) > 744 ||
    !/^\d{1,3}$/.test(v[3]!) ||
    Number(v[3]) > 365 ||
    !(
      /^([01]\d|2[0-3]):[0-5]\d$/.test(v[4]!) ||
      (/^\d{1,3}$/.test(v[4]!) && Number(v[4]) <= 365)
    )
  )
    throw new BadRequestException(
      'نوع مرخصی، سهمیه ماهانه و مهلت ثبت را کامل و معتبر وارد کنید.',
    );
  const hourlyLimit = v[8]?.trim();
  if (
    hourlyLimit &&
    (!/^\d{1,4}$/.test(hourlyLimit) ||
      Number(hourlyLimit) < 1 ||
      Number(hourlyLimit) > 1440)
  )
    throw new BadRequestException(
      'حداکثر مدت مرخصی ساعتی باید بین ۱ و ۱۴۴۰ دقیقه باشد.',
    );
  return {
    hourlyLimitMinutes: hourlyLimit ? Number(hourlyLimit) : null,
    type: v[0]!,
    daily: Number(v[1]),
    dayMinutes: Number(dayMinutes),
    hourly: Number(v[2]),
    noticeDays: Number(v[3]),
    hourlyNoticeDays: v[4]!.includes(':') ? 0 : Number(v[4]),
    cutoff: v[4]!.includes(':') ? v[4]! : '14:00',
  };
}
export function assertLeaveDeadline(
  leave: WorkbenchLeaveInputV1,
  policy: NonNullable<ReturnType<typeof parseMonthlyLeavePolicy>>,
  now: Date,
) {
  const local = localClockParts(now);
  if (leave.mode === 'روزانه') {
    const days = (Date.parse(leave.from) - Date.parse(local.date)) / 86400000;
    if (days < policy.noticeDays)
      throw new BadRequestException(
        `درخواست مرخصی روزانه باید حداقل ${policy.noticeDays} روز قبل ثبت شود.`,
      );
  } else if (
    (Date.parse(leave.from) - Date.parse(local.date)) / 86400000 <
    policy.hourlyNoticeDays
  ) {
    throw new BadRequestException('مهلت ثبت مرخصی ساعتی گذشته است.');
  } else if (
    leave.from < local.date ||
    (leave.from === local.date &&
      now.getTime() > Date.parse(`${local.date}T${policy.cutoff}:00+03:30`))
  ) {
    throw new BadRequestException(
      `مهلت ثبت مرخصی ساعتی تا ساعت ${policy.cutoff} روز مرخصی است.`,
    );
  }
}
export function leaveMonth(date: string) {
  const parts = new Intl.DateTimeFormat('en-u-ca-persian', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'UTC',
  }).formatToParts(new Date(date));
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}`;
}
function hourlyDurationMinutes(leave: WorkbenchLeaveInputV1) {
  return (
    (Date.parse(`${leave.from}T${leave.endTime}:00Z`) -
      Date.parse(`${leave.from}T${leave.startTime}:00Z`)) /
    60000
  );
}

export function assertHourlyLeaveDuration(
  leave: WorkbenchLeaveInputV1,
  policy: NonNullable<ReturnType<typeof parseMonthlyLeavePolicy>>,
) {
  const limit = policy.hourlyLimitMinutes;
  if (
    leave.mode === 'ساعتی' &&
    limit != null &&
    hourlyDurationMinutes(leave) > limit
  )
    throw new BadRequestException(
      `مدت هر نوبت مرخصی ساعتی نباید بیشتر از ${limit} دقیقه باشد.`,
    );
}

export function leaveUsage(leave: WorkbenchLeaveInputV1) {
  const usage = new Map<string, number>();
  for (
    let at = Date.parse(leave.from);
    at <= Date.parse(leave.to);
    at += 86400000
  ) {
    const date = new Date(at).toISOString().slice(0, 10);
    const amount =
      leave.mode === 'روزانه' ? 1 : hourlyDurationMinutes(leave) / 60;
    const month = leaveMonth(date);
    usage.set(month, (usage.get(month) ?? 0) + amount);
  }
  return usage;
}
export function assertMonthlyLeaveQuota(
  leave: WorkbenchLeaveInputV1,
  policy: NonNullable<ReturnType<typeof parseMonthlyLeavePolicy>>,
  previous: WorkbenchLeaveInputV1[],
) {
  assertHourlyLeaveDuration(leave, policy);
  const totals = new Map<string, number>();
  for (const item of previous.filter((p) => p.mode === leave.mode))
    for (const [month, amount] of leaveUsage(item))
      totals.set(month, (totals.get(month) ?? 0) + amount);
  const limit = leave.mode === 'روزانه' ? policy.daily : policy.hourly;
  for (const [month, amount] of leaveUsage(leave))
    if ((totals.get(month) ?? 0) + amount > limit + 0.000001)
      throw new ConflictException('سهمیه ماهانه این نوع مرخصی کافی نیست.');
}

export const MONTHLY_HOURLY_LEAVE_LIMIT = 4;

export function hourlyLeaveCount(
  month: string,
  leaves: WorkbenchLeaveInputV1[],
) {
  return leaves.filter(
    (leave) => leave.mode === 'ساعتی' && leaveUsage(leave).has(month),
  ).length;
}

export function assertHourlyLeaveCount(
  leave: WorkbenchLeaveInputV1,
  previous: WorkbenchLeaveInputV1[],
) {
  if (leave.mode !== 'ساعتی') return;
  for (const month of leaveUsage(leave).keys()) {
    if (hourlyLeaveCount(month, previous) >= MONTHLY_HOURLY_LEAVE_LIMIT)
      throw new ConflictException(
        'حداکثر چهار نوبت مرخصی ساعتی در ماه مجاز است.',
      );
  }
}
