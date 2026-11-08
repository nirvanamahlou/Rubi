import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@nora/database';

export function parseEmployeeCompanyScope(
  value: unknown,
): 'ALL' | 'COMPANY' | undefined {
  if (value === undefined) return undefined;
  if (value !== 'ALL' && value !== 'COMPANY')
    throw new BadRequestException('دامنه شرکت معتبر نیست.');
  return value;
}
export async function saveEmployeeCompanyScope(
  tx: Prisma.TransactionClient,
  employee: { id: string; branchId: string },
  value: unknown,
  companyId: unknown,
  allowedCompanyIds: readonly string[],
) {
  const scope = parseEmployeeCompanyScope(value);
  if (scope === undefined) {
    if (companyId !== undefined)
      throw new BadRequestException('دامنه شرکت الزامی است.');
    return;
  }
  const targetCompanyId =
    scope === 'ALL' ? '' : (companyId ?? employee.branchId);
  if (
    scope === 'COMPANY' &&
    (typeof targetCompanyId !== 'string' ||
      !allowedCompanyIds.includes(targetCompanyId))
  )
    throw new BadRequestException('شرکت در محدوده دسترسی نیست.');
  if (scope === 'ALL' && companyId != null)
    throw new BadRequestException('برای همه شرکت‌ها شرکت مشخص انتخاب نشود.');
  const existing = await tx.hrRecord.findFirst({
    where: {
      employeeId: employee.id,
      section: 'employee',
      tab: 'companyScope',
      deletedAt: null,
    },
  });
  if (existing) {
    await tx.hrRecord.update({
      where: { id: existing.id },
      data: {
        values: [scope, targetCompanyId as string],
        branchId: employee.branchId,
        version: { increment: 1 },
      },
    });
  } else {
    await tx.hrRecord.create({
      data: {
        employeeId: employee.id,
        branchId: employee.branchId,
        section: 'employee',
        tab: 'companyScope',
        code: `HR-COMPANY-${employee.id}`,
        values: [scope, targetCompanyId as string],
        status: 'فعال',
      },
    });
  }
}

/** Organizational filtering is always intersected with the caller's IAM scope. */
export function employeeCompanyWhere(
  companyId: string,
): Prisma.HrEmployeeWhereInput {
  const scope = { section: 'employee', tab: 'companyScope', deletedAt: null };
  return {
    OR: [
      {
        records: { some: { ...scope, values: { path: ['0'], equals: 'ALL' } } },
      },
      {
        records: {
          some: {
            ...scope,
            AND: [
              { values: { path: ['0'], equals: 'COMPANY' } },
              { values: { path: ['1'], equals: companyId } },
            ],
          },
        },
      },
      { branchId: companyId, records: { none: scope } },
    ],
  };
}
export function recordCompanyWhere(
  companyId: string,
): Prisma.HrRecordWhereInput {
  return {
    OR: [
      { employee: employeeCompanyWhere(companyId) },
      {
        employeeId: null,
        OR: [
          { branchId: companyId },
          { data: { path: ['allBranches'], equals: true } },
        ],
      },
    ],
  };
}
