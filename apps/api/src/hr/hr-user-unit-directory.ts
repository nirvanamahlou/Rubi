import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Module,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';

/** Public HR-owned lookup for IAM; never exposes personnel, payroll or arbitrary HR records. */
@Injectable()
export class HrUserUnitDirectory {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  /** Live HR authority for request assignment; never a persisted IAM role grant.
   * At save time the returned personnel snapshot is row-locked, including the
   * manager's grade/unit and every included employee's current membership.
   */
  async callCenterRequestTeam(
    branchId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string[] | null> {
    type Member = {
      userId: string | null;
      organizationBranchId: string | null;
      unit: string;
      grade: string;
    };
    type Unit = { values: unknown; data: unknown };
    const employees: Member[] = tx
      ? await tx.$queryRaw<
          Member[]
        >`SELECT user_id AS "userId", organization_branch_id AS "organizationBranchId", unit, grade FROM hr_employees WHERE branch_id=${branchId}::uuid AND status='فعال' AND deleted_at IS NULL AND user_id IS NOT NULL ORDER BY id FOR SHARE`
      : await this.database.client.hrEmployee.findMany({
          where: {
            branchId,
            status: 'فعال',
            deletedAt: null,
            userId: { not: null },
          },
          select: {
            userId: true,
            organizationBranchId: true,
            unit: true,
            grade: true,
          },
        });
    const manager = employees.find((employee) => employee.userId === userId);
    if (!manager || manager.grade !== 'مدیر' || !manager.unit.trim())
      return null;
    const units: Unit[] = tx
      ? await tx.$queryRaw<
          Unit[]
        >`SELECT "values", data FROM hr_records WHERE branch_id=${branchId}::uuid AND section='organization' AND tab='units' AND status='فعال' AND deleted_at IS NULL ORDER BY id FOR SHARE`
      : await this.database.client.hrRecord.findMany({
          where: {
            branchId,
            section: 'organization',
            tab: 'units',
            status: 'فعال',
            deletedAt: null,
          },
          select: { values: true, data: true },
        });
    const matches = units.filter((unit) => {
      const company = (unit.data as { organizationBranchId?: string } | null)
        ?.organizationBranchId;
      return (
        Array.isArray(unit.values) &&
        unit.values[0] === manager.unit &&
        (!company || company === manager.organizationBranchId)
      );
    });
    if (matches.length !== 1) return null;
    if (tx && manager.organizationBranchId)
      await tx.$queryRaw`SELECT id FROM hr_records WHERE id=${manager.organizationBranchId}::uuid AND branch_id=${branchId}::uuid ORDER BY id FOR SHARE`;
    if (
      manager.organizationBranchId &&
      !(await (tx ?? this.database.client).hrRecord.findFirst({
        where: {
          id: manager.organizationBranchId,
          branchId,
          section: 'organization',
          tab: 'branches',
          status: 'فعال',
          deletedAt: null,
        },
        select: { id: true },
      }))
    )
      return null;
    return [
      ...new Set(
        employees
          .filter(
            (employee) =>
              employee.unit === manager.unit &&
              employee.organizationBranchId === manager.organizationBranchId,
          )
          .flatMap((employee) => (employee.userId ? [employee.userId] : [])),
      ),
    ].sort();
  }

  /** Authoritative account links for a physical extension; never use display labels/bootstrap files.
   * Historical reads require records unchanged since the answer; uncertain history grants nobody.
   */
  async callCenterAnswerAccounts(
    branchId: string,
    extension: string,
    at: Date,
    tx: Prisma.TransactionClient,
  ) {
    const employees = await tx.hrEmployee.findMany({
      where: {
        branchId,
        status: 'فعال',
        deletedAt: null,
        userId: { not: null },
        createdAt: { lte: at },
        updatedAt: { lte: at },
        records: {
          some: {
            branchId,
            section: 'employee',
            tab: 'internalContact',
            deletedAt: null,
            createdAt: { lte: at },
            updatedAt: { lte: at },
            values: { path: ['0'], equals: extension },
          },
        },
      },
      select: { userId: true },
    });
    return [
      ...new Set(employees.flatMap((row) => (row.userId ? [row.userId] : []))),
    ];
  }

  async callCenterUnit(
    branchId: string,
    id: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (tx)
      await tx.$queryRaw`SELECT id FROM hr_records WHERE id=${id}::uuid FOR SHARE`;
    return !!(await (tx ?? this.database.client).hrRecord.findFirst({
      where: {
        id,
        branchId,
        section: 'organization',
        tab: 'units',
        status: 'فعال',
        deletedAt: null,
      },
      select: { id: true },
    }));
  }

  /** Minimal public job identity for request routing; never returns private HR fields. */
  async callCenterStaff(
    branchId: string,
    userIds: string[],
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? this.database.client).hrEmployee.findMany({
      where: {
        branchId,
        userId: { in: userIds },
        status: 'فعال',
        deletedAt: null,
      },
      select: { userId: true, name: true, position: true },
    });
  }

  async list(actor: AuthenticatedActor) {
    if (!actor.permissions.includes('iam.users.manage'))
      throw new ForbiddenException();
    const rows = await this.database.client.hrRecord.findMany({
      where: {
        section: 'organization',
        tab: 'units',
        status: 'فعال',
        deletedAt: null,
        branchId: { in: actor.branchIds },
      },
      select: { id: true, branchId: true, values: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.flatMap((row) => {
      const name = Array.isArray(row.values) ? row.values[0] : null;
      return typeof name === 'string' && name.trim()
        ? [{ id: row.id, branchId: row.branchId, name: name.trim() }]
        : [];
    });
  }

  async assertAssignable(
    tx: Pick<Prisma.TransactionClient, 'hrRecord' | '$queryRaw'>,
    id: string,
    actor: AuthenticatedActor,
    userBranchIds: string[],
  ) {
    if (!actor.permissions.includes('iam.users.manage'))
      throw new ForbiddenException();
    await tx.$queryRaw`SELECT id FROM hr_records WHERE id = ${id}::uuid FOR SHARE`;
    const row = await tx.hrRecord.findFirst({
      where: {
        id,
        section: 'organization',
        tab: 'units',
        status: 'فعال',
        deletedAt: null,
        branchId: {
          in: actor.branchIds.filter((branchId) =>
            userBranchIds.includes(branchId),
          ),
        },
      },
      select: { id: true, branchId: true },
    });
    if (!row)
      throw new BadRequestException(
        'واحد سازمانی فعال در شعب مجاز کاربر پیدا نشد.',
      );
    return row;
  }

  async assertRetainedBranch(
    tx: Pick<Prisma.TransactionClient, 'hrRecord'>,
    id: string,
    branchIds: string[],
  ) {
    const row = await tx.hrRecord.findUnique({
      where: { id },
      select: { branchId: true },
    });
    if (!row || !branchIds.includes(row.branchId))
      throw new BadRequestException(
        'پیش از حذف شعبه، واحد سازمانی کاربر را تغییر دهید یا پاک کنید.',
      );
  }
}

@Module({ providers: [HrUserUnitDirectory], exports: [HrUserUnitDirectory] })
export class HrUserUnitDirectoryModule {}
