import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { Prisma } from '@nora/database';

const select = {
  id: true,
  displayName: true,
  username: true,
  hrEmployee: {
    select: {
      name: true,
      unit: true,
      position: true,
      grade: true,
      deletedAt: true,
      jobTitle: { select: { values: true, deletedAt: true } },
    },
  },
  profile: {
    select: { organizationUnit: { select: { values: true, deletedAt: true } } },
  },
} satisfies Prisma.UserSelect;
function directoryUser(user: Prisma.UserGetPayload<{ select: typeof select }>) {
  const employee =
    user.hrEmployee && !user.hrEmployee.deletedAt ? user.hrEmployee : null;
  const position = employee?.jobTitle;
  const unit = user.profile?.organizationUnit;
  const label = (record: typeof unit, index: number) => {
    const value =
      record && !record.deletedAt && Array.isArray(record.values)
        ? record.values[index]
        : null;
    return typeof value === 'string' ? value.trim() : '';
  };
  const title = label(position ?? null, 1) || employee?.position.trim() || '';
  const grade = employee?.grade.trim() || '';
  const jobTitle =
    grade && title !== grade && !title.startsWith(`${grade} `)
      ? [grade, title].filter(Boolean).join(' ')
      : title || grade;
  return {
    id: user.id,
    username: user.username,
    displayName: employee?.name.trim() || user.displayName,
    jobTitle,
    unit: label(unit ?? null, 0) || employee?.unit.trim() || '',
  };
}

/** Public internal account directory: identity labels only, never personnel/contact/grant data. */
@Injectable()
export class IamCorrespondenceDirectory {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  async list(tx?: Prisma.TransactionClient) {
    const users = await (tx ?? this.database.client).user.findMany({
      where: { status: 'ACTIVE', b2bOrganizationUser: null },
      select,
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    });
    return users.map(directoryUser);
  }
  async resolve(id: string, tx?: Prisma.TransactionClient) {
    const user = await (tx ?? this.database.client).user.findFirst({
      where: { id, status: 'ACTIVE', b2bOrganizationUser: null },
      select,
    });
    if (!user) throw new BadRequestException('کاربر مقصد فعال نیست.');
    return directoryUser(user);
  }
}
