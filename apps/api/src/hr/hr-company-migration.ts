import { ConflictException } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { saveEmployeeCompanyScope } from './hr-company-scope';

type HrRecord = Prisma.HrRecordGetPayload<null>;

const action = 'organization.companyScope.migrate';
export function orderedCompanyUnits<
  T extends { id: string; parentId: string | null },
>(units: T[], canonicalIds: ReadonlyMap<string, string> = new Map()): T[] {
  const pending = new Map(units.map((unit) => [unit.id, unit]));
  const result: T[] = [];
  while (pending.size) {
    const ready = [...pending.values()].filter(
      (unit) =>
        !unit.parentId ||
        !pending.has(canonicalIds.get(unit.parentId) ?? unit.parentId),
    );
    if (!ready.length)
      throw new ConflictException('ساختار واحدها دارای چرخه است.');
    for (const unit of ready) {
      result.push(unit);
      pending.delete(unit.id);
    }
  }
  return result;
}
/** Called only inside a serializable transaction, after complete IAM scope validation. */
export async function migrateHrCompanyStructure(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  dryRun: boolean,
  syncUnit: (row: HrRecord) => Promise<void>,
) {
  const prior = await tx.hrAuditEvent.findFirst({
    where: { action, branchId: { in: actor.branchIds } },
  });
  if (prior)
    return { alreadyApplied: true, employees: 0, units: 0, subsidiaries: 0 };
  const [employees, records] = await Promise.all([
    tx.hrEmployee.findMany({
      where: { branchId: { in: actor.branchIds }, deletedAt: null },
    }),
    tx.hrRecord.findMany({
      where: {
        branchId: { in: actor.branchIds },
        section: 'organization',
        tab: { in: ['units', 'branches'] },
        deletedAt: null,
      },
    }),
  ]);
  const subsidiaries = records.filter((row) => row.tab === 'branches');
  const units = orderedCompanyUnits(
    records.filter((row) => row.tab === 'units' && !row.sharedSourceId),
    new Map(records.map((row) => [row.id, row.sharedSourceId ?? row.id])),
  );
  const report = {
    alreadyApplied: false,
    employees: employees.length,
    units: units.length,
    subsidiaries: subsidiaries.length,
  };
  if (dryRun) return report;
  const audit = async (
    branchId: string,
    changes: Prisma.InputJsonValue,
    recordId?: string,
    employeeId?: string,
  ) => {
    await tx.hrAuditEvent.create({
      data: {
        branchId,
        actorId: actor.userId,
        action: 'organization.companyScope.transfer',
        changes,
        ...(recordId ? { recordId } : {}),
        ...(employeeId ? { employeeId } : {}),
      },
    });
  };
  for (const employee of employees) {
    const priorScope = await tx.hrRecord.findFirst({
      where: {
        employeeId: employee.id,
        section: 'employee',
        tab: 'companyScope',
        deletedAt: null,
      },
    });
    await audit(
      employee.branchId,
      {
        organizationBranchId: employee.organizationBranchId,
        companyScopeValues: priorScope?.values ?? null,
      },
      undefined,
      employee.id,
    );
    await saveEmployeeCompanyScope(tx, employee, 'ALL', null, actor.branchIds);
    await tx.hrEmployee.update({
      where: { id: employee.id },
      data: { organizationBranchId: null, version: { increment: 1 } },
    });
  }
  for (const unit of units) {
    const metadata = { ...(unit.data as Record<string, unknown>) };
    await audit(
      unit.branchId,
      { data: unit.data, parentId: unit.parentId } as Prisma.InputJsonValue,
      unit.id,
    );
    delete metadata.organizationBranchId;
    metadata.allBranches = true;
    const parentId = subsidiaries.some((branch) => branch.id === unit.parentId)
      ? null
      : unit.parentId;
    const updated = await tx.hrRecord.update({
      where: { id: unit.id },
      data: {
        data: metadata as Prisma.InputJsonValue,
        parentId,
        version: { increment: 1 },
      },
    });
    await syncUnit(updated);
  }
  for (const subsidiary of subsidiaries) {
    await audit(
      subsidiary.branchId,
      { status: subsidiary.status, deletedAt: null },
      subsidiary.id,
    );
    await tx.hrRecord.update({
      where: { id: subsidiary.id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
  }
  if (actor.branchIds[0])
    await tx.hrAuditEvent.create({
      data: {
        branchId: actor.branchIds[0],
        actorId: actor.userId,
        action,
        changes: report,
      },
    });
  return report;
}
