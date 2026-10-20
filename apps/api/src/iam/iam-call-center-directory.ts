import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { authenticatedPermissionCodes } from './authenticated-permissions';

/** Public, branch-scoped directory. Does not expose roles or personnel data. */
@Injectable()
export class IamCallCenterDirectory {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  private async rows(branchId: string, tx?: Prisma.TransactionClient) {
    return (tx ?? this.database.client).user.findMany({
      where: {
        status: 'ACTIVE',
        b2bOrganizationUser: null,
        branches: { some: { branchId, branch: { isActive: true } } },
      },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    });
  }
  async list(branchId: string, tx?: Prisma.TransactionClient) {
    return (await this.rows(branchId, tx))
      .filter((user) => {
        const permissions = authenticatedPermissionCodes(user.roles);
        return (
          permissions.includes('customer_affairs.call_center.read') &&
          permissions.includes('customer_affairs.call_center.workflow.manage')
        );
      })
      .map(({ id, displayName }) => ({ id, displayName }));
  }
  async eligibleMapping(
    branchId: string,
    userId: string,
    teamId: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    if (!(await this.list(branchId, tx)).some((user) => user.id === userId))
      return false;
    if (!teamId) return true;
    return !!(await (tx ?? this.database.client).user.findFirst({
      where: { id: userId, profile: { organizationUnitId: teamId } },
      select: { id: true },
    }));
  }
  /** Public IAM check used immediately before a queued PBX side effect. */
  async canOriginate(branchId: string, userId: string) {
    const user = (await this.rows(branchId)).find((row) => row.id === userId);
    if (!user) return false;
    const permissions = authenticatedPermissionCodes(user.roles);
    return (
      [
        'customer_affairs.call_center.read',
        'customer_affairs.call_center.workflow.manage',
        'customer_affairs.call_center.calls.create',
      ] as const
    ).every((code) => permissions.includes(code));
  }
  async referral(
    tx: Prisma.TransactionClient,
    branchId: string,
    id: string,
    destination: 'SALES' | 'SUPPORT',
  ) {
    await this.resolve(tx, branchId, id);
    const row = (await this.rows(branchId, tx)).find((user) => user.id === id);
    const permissions = row ? authenticatedPermissionCodes(row.roles) : [];
    const allowed =
      destination === 'SALES'
        ? permissions.some((p) => p.startsWith('sales.contracts.read.'))
        : permissions.includes('customer_affairs.ticket.read');
    if (!allowed)
      throw new BadRequestException('گیرنده مجوز ماژول مقصد را ندارد.');
  }
  async resolve(tx: Prisma.TransactionClient, branchId: string, id: string) {
    await tx.$queryRaw`SELECT id FROM iam_users WHERE id = ${id}::uuid FOR SHARE`;
    await tx.$queryRaw`SELECT "userId" FROM iam_user_branches WHERE "userId" = ${id}::uuid AND "branchId" = ${branchId}::uuid FOR SHARE`;
    const user = (await this.list(branchId, tx)).find((row) => row.id === id);
    if (!user)
      throw new BadRequestException(
        'کارشناس فعال و مجاز این شعبه را انتخاب کنید.',
      );
    return user;
  }
}
