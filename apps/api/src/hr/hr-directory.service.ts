import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  HrDirectoryResponse,
  HrFormReferences,
} from '@rubi/contracts';
import { DatabaseService } from '../database/database.service';
import { IamService } from '../iam/iam.service';
import { MasterHrDirectory } from '../master-data/master-hr-directory';
import * as validate from './hr.validation';

const selection = {
  id: true,
  personnelCode: true,
  name: true,
  branchId: true,
  userId: true,
  unit: true,
  position: true,
} as const;

@Injectable()
export class HrDirectoryService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(IamService) private readonly iam: IamService,
    @Inject(MasterHrDirectory) readonly master: MasterHrDirectory,
  ) {}

  private scope(actor: AuthenticatedActor, branchId?: string) {
    if (
      !actor.permissions.some((p) =>
        [
          'hr.directory.read',
          'hr.read',
          'hr.manage',
          'documents.hr.read',
        ].includes(p),
      )
    )
      throw new ForbiddenException('مجوز فهرست کارکنان وجود ندارد.');
    if (branchId && !actor.branchIds.includes(validate.uuid(branchId)))
      throw new ForbiddenException('شعبه در محدوده دسترسی نیست.');
    return {
      branchId: { in: branchId ? [branchId] : actor.branchIds },
      deletedAt: null,
    };
  }

  async employees(
    query: Record<string, unknown>,
    actor: AuthenticatedActor,
  ): Promise<HrDirectoryResponse> {
    validate.object(query, ['branchId', 'search', 'page']);
    const search = validate.text(query.search, 'جست‌وجو', 100, true);
    const page = Number(query.page ?? 1);
    validate.version(page);
    const employees = await this.database.client.hrEmployee.findMany({
      where: {
        ...this.scope(
          actor,
          query.branchId === undefined
            ? undefined
            : validate.uuid(query.branchId),
        ),
        status: 'فعال',
        ...(search
          ? {
              OR: ['name', 'personnelCode', 'unit', 'position'].map(
                (field) => ({
                  [field]: { contains: search, mode: 'insensitive' as const },
                }),
              ),
            }
          : {}),
      },
      select: selection,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 51,
      skip: (page - 1) * 50,
    });
    return {
      employees: employees.slice(0, 50),
      hasMore: employees.length > 50,
    };
  }

  /** Archival references can identify former employees, but never deleted/cross-branch ones. */
  async employee(id: string, branchId: string, actor: AuthenticatedActor) {
    const found = await this.database.client.hrEmployee.findFirst({
      where: { ...this.scope(actor, branchId), id: validate.uuid(id) },
      select: selection,
    });
    if (!found)
      throw new NotFoundException('کارمند در شعبه انتخاب‌شده پیدا نشد.');
    return found;
  }

  async formReferences(
    actor: AuthenticatedActor,
    employeeId?: string,
  ): Promise<HrFormReferences> {
    if (
      !actor.permissions.some((p) =>
        ['hr.read', 'hr.manage', 'hr.self', 'hr.team'].includes(p),
      )
    )
      throw new ForbiddenException('دسترسی منابع انسانی وجود ندارد.');
    const currencies = await this.master.currencies();
    if (!actor.permissions.includes('hr.manage'))
      return { users: [], currencies };
    if (
      employeeId &&
      !(await this.database.client.hrEmployee.findFirst({
        where: { id: validate.uuid(employeeId), ...this.scope(actor) },
        select: { id: true },
      }))
    )
      throw new NotFoundException('کارمند در محدوده دسترسی پیدا نشد.');
    const [users, linked] = await Promise.all([
      this.iam.listUsers(),
      // userId is globally unique, including archived personnel. Do not offer a claimed account.
      this.database.client.hrEmployee.findMany({
        where: {
          userId: { not: null },
          ...(employeeId ? { id: { not: employeeId } } : {}),
        },
        select: { userId: true },
      }),
    ]);
    const claimed = new Set(linked.map((e) => e.userId));
    return {
      currencies,
      users: users
        .filter(
          (u) =>
            u.status === 'ACTIVE' &&
            !claimed.has(u.id) &&
            u.branches.some((b) => actor.branchIds.includes(b.branch.id)),
        )
        .map((u) => ({
          id: u.id,
          label: `${u.displayName} · ${u.username}`,
          branchIds: u.branches
            .map((b) => b.branch.id)
            .filter((id) => actor.branchIds.includes(id)),
        })),
    };
  }

  /**
   * Public routing lookup for Workbench. It returns user identifiers only and
   * keeps personnel records inside HR. An active branch administrator is used
   * as the delivery fallback when a department has no linked employee account.
   */
  async workbenchFeedbackRecipientUserIds(
    branchId: string,
    searchTerms: readonly string[],
  ): Promise<string[]> {
    const terms = [...new Set(searchTerms.map((term) => term.trim()))].filter(
      Boolean,
    );
    const employees = await this.database.client.hrEmployee.findMany({
      where: {
        branchId,
        deletedAt: null,
        status: 'فعال',
        userId: { not: null },
        ...(terms.length
          ? {
              OR: terms.flatMap((term) => [
                { unit: { contains: term, mode: 'insensitive' as const } },
                { position: { contains: term, mode: 'insensitive' as const } },
              ]),
            }
          : {}),
      },
      select: { userId: true },
    });
    const recipients = employees.flatMap(({ userId }) =>
      userId ? [userId] : [],
    );
    if (recipients.length) return [...new Set(recipients)];

    const users = await this.iam.listUsers();
    return users
      .filter(
        (user) =>
          user.status === 'ACTIVE' &&
          user.branches.some(({ branch }) => branch.id === branchId) &&
          user.roles.some(
            ({ role }) =>
              role.code === 'administrator' ||
              role.name.includes('مدیر') ||
              role.name.toLowerCase().includes('admin'),
          ),
      )
      .map(({ id }) => id);
  }
}
