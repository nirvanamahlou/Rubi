import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/** Master Data owns the catalog; HR consumes only this public projection. */
@Injectable()
export class MasterHrDirectory {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  currencies() {
    return this.database.client.masterCurrency.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
    });
  }

  async assertCurrency(code: string) {
    const found = await this.database.client.masterCurrency.findFirst({
      where: { code, isActive: true },
      select: { id: true },
    });
    if (!found)
      throw new BadRequestException('ارز باید در اطلاعات پایه فعال باشد.');
  }
}
