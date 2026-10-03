import type {
  AttendanceRecord,
  CandidateInterview,
  Employee,
  EmployeeCheckin,
  EmployeeExpense,
  EmploymentAssignment,
  EmploymentContract,
  LeavePolicy,
  LeaveRequest,
  Money,
  PayrollRun,
  Period,
  ReviewCriterion,
  Shift,
  StaffingPlan,
  VehicleLog,
} from './hr.entities';

export class HrDomainError extends Error {
  constructor(
    readonly code:
      'INVALID' | 'FORBIDDEN' | 'CONFLICT' | 'DEPENDENCY_UNAVAILABLE',
  ) {
    super(code);
  }
}
export function requireInvariant(
  value: unknown,
  code: HrDomainError['code'] = 'INVALID',
): asserts value {
  if (!value) throw new HrDomainError(code);
}
export function utc(value: string): number {
  requireInvariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value));
  const time = Date.parse(value);
  requireInvariant(
    Number.isFinite(time) && new Date(time).toISOString() === value,
  );
  return time;
}
export function validatePeriod(period: Period): void {
  requireInvariant(utc(period.startsAt) < utc(period.endsAt));
}
export function validateMoney(money: Money): void {
  requireInvariant(/^(0|[1-9]\d{0,27})(\.\d{1,8})?$/.test(money.amount));
  requireInvariant(/^[A-Z]{3}$/.test(money.currencyCode));
}
function decimalUnits(value: string): bigint {
  requireInvariant(/^(0|[1-9]\d{0,27})(\.\d{1,8})?$/.test(value));
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, '0'));
}
function signedDecimalUnits(value: string): bigint {
  requireInvariant(/^-?(0|[1-9]\d{0,27})(\.\d{1,8})?$/.test(value));
  requireInvariant(value !== '-0');
  const negative = value.startsWith('-');
  const absolute = negative ? value.slice(1) : value;
  const units = decimalUnits(absolute);
  return negative ? -units : units;
}
export function validateStaffingPlan(plan: StaffingPlan): void {
  validatePeriod(plan);
  requireInvariant(
    Number.isSafeInteger(plan.plannedHeadcount) && plan.plannedHeadcount > 0,
  );
  requireInvariant(
    Boolean(plan.branchId.trim() && plan.organizationUnitId.trim()),
  );
  if (plan.approvedBudget) validateMoney(plan.approvedBudget);
}
export function validateCandidateInterview(
  interview: CandidateInterview,
): number {
  utc(interview.scheduledAt);
  requireInvariant(
    Number.isSafeInteger(interview.round) && interview.round > 0,
  );
  const panelUserIds = interview.panelUserIds.map((id) => id.trim());
  requireInvariant(
    panelUserIds.length > 0 &&
      new Set(panelUserIds).size === panelUserIds.length &&
      panelUserIds.every(Boolean),
  );
  return performanceScore(interview.scores);
}
export function validateEmployeeExpense(expense: EmployeeExpense): void {
  validateMoney(expense.money);
  if (expense.exchangeRate)
    requireInvariant(decimalUnits(expense.exchangeRate) > 0n);
  if (expense.settlementMoney) {
    validateMoney(expense.settlementMoney);
    if (expense.settlementMoney.currencyCode !== expense.money.currencyCode)
      requireInvariant(Boolean(expense.exchangeRate));
  }
  requireInvariant(Boolean(expense.approvalStage.trim()));
}
export function validateLeavePolicy(policy: LeavePolicy): void {
  validatePeriod(policy);
  requireInvariant(decimalUnits(policy.allocationUnits) > 0n);
  requireInvariant(
    Boolean(
      policy.branchId.trim() &&
      policy.leaveTypeId.trim() &&
      policy.holidayListId.trim(),
    ),
  );
}
export function validatePayrollRun(run: PayrollRun): void {
  validatePeriod(run);
  const employeeIds = run.employeeIds.map((id) => id.trim());
  requireInvariant(
    employeeIds.length > 0 &&
      new Set(employeeIds).size === employeeIds.length &&
      employeeIds.every(Boolean) &&
      Boolean(run.formulaVersion.trim()),
  );
  run.totals.forEach(validateMoney);
}
export function validateVehicleLog(log: VehicleLog): void {
  validatePeriod(log);
  requireInvariant(Boolean(log.vehicleId.trim() && log.employeeId.trim()));
  validateReason(log.purpose);
  const start = decimalUnits(log.startOdometer);
  requireInvariant(start >= 0n);
  if (log.endOdometer) requireInvariant(decimalUnits(log.endOdometer) >= start);
  if (log.expense) validateMoney(log.expense);
}
export function validateEmployee(employee: Employee): void {
  requireInvariant(
    employee.personnelCode.trim().length > 0 &&
      employee.personnelCode.length <= 50,
  );
  requireInvariant(
    employee.firstNameFa.trim().length > 0 &&
      employee.lastNameFa.trim().length > 0,
  );
  requireInvariant(['ACTIVE', 'SUSPENDED', 'ENDED'].includes(employee.status));
  utc(employee.startedAt);
  if (employee.endedAt)
    requireInvariant(utc(employee.endedAt) >= utc(employee.startedAt));
  requireInvariant(employee.status !== 'ENDED' || Boolean(employee.endedAt));
}
export function validateAssignment(
  next: EmploymentAssignment,
  existing: readonly EmploymentAssignment[],
): void {
  validatePeriod(next);
  requireInvariant(
    next.managerEmployeeId !== next.employeeId &&
      next.substituteEmployeeId !== next.employeeId,
  );
  // Conservative Phase A policy: concurrent primary assignments require an approved policy first.
  requireInvariant(
    !existing.some(
      (row) =>
        row.id !== next.id &&
        row.employeeId === next.employeeId &&
        utc(row.startsAt) < utc(next.endsAt) &&
        utc(next.startsAt) < utc(row.endsAt),
    ),
    'CONFLICT',
  );
}
export function assertAcyclic(
  id: string,
  parentId: string | undefined,
  parents: ReadonlyMap<string, string | undefined>,
): void {
  const visited = new Set([id]);
  let current = parentId;
  while (current) {
    requireInvariant(!visited.has(current), 'CONFLICT');
    visited.add(current);
    current = parents.get(current);
  }
}
export function assertCapacity(capacity: number, occupied: number): void {
  requireInvariant(
    Number.isSafeInteger(capacity) &&
      Number.isSafeInteger(occupied) &&
      occupied >= 0 &&
      capacity >= occupied,
  );
}
export function contractStatus(
  contract: EmploymentContract,
  now: string,
  warningDays: number,
): EmploymentContract['status'] {
  validatePeriod(contract);
  validateMoney(contract.agreed);
  requireInvariant(Number.isSafeInteger(warningDays) && warningDays >= 0);
  const time = utc(now);
  if (
    contract.status === 'DRAFT' ||
    contract.status === 'CANCELLED' ||
    contract.status === 'ENDED'
  )
    return contract.status;
  if (utc(contract.endsAt) <= time) return 'ENDED';
  return utc(contract.endsAt) - time <= warningDays * 86400000
    ? 'EXPIRING'
    : 'ACTIVE';
}
export function assertIssuer(context: {
  selection: 'ALL' | 'SPECIFIC';
  issuerLegalEntityId?: string;
}): asserts context is { selection: 'SPECIFIC'; issuerLegalEntityId: string } {
  requireInvariant(
    context.selection === 'SPECIFIC' &&
      Boolean(context.issuerLegalEntityId?.trim()) &&
      context.issuerLegalEntityId !== 'ALL',
    'FORBIDDEN',
  );
}
export function validateShift(shift: Shift): number {
  requireInvariant(
    [shift.startMinute, shift.endMinute, shift.breakMinutes].every(
      Number.isSafeInteger,
    ),
  );
  requireInvariant(
    shift.startMinute >= 0 &&
      shift.startMinute < 1440 &&
      shift.endMinute >= 0 &&
      shift.endMinute < 1440,
  );
  requireInvariant(
    shift.overnight
      ? shift.endMinute <= shift.startMinute
      : shift.endMinute > shift.startMinute,
  );
  const duration =
    shift.endMinute - shift.startMinute + (shift.overnight ? 1440 : 0);
  requireInvariant(shift.breakMinutes >= 0 && shift.breakMinutes < duration);
  try {
    new Intl.DateTimeFormat('en', { timeZone: shift.timezone }).format(0);
  } catch {
    throw new HrDomainError('INVALID');
  }
  return duration - shift.breakMinutes;
}
export function validateAttendance(record: AttendanceRecord): void {
  utc(record.checkedInAt);
  if (record.checkedOutAt)
    requireInvariant(utc(record.checkedOutAt) > utc(record.checkedInAt));
  requireInvariant(
    [
      record.workedMinutes,
      record.lateMinutes,
      record.earlyDepartureMinutes,
    ].every((value) => Number.isSafeInteger(value) && value >= 0) &&
      Boolean(record.calculationVersion.trim()),
  );
  requireInvariant(record.status === 'DRAFT' || Boolean(record.checkedOutAt));
}
export function validateEmployeeCheckin(checkin: EmployeeCheckin): void {
  utc(checkin.occurredAt);
  requireInvariant(
    Boolean(checkin.employeeId.trim() && checkin.makerUserId.trim()),
  );
  if (checkin.source === 'BIOMETRIC')
    requireInvariant(Boolean(checkin.deviceReferenceId?.trim()));
  if (checkin.source === 'IMPORT')
    requireInvariant(Boolean(checkin.importBatchId?.trim()));
  if (checkin.location) {
    const latitude = signedDecimalUnits(checkin.location.latitude);
    const longitude = signedDecimalUnits(checkin.location.longitude);
    requireInvariant(latitude >= -9000000000n && latitude <= 9000000000n);
    requireInvariant(longitude >= -18000000000n && longitude <= 18000000000n);
    if (checkin.location.accuracyMeters)
      requireInvariant(decimalUnits(checkin.location.accuracyMeters) > 0n);
  }
}
export function makerChecker(makerUserId: string, checkerUserId: string): void {
  requireInvariant(
    Boolean(makerUserId.trim()) &&
      Boolean(checkerUserId.trim()) &&
      makerUserId !== checkerUserId,
    'FORBIDDEN',
  );
}
export function validateReason(reason: string): void {
  requireInvariant(reason.trim().length >= 10 && reason.trim().length <= 500);
}
export function transitionLeave(
  request: LeaveRequest,
  next: LeaveRequest['status'],
  actor: { userId: string; employeeId?: string },
  reason: string,
): LeaveRequest {
  validatePeriod(request);
  validateReason(reason);
  const allowed: Record<
    LeaveRequest['status'],
    readonly LeaveRequest['status'][]
  > = {
    DRAFT: ['PENDING', 'CANCELLED'],
    PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED: [],
    REJECTED: [],
    CANCELLED: [],
  };
  requireInvariant(allowed[request.status].includes(next), 'CONFLICT');
  if (next === 'APPROVED' || next === 'REJECTED') {
    makerChecker(request.requesterUserId, actor.userId);
    requireInvariant(actor.employeeId !== request.employeeId, 'FORBIDDEN');
  } else
    requireInvariant(request.requesterUserId === actor.userId, 'FORBIDDEN');
  return { ...request, status: next, version: request.version + 1 };
}
export function performanceScore(criteria: readonly ReviewCriterion[]): number {
  requireInvariant(
    criteria.length > 0 &&
      new Set(criteria.map((item) => item.id)).size === criteria.length,
  );
  requireInvariant(
    criteria.every(
      (item) =>
        item.id.trim() &&
        Number.isSafeInteger(item.weight) &&
        item.weight > 0 &&
        item.weight <= 100 &&
        Number.isFinite(item.score) &&
        item.score >= 0 &&
        item.score <= 100,
    ),
  );
  requireInvariant(
    criteria.reduce((total, item) => total + item.weight, 0) === 100,
  );
  return (
    criteria.reduce((total, item) => total + item.weight * item.score, 0) / 100
  );
}
export function assertMutation(
  expectedVersion: number,
  currentVersion: number,
  idempotencyKey: string,
): void {
  requireInvariant(
    Number.isSafeInteger(expectedVersion) && expectedVersion >= 0,
  );
  requireInvariant(expectedVersion === currentVersion, 'CONFLICT');
  requireInvariant(/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey));
}
