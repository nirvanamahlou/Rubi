import { BadRequestException } from '@nestjs/common';
import type { WorkbenchLeaveInputV1 } from '@nora/contracts';
export function isHrRequestUnit(name?: string | null) {
  return ['منابع انسانی', 'سرمایه انسانی', 'اداری'].some((term) =>
    name?.includes(term),
  );
}
export function validateWorkbenchLeave(leave: WorkbenchLeaveInputV1) {
  if (leave.leaveType && !['استحقاقی', 'استعلاجی'].includes(leave.leaveType))
    throw new BadRequestException('نوع مرخصی معتبر نیست.');
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (
    !date.test(leave.from) ||
    !date.test(leave.to) ||
    !Number.isFinite(Date.parse(leave.from)) ||
    !Number.isFinite(Date.parse(leave.to)) ||
    new Date(leave.from).toISOString().slice(0, 10) !== leave.from ||
    new Date(leave.to).toISOString().slice(0, 10) !== leave.to ||
    leave.to < leave.from ||
    Date.parse(leave.to) - Date.parse(leave.from) > 30 * 86400000 ||
    !['روزانه', 'ساعتی'].includes(leave.mode) ||
    leave.reason.trim().length < 3
  )
    throw new BadRequestException(
      'بازه مرخصی (حداکثر ۳۱ روز) و دلیل را تکمیل کنید.',
    );
  if (
    leave.mode === 'ساعتی' &&
    (leave.from !== leave.to ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(leave.startTime ?? '') ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(leave.endTime ?? '') ||
      leave.endTime! <= leave.startTime!)
  )
    throw new BadRequestException('ساعت شروع و پایان مرخصی معتبر نیست.');
}

export function workbenchReviewStatus(row: {
  status: string;
  resolutionOutcome?: string | null;
}) {
  const outcome = row.resolutionOutcome?.replace(/^WORKBENCH_HR:/, '');
  return row.resolutionOutcome?.startsWith('WORKBENCH_HR:') &&
    outcome &&
    ['APPROVED', 'REJECTED', 'NEEDS_REVISION'].includes(outcome)
    ? outcome
    : row.status;
}
