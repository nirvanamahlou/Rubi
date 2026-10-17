import type { MasterDataRecord } from '@nora/contracts';
import { masterDataApi } from '../api/client';
import { readOrganizationWorkbookRows } from '@/modules/organizations/model/organization-xlsx';

export const partnerImportHeaders = [
  'نام حقوقی',
  'کشور / شهر',
  'تلفن',
  'شماره همراه',
  'ایمیل',
] as const;
export const partnerIdentityKey = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/آ/g, 'ا')
    .replace(/[\s/،,]+/gu, '')
    .replaceAll('\u200c', '')
    .replaceAll('\u200d', '');
export interface PartnerImportRow {
  rowNumber: number;
  name: string;
  location: string;
  phone: string;
  mobile: string;
  email: string;
  cityId?: string;
  countryId?: string;
  error?: string;
  result?: 'created' | 'skipped' | 'failed';
}
export function validatePartnerRows(
  rows: readonly (readonly string[])[],
  cities: readonly MasterDataRecord[],
): PartnerImportRow[] {
  const [headers, ...data] = rows;
  if (
    !headers ||
    headers.length !== 5 ||
    headers.some(
      (h, i) =>
        partnerIdentityKey(h) !== partnerIdentityKey(partnerImportHeaders[i]!),
    )
  )
    throw new Error('ستون‌های فایل با قالب تأمین‌کننده/کارگزار یکسان نیست.');
  const populated = data
    .map((values, index) => ({ values, rowNumber: index + 2 }))
    .filter((r) => r.values.some(Boolean));
  if (!populated.length || populated.length > 200)
    throw new Error('فایل باید بین ۱ تا ۲۰۰ ردیف اطلاعات داشته باشد.');
  const seen = new Set<string>();
  return populated.map(({ values: cells, rowNumber }) => {
    const [name = '', location = '', phone = '', mobile = '', email = ''] =
      cells.map((v) => v.normalize('NFKC').replace(/\s+/g, ' ').trim());
    const result: PartnerImportRow = {
      rowNumber,
      name,
      location,
      phone,
      mobile,
      email,
    };
    const matches = cities.filter(
      (city) =>
        partnerIdentityKey(
          `${city.attributes.countryName ?? ''}/${city.name}`,
        ) === partnerIdentityKey(location),
    );
    if (!name || name.length > 160)
      result.error = 'نام حقوقی الزامی و حداکثر ۱۶۰ نویسه است.';
    else if (
      cells.length > 5 ||
      cells.some(
        (v) =>
          /^[=@-]/.test(v.trim()) ||
          Array.from(v).some((char) => {
            const code = char.charCodeAt(0);
            return code < 32 && ![9, 10, 13].includes(code);
          }),
      )
    )
      result.error = 'مقدار سلول ناامن یا پشتیبانی‌نشده است.';
    else if (matches.length !== 1)
      result.error =
        'کشور / شهر باید با یک شهر فعال در اطلاعات پایه تطبیق داشته باشد.';
    else if (
      [phone, mobile].some((v) => v && !/^\+?[0-9۰-۹٠-٩ ().-]{5,30}$/.test(v))
    )
      result.error = 'شماره تلفن یا همراه معتبر نیست.';
    else if (
      email &&
      (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    )
      result.error = 'نشانی ایمیل معتبر نیست.';
    else if (/^\+/.test(name) || /^\+/.test(location) || /^\+/.test(email))
      result.error = 'مقدار سلول ناامن یا پشتیبانی‌نشده است.';
    else {
      result.cityId = matches[0]!.id;
      result.countryId = String(matches[0]!.attributes.countryId ?? '');
      if (!result.countryId)
        result.error = 'مرجع کشور شهر انتخاب‌شده موجود نیست.';
      const key = `${partnerIdentityKey(name)}:${result.cityId}`;
      if (seen.has(key)) result.error = 'این نام و شهر در فایل تکرار شده است.';
      seen.add(key);
    }
    return result;
  });
}
export async function previewPartnerWorkbook(file: File) {
  const cities: MasterDataRecord[] = [];
  for (let page = 1; ; page++) {
    const response = await masterDataApi.list('cities', {
      page,
      pageSize: 100,
      status: 'active',
      search: '',
      sortBy: 'name',
      sortDirection: 'asc',
    });
    cities.push(...response.data);
    if (page * 100 >= response.meta.total) break;
    if (page > 1000)
      throw new Error('تعداد شهرها بیشتر از حد مجاز این ورود گروهی است.');
  }
  return validatePartnerRows(await readOrganizationWorkbookRows(file), cities);
}
export async function importPartners(
  resource: 'suppliers' | 'brokers',
  rows: readonly PartnerImportRow[],
  progress: (rows: PartnerImportRow[]) => void,
) {
  const result = rows.map((row) => ({ ...row }));
  for (const row of result) {
    if (row.error) continue;
    try {
      const response = await masterDataApi.create(resource, {
        values: {
          name: row.name,
          countryId: row.countryId!,
          cityId: row.cityId!,
          ...(resource === 'brokers' ? { cityIds: row.cityId! } : {}),
          primaryPhone: row.phone,
          dossierVersion: '1',
          dossierImport: 'true',
          dossierMobile: row.mobile,
          dossierEmail: row.email,
        },
      });
      row.result =
        response.data.attributes.dossierImportSkipped === true
          ? 'skipped'
          : 'created';
    } catch (error) {
      row.result = 'failed';
      row.error =
        error instanceof Error
          ? error.message
          : 'ورود اطلاعات طرف همکاری ناموفق بود.';
      progress([...result]);
      break; // Unknown write outcome: stop; server duplicate guard makes a fresh preview safe.
    }
    progress([...result]);
  }
  return result;
}
