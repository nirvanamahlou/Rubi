import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/** Public owner projection. Procurement never reads Master Data tables itself. */
@Injectable()
export class MasterProcurementDirectory {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  branches(ids: string[]) {
    return this.database.client.branch.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, name: true },
      take: 100,
    });
  }
  currencies() {
    return this.database.client.masterCurrency.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
      take: 250,
    });
  }
  async assertCurrency(code: string) {
    if (
      !(await this.database.client.masterCurrency.findFirst({
        where: { code, isActive: true },
        select: { id: true },
      }))
    )
      throw new BadRequestException('ارز باید در اطلاعات پایه فعال باشد.');
  }
  async suppliers(
    search: string,
    page: number,
    dates: { start: Date | null; endExclusive: Date | null } = {
      start: null,
      endExclusive: null,
    },
  ) {
    const rows = await this.database.client.masterSupplier.findMany({
      where: {
        ...(dates.start || dates.endExclusive
          ? {
              createdAt: {
                ...(dates.start ? { gte: dates.start } : {}),
                ...(dates.endExclusive ? { lt: dates.endExclusive } : {}),
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        version: true,
        isActive: true,
        collaborationStatus: true,
      },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
      take: 51,
      skip: (page - 1) * 50,
    });
    return {
      items: rows.slice(0, 50),
      page,
      pageSize: 50,
      hasMore: rows.length > 50,
    };
  }
  async supplier(id: string) {
    const row = await this.database.client.masterSupplier.findFirst({
      where: { id, isActive: true, collaborationStatus: 'ACTIVE' },
      select: { id: true, name: true, code: true, version: true },
    });
    if (!row)
      throw new BadRequestException(
        'تأمین‌کننده فعال و مجاز برای خرید پیدا نشد.',
      );
    return { id: row.id, version: row.version, label: row.name ?? row.code };
  }
}
