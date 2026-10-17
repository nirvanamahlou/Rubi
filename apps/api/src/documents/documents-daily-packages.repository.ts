import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DocumentsDailyPackagesRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async list(input: {
    branchId: string;
    from: Date;
    to: Date;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.DocumentWhereInput = {
      branchId: input.branchId,
      sourceModule: 'WORKBENCH',
      sourceEntityType: 'WorkbenchDailyPackage',
      sourceEntityId: input.branchId,
      documentType: { code: 'BRAND_ASSET_TEMPLATE', domain: 'BRAND' },
      confidentiality: 'INTERNAL',
      confidentialAccessCodeHash: null,
      requiresStepUpVerification: false,
      archiveStatus: 'ACTIVE',
      currentVersion: { detectedMimeType: 'application/pdf' },
      createdAt: { gte: input.from, lt: input.to },
    };
    const [rows, total] = await this.database.client.$transaction([
      this.database.client.document.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: {
          id: true,
          title: true,
          branchId: true,
          createdAt: true,
          owner: { select: { displayName: true } },
          currentVersion: { select: { scanStatus: true } },
        },
      }),
      this.database.client.document.count({ where }),
    ]);
    return { rows, total };
  }
}
