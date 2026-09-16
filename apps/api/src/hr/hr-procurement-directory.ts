import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { DatabaseService } from '../database/database.service';

/** Minimal public employee projection for Procurement own/unit scope. */
@Injectable()
export class HrProcurementDirectory {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  async self(actor: AuthenticatedActor, branchId?: string) {
    return this.activeEmployee(actor, actor.userId, branchId);
  }
  /** Called only after Procurement has authorized the request aggregate. */
  async requester(actor: AuthenticatedActor, userId: string, branchId: string) {
    if (
      !actor.permissions.some((permission) =>
        [
          'procurement.request.create',
          'procurement.request.update',
          'procurement.request.submit',
        ].includes(permission),
      )
    )
      return null;
    return this.activeEmployee(actor, userId, branchId);
  }
  async employee(
    actor: AuthenticatedActor,
    employeeId: string,
    branchId: string,
  ) {
    if (!actor.branchIds.includes(branchId)) return null;
    const row = await this.database.client.hrEmployee.findFirst({
      where: { id: employeeId, branchId, status: 'فعال', deletedAt: null },
      select: {
        id: true,
        branchId: true,
        name: true,
        unit: true,
        version: true,
        userId: true,
      },
    });
    return row
      ? {
          id: row.id,
          branchId: row.branchId,
          label: row.name,
          unitId: row.unit || null,
          version: row.version,
          userId: row.userId,
        }
      : null;
  }
  /** Bounded active HR employees in an authorized branch; IAM login is optional. */
  async candidates(
    actor: AuthenticatedActor,
    branchId: string,
    search: string,
    page: number,
    unit?: string,
  ) {
    if (!actor.branchIds.includes(branchId))
      return { items: [], page, pageSize: 50, hasMore: false };
    const rows = await this.database.client.hrEmployee.findMany({
      where: {
        branchId,
        status: 'فعال',
        deletedAt: null,
        ...(unit ? { unit } : {}),
        ...(search
          ? { name: { contains: search, mode: 'insensitive' as const } }
          : {}),
      },
      select: { id: true, name: true, unit: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 51,
      skip: (page - 1) * 50,
    });
    return {
      items: rows.slice(0, 50).map((row) => ({
        id: row.id,
        label: row.name,
        unitId: row.unit || null,
      })),
      page,
      pageSize: 50,
      hasMore: rows.length > 50,
    };
  }
  /** Active organization-unit choices owned by HR, without exposing personnel data. */
  async units(actor: AuthenticatedActor, branchId: string) {
    if (!actor.branchIds.includes(branchId)) return [];
    const [catalogRows, employeeRows] = await Promise.all([
      this.database.client.hrRecord.findMany({
        where: {
          branchId,
          section: 'organization',
          tab: 'units',
          status: 'فعال',
          deletedAt: null,
        },
        select: { values: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.database.client.hrEmployee.findMany({
        where: { branchId, status: 'فعال', deletedAt: null },
        select: { unit: true },
        distinct: ['unit'],
        orderBy: { unit: 'asc' },
      }),
    ]);
    const labels = new Set(
      catalogRows.flatMap(({ values }) => {
        if (!Array.isArray(values)) return [];
        const label = values[0];
        return typeof label === 'string' && label.trim() ? [label.trim()] : [];
      }),
    );
    for (const { unit } of employeeRows)
      if (unit.trim()) labels.add(unit.trim());
    return [...labels]
      .sort((left, right) => left.localeCompare(right, 'fa'))
      .map((label) => ({ id: label, label }));
  }
  private async activeEmployee(
    actor: AuthenticatedActor,
    userId: string,
    branchId?: string,
  ) {
    if (branchId && !actor.branchIds.includes(branchId)) return null;
    const row = await this.database.client.hrEmployee.findFirst({
      where: {
        userId,
        branchId: { in: branchId ? [branchId] : actor.branchIds },
        status: 'فعال',
        deletedAt: null,
      },
      select: {
        id: true,
        userId: true,
        branchId: true,
        name: true,
        unit: true,
        version: true,
      },
    });
    return row
      ? {
          id: row.id,
          version: row.version,
          userId: row.userId,
          branchId: row.branchId,
          label: row.name,
          unitId: row.unit || null,
        }
      : null;
  }
}
