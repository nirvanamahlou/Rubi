import { describe, expect, it, vi } from 'vitest';
import {
  assertAcyclic,
  assertCapacity,
  assertIssuer,
  assertMutation,
  contractStatus,
  makerChecker,
  performanceScore,
  transitionLeave,
  utc,
  validateAssignment,
  validateAttendance,
  validateEmployee,
  validateMoney,
  validatePeriod,
  validateReason,
  validateShift,
} from './hr.domain';
import {
  canAccess,
  employeeSummary,
  hrPermissions,
  revealSensitive,
  type HrActor,
} from './hr.policy';
import {
  mayDisposeDocument,
  openPersonnelDocument,
  proposedHttpContract,
} from './hr.ports';
import type {
  Employee,
  EmploymentAssignment,
  EmploymentContract,
  LeaveRequest,
  PersonnelDocument,
  Shift,
} from './hr.entities';

const now = '2026-09-05T00:00:00.000Z';
const entity = {
  id: 'synthetic-record',
  version: 1,
  createdAt: now,
  updatedAt: now,
};
const period = {
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: '2026-10-01T00:00:00.000Z',
};
const target = {
  employeeId: 'synthetic-employee',
  branchId: 'synthetic-branch',
};
const actor: HrActor = {
  userId: 'synthetic-checker',
  employeeId: 'synthetic-manager',
  permissions: hrPermissions,
  branchIds: ['synthetic-branch', 'synthetic-other-branch'],
  activeBranchId: 'synthetic-branch',
  scope: 'HR',
  managedEmployeeIds: [target.employeeId],
};
const employee: Employee = {
  ...entity,
  id: target.employeeId,
  personnelCode: 'SYNTHETIC',
  firstNameFa: 'نمایشی',
  lastNameFa: 'آزمون',
  status: 'ACTIVE',
  startedAt: now,
  skills: [],
  employmentHistory: [],
};
const contract: EmploymentContract = {
  ...entity,
  ...period,
  employeeId: target.employeeId,
  number: 'SYNTHETIC',
  issuerLegalEntityId: 'synthetic-issuer',
  kind: 'FIXED_TERM',
  jobTitle: 'synthetic',
  workplace: 'synthetic',
  agreed: { amount: '100.00', currencyCode: 'IRR' },
  benefits: [],
  status: 'ACTIVE',
  makerUserId: 'synthetic-maker',
};
const leave: LeaveRequest = {
  ...entity,
  ...period,
  employeeId: target.employeeId,
  requesterUserId: 'synthetic-maker',
  kind: 'DAILY',
  status: 'PENDING',
};
const shift: Shift = {
  ...entity,
  name: 'synthetic',
  startMinute: 480,
  endMinute: 960,
  overnight: false,
  breakMinutes: 30,
  timezone: 'Asia/Tehran',
};

describe('HR domain foundation', () => {
  it.each([
    '2026-02-30T00:00:00.000Z',
    '2026-09-05',
    '2026-09-05T00:00:00+03:30',
    'invalid',
  ])('rejects noncanonical UTC %s', (value) =>
    expect(() => utc(value)).toThrow('INVALID'),
  );
  it('validates intervals and decimal money without numeric conversion', () => {
    expect(utc(now)).toBe(Date.parse(now));
    expect(() => validatePeriod(period)).not.toThrow();
    expect(() => validatePeriod({ startsAt: now, endsAt: now })).toThrow();
    expect(() =>
      validateMoney({
        amount: '9999999999999999999999.12345678',
        currencyCode: 'USD',
      }),
    ).not.toThrow();
    for (const amount of ['1e2', '-1', 'NaN', '01', '1.123456789'])
      expect(() => validateMoney({ amount, currencyCode: 'IRR' })).toThrow();
    expect(() => validateMoney({ amount: '1', currencyCode: 'usd' })).toThrow();
  });
  it('requires employee identity and an end date for ended employment', () => {
    expect(() => validateEmployee(employee)).not.toThrow();
    expect(() => validateEmployee({ ...employee, status: 'ENDED' })).toThrow();
    expect(() =>
      validateEmployee({ ...employee, personnelCode: '' }),
    ).toThrow();
  });
  it('prevents assignment overlap, self-management and hierarchy cycles', () => {
    const assignment: EmploymentAssignment = {
      ...entity,
      ...period,
      ...target,
      organizationUnitId: 'synthetic-unit',
      positionId: 'synthetic-position',
      cooperationType: 'FIXED_TERM',
    };
    expect(() => validateAssignment(assignment, [])).not.toThrow();
    expect(() =>
      validateAssignment(assignment, [
        { ...assignment, id: 'synthetic-other' },
      ]),
    ).toThrow('CONFLICT');
    expect(() =>
      validateAssignment(
        { ...assignment, managerEmployeeId: assignment.employeeId },
        [],
      ),
    ).toThrow();
    expect(() =>
      assertAcyclic(
        'a',
        'b',
        new Map([
          ['b', 'c'],
          ['c', 'a'],
        ]),
      ),
    ).toThrow();
    expect(() => assertCapacity(1, 2)).toThrow();
    expect(() => assertCapacity(2, 1)).not.toThrow();
  });
  it('derives expired and expiring contracts without reviving ended/cancelled contracts', () => {
    expect(contractStatus(contract, '2026-10-01T00:00:00.000Z', 7)).toBe(
      'ENDED',
    );
    expect(contractStatus(contract, '2026-09-28T00:00:00.000Z', 7)).toBe(
      'EXPIRING',
    );
    expect(contractStatus(contract, now, 7)).toBe('ACTIVE');
    expect(contractStatus({ ...contract, status: 'CANCELLED' }, now, 7)).toBe(
      'CANCELLED',
    );
    expect(() => assertIssuer({ selection: 'ALL' })).toThrow('FORBIDDEN');
    expect(() =>
      assertIssuer({
        selection: 'SPECIFIC',
        issuerLegalEntityId: 'synthetic-issuer',
      }),
    ).not.toThrow();
  });
  it('validates overnight shifts, breaks and attendance', () => {
    expect(validateShift(shift)).toBe(450);
    expect(
      validateShift({
        ...shift,
        startMinute: 1320,
        endMinute: 360,
        overnight: true,
      }),
    ).toBe(450);
    expect(() => validateShift({ ...shift, endMinute: 400 })).toThrow();
    expect(() => validateShift({ ...shift, breakMinutes: 480 })).toThrow();
    expect(() => validateShift({ ...shift, timezone: 'INVALID' })).toThrow();
    expect(() =>
      validateAttendance({
        ...entity,
        employeeId: target.employeeId,
        shiftId: shift.id,
        checkedInAt: now,
        checkedOutAt: now,
        source: 'MANUAL',
        status: 'SUBMITTED',
        makerUserId: actor.userId,
      }),
    ).toThrow();
  });
  it('enforces leave state and maker/checker including a second account linked to self', () => {
    expect(
      transitionLeave(leave, 'APPROVED', actor, 'Synthetic review reason')
        .status,
    ).toBe('APPROVED');
    expect(() =>
      transitionLeave(
        leave,
        'APPROVED',
        { ...actor, userId: leave.requesterUserId },
        'Synthetic review reason',
      ),
    ).toThrow('FORBIDDEN');
    expect(() =>
      transitionLeave(
        leave,
        'APPROVED',
        { ...actor, employeeId: leave.employeeId },
        'Synthetic review reason',
      ),
    ).toThrow('FORBIDDEN');
    expect(() =>
      transitionLeave(
        { ...leave, status: 'APPROVED' },
        'PENDING',
        actor,
        'Synthetic review reason',
      ),
    ).toThrow('CONFLICT');
    expect(() => makerChecker('same', 'same')).toThrow();
  });
  it('validates reasons, optimistic version, idempotency and weighted scores', () => {
    expect(() => validateReason('   ')).toThrow();
    expect(() => validateReason('x'.repeat(501))).toThrow();
    expect(() => assertMutation(1, 2, 'synthetic-key-12345')).toThrow(
      'CONFLICT',
    );
    expect(() => assertMutation(1, 1, 'short')).toThrow();
    expect(
      performanceScore([
        { id: 'a', weight: 60, score: 80 },
        { id: 'b', weight: 40, score: 90 },
      ]),
    ).toBe(84);
    expect(() =>
      performanceScore([{ id: 'a', weight: 99, score: 80 }]),
    ).toThrow();
    expect(() =>
      performanceScore([{ id: 'a', weight: 100, score: Infinity }]),
    ).toThrow();
  });
});

describe('HR permission matrix and privacy', () => {
  it.each(hrPermissions)('denies absent grant %s', (permission) => {
    expect(canAccess({ ...actor, permissions: [] }, permission, target)).toBe(
      false,
    );
    expect(canAccess(null, permission, target)).toBe(false);
  });
  it('applies self, manager and branch scope before any access', () => {
    const self = {
      ...actor,
      scope: 'SELF' as const,
      employeeId: target.employeeId,
    };
    expect(canAccess(self, 'hr.read', target)).toBe(true);
    expect(canAccess(self, 'hr.read', { ...target, employeeId: 'other' })).toBe(
      false,
    );
    expect(canAccess(self, 'hr.sensitive.read', target)).toBe(false);
    expect(canAccess({ ...actor, scope: 'MANAGER' }, 'hr.read', target)).toBe(
      true,
    );
    expect(
      canAccess(
        { ...actor, scope: 'MANAGER', managedEmployeeIds: [] },
        'hr.read',
        target,
      ),
    ).toBe(false);
    expect(
      canAccess({ ...actor, permissions: ['hr.read'] }, 'hr.read', {
        ...target,
        branchId: 'synthetic-other-branch',
      }),
    ).toBe(false);
    expect(
      canAccess(actor, 'hr.read', {
        ...target,
        branchId: 'synthetic-other-branch',
      }),
    ).toBe(true);
    expect(
      canAccess(actor, 'hr.read', { ...target, branchId: 'unassigned' }),
    ).toBe(false);
  });
  it('projects a masked allowlist even if an input has extra private fields', () => {
    const summary = employeeSummary({
      ...employee,
      nationalId: 'SYNTHETIC-PRIVATE',
      medicalNote: 'PRIVATE',
    } as Employee);
    expect(JSON.stringify(summary)).not.toContain('PRIVATE');
    expect(summary.nationalId).toBe('••••••••');
  });
  it('audits before reveal and never includes values or raw reasons', async () => {
    const order: string[] = [];
    const append = vi.fn(async () => {
      order.push('audit');
    });
    const readField = vi.fn(async () => {
      order.push('read');
      return 'SYNTHETIC-PRIVATE';
    });
    const input = {
      actor,
      target,
      field: 'nationalId' as const,
      reason: 'SYNTHETIC private purpose',
      reasonCode: 'HR_REVIEW' as const,
      now,
      traceId: 'synthetic-trace',
    };
    expect(await revealSensitive(input, { append }, { readField })).toBe(
      'SYNTHETIC-PRIVATE',
    );
    expect(order).toEqual(['audit', 'read']);
    expect(JSON.stringify(append.mock.calls)).not.toContain(input.reason);
    readField.mockClear();
    await expect(
      revealSensitive(
        input,
        {
          append: async () => {
            throw new Error('AUDIT_UNAVAILABLE');
          },
        },
        { readField },
      ),
    ).rejects.toThrow();
    expect(readField).not.toHaveBeenCalled();
    await expect(
      revealSensitive({ ...input, reason: '' }, { append }, { readField }),
    ).rejects.toThrow('INVALID');
    expect(readField).not.toHaveBeenCalled();
  });
  it('requires CLEAN authorized matching Documents reference and respects legal hold', async () => {
    const link: PersonnelDocument = {
      ...entity,
      employeeId: target.employeeId,
      documentId: 'synthetic-document',
      classification: 'IDENTITY',
      retentionPolicyId: 'synthetic-policy',
      legalHold: true,
    };
    const openAuthorized = vi.fn(async () => undefined);
    for (const scan of ['PENDING', 'INFECTED'] as const)
      await expect(
        openPersonnelDocument(actor, target, link, 'Synthetic review reason', {
          inspect: async () => ({
            id: link.documentId,
            authorized: true,
            scan,
          }),
          openAuthorized,
        }),
      ).rejects.toThrow('FORBIDDEN');
    expect(openAuthorized).not.toHaveBeenCalled();
    await openPersonnelDocument(
      actor,
      target,
      link,
      'Synthetic review reason',
      {
        inspect: async () => ({
          id: link.documentId,
          authorized: true,
          scan: 'CLEAN',
        }),
        openAuthorized,
      },
    );
    expect(openAuthorized).toHaveBeenCalledTimes(1);
    expect(
      mayDisposeDocument(
        link,
        { approved: true, retainUntil: period.startsAt },
        now,
      ),
    ).toBe(false);
    expect(mayDisposeDocument({ ...link, legalHold: false }, null, now)).toBe(
      false,
    );
    expect(proposedHttpContract.active).toBe(false);
  });
});
