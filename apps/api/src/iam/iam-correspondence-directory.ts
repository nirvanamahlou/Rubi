import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { Prisma } from '@nora/database';

/** Public internal account directory: identity labels only, never personnel/contact/grant data. */
@Injectable()
export class IamCorrespondenceDirectory {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  list(tx?: Prisma.TransactionClient) {
    return (tx ?? this.database.client).user.findMany({
      where: { status: 'ACTIVE', b2bOrganizationUser: null },
      select: { id: true, displayName: true, username: true },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    });
  }
  async resolve(id: string, tx: Prisma.TransactionClient) {
    const user = await tx.user.findFirst({
      where: { id, status: 'ACTIVE', b2bOrganizationUser: null },
      select: { id: true, displayName: true, username: true },
    });
    if (!user) throw new BadRequestException('کاربر مقصد فعال نیست.');
    return user;
  }
}
