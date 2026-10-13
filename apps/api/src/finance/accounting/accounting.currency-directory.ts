import type { MasterDataService } from '../../master-data/master-data.service';
import * as v from './accounting.validation';

export type AccountingCurrencyReference = {
  id: string;
  version: number;
  code: string;
  name: string;
  englishName: string;
  decimalDigits: number;
};

/** Consume the producer's public projection; Finance never queries Master Data tables. */
export async function accountingCurrencies(
  master?: MasterDataService,
): Promise<AccountingCurrencyReference[]> {
  if (!master) v.rule('سرویس اطلاعات پایه ارز در دسترس نیست.');
  const records: AccountingCurrencyReference[] = [];
  for (let page = 1; page <= 20; page++) {
    const result = await master.list('currencies', {
      page,
      pageSize: 50,
      status: 'active',
      sortBy: 'code',
      sortDirection: 'asc',
      search: '',
    });
    records.push(
      ...result.data.map((row) => ({
        id: row.id,
        version: row.version,
        code: row.code,
        name: row.name,
        englishName:
          typeof row.attributes.englishName === 'string'
            ? row.attributes.englishName
            : '',
        decimalDigits: Number(row.attributes.decimalDigits),
      })),
    );
    if (page * 50 >= result.meta.total) return records;
  }
  v.rule('فهرست ارزها از محدوده پشتیبانی خارج است.');
}
