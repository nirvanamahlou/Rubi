import type { MasterDataRecord } from '@rubi/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';

export const organizationHeaders = [
  'کد سیستمی',
  'نام ثبتی',
  'نوع شخصیت',
  'نقش‌ها',
] as const;
export const organizationImportLimit = 200;
export interface OrganizationImportRow {
  code: string;
  legalName: string;
  personType: string;
  roleCodes: string;
}
export interface OrganizationPreviewRow extends OrganizationImportRow {
  rowNumber: number;
  issue?: string;
  existing?: MasterDataRecord;
  result?: 'created' | 'skipped' | 'failed';
  message?: string;
}

export function validateOrganizationRows(
  rows: readonly OrganizationImportRow[],
): OrganizationPreviewRow[] {
  if (!rows.length || rows.length > organizationImportLimit)
    throw new Error('فایل باید بین ۱ تا ۲۰۰ سازمان داشته باشد.');
  const codes = new Set<string>();
  const names = new Set<string>();
  return rows.map((source, index) => {
    const row = {
      code: source.code.trim().toUpperCase(),
      legalName: source.legalName.trim(),
      personType: source.personType.trim().toUpperCase(),
      roleCodes: [
        ...new Set(
          source.roleCodes
            .split(',')
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean),
        ),
      ].join(','),
    };
    let issue: string | undefined;
    if (row.code && !/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(row.code))
      issue = 'کد باید ۲ تا ۳۲ نویسه انگلیسی، عدد، خط تیره یا زیرخط باشد.';
    else if (row.code && codes.has(row.code))
      issue = 'کد در همین فایل تکراری است.';
    else if (names.has(row.legalName.normalize('NFKC').toLowerCase()))
      issue = 'نام سازمان در همین فایل تکراری است.';
    else if (row.legalName.length < 2 || row.legalName.length > 160)
      issue = 'نام سازمان باید ۲ تا ۱۶۰ نویسه باشد.';
    else if (!['LEGAL', 'NATURAL'].includes(row.personType))
      issue = 'نوع شخصیت باید LEGAL یا NATURAL باشد.';
    else if (
      !row.roleCodes ||
      row.roleCodes
        .split(',')
        .some((role) => !['AGENCY', 'CORPORATE_CUSTOMER'].includes(role))
    )
      issue = 'نقش فقط AGENCY یا CORPORATE_CUSTOMER یا ترکیب آن‌هاست.';
    else if (
      Object.values(row).some(
        (value) =>
          /^[=+@-]/.test(value) ||
          [...value].some((character) => {
            const code = character.codePointAt(0)!;
            return code < 32 && ![9, 10, 13].includes(code);
          }),
      )
    )
      issue = 'فرمول یا نویسه کنترلی در سلول‌ها مجاز نیست.';
    codes.add(row.code);
    names.add(row.legalName.normalize('NFKC').toLowerCase());
    return { ...row, rowNumber: index + 2, ...(issue ? { issue } : {}) };
  });
}

export async function organizationByCode(
  code: string,
): Promise<MasterDataRecord | undefined> {
  // Search all roles: an existing supplier identity must never be duplicated.
  const response = await masterDataApi.list('organizations', {
    search: code,
    status: 'all',
    page: 1,
    pageSize: 100,
    sortBy: 'code',
    sortDirection: 'asc',
  });
  return response.data.find(
    (record) => record.code.toUpperCase() === code.toUpperCase(),
  );
}

export async function organizationByName(
  name: string,
): Promise<MasterDataRecord | undefined> {
  for (let page = 1; page <= 10; page++) {
    const response = await masterDataApi.list('organizations', {
      search: name,
      status: 'all',
      page,
      pageSize: 100,
      sortBy: 'name',
      sortDirection: 'asc',
    });
    const found = response.data.find(
      (record) =>
        record.name.normalize('NFKC').trim().toLowerCase() ===
        name.normalize('NFKC').trim().toLowerCase(),
    );
    if (found) return found;
    if (page * 100 >= response.meta.total) return undefined;
  }
  throw new Error(
    'نتایج جست‌وجو بیش از حد مجاز است؛ ابتدا سازمان را در فهرست بررسی کنید.',
  );
}
async function resolveImportIdentity(row: OrganizationImportRow) {
  if (row.code) {
    const existing = await organizationByCode(row.code);
    if (!existing)
      throw new Error(
        'کد سیستمی یافت نشد؛ برای سازمان جدید ستون کد را خالی بگذارید.',
      );
    if (existing.name.trim() !== row.legalName.trim())
      throw new Error('کد و نام سازمان با رکورد موجود مطابقت ندارند.');
    return existing;
  }
  return organizationByName(row.legalName);
}

export async function previewOrganizations(
  rows: readonly OrganizationImportRow[],
) {
  const checked = validateOrganizationRows(rows);
  if (checked.some((row) => row.issue)) return checked;
  const result: OrganizationPreviewRow[] = [];
  for (const row of checked) {
    try {
      const existing = await resolveImportIdentity(row);
      result.push({ ...row, ...(existing ? { existing } : {}) });
    } catch (caught) {
      result.push({
        ...row,
        issue:
          caught instanceof Error ? caught.message : 'بررسی هویت ناموفق بود.',
      });
    }
  }
  return result;
}

export async function importOrganizations(
  rows: readonly OrganizationPreviewRow[],
  onProgress: (rows: OrganizationPreviewRow[]) => void,
) {
  const checked = validateOrganizationRows(rows);
  if (checked.some((row) => row.issue))
    throw new Error('ابتدا خطاهای فایل را اصلاح کنید.');
  const results: OrganizationPreviewRow[] = [];
  for (const row of checked) {
    try {
      const existing = await resolveImportIdentity(row);
      if (existing)
        results.push({
          ...row,
          existing,
          result: 'skipped',
          message: 'رکورد موجود تغییر نکرد.',
        });
      else {
        const created = await masterDataApi.create('organizations', {
          values: {
            legalName: row.legalName,
            personType: row.personType,
            roleCodes: row.roleCodes,
          },
        });
        results.push({
          ...row,
          code: created.data.code,
          result: 'created',
          message: `ثبت شد — ${created.data.code}`,
        });
      }
    } catch (error) {
      results.push({
        ...row,
        result: 'failed',
        message: error instanceof Error ? error.message : 'ثبت ناموفق بود.',
      });
      onProgress([...results]);
      // Stop on an uncertain response; do not retry a possibly successful write.
      return results;
    }
    onProgress([...results]);
  }
  return results;
}

export const syntheticOrganizations: readonly OrganizationImportRow[] = [
  {
    code: '',
    legalName: 'آژانس آزمایشی افق سفر',
    personType: 'LEGAL',
    roleCodes: 'AGENCY',
  },
  {
    code: '',
    legalName: 'آژانس آزمایشی آبیراه',
    personType: 'LEGAL',
    roleCodes: 'AGENCY',
  },
  {
    code: '',
    legalName: 'آژانس آزمایشی آسمان',
    personType: 'LEGAL',
    roleCodes: 'AGENCY',
  },
  {
    code: '',
    legalName: 'آژانس آزمایشی نیلگون',
    personType: 'LEGAL',
    roleCodes: 'AGENCY',
  },
  {
    code: '',
    legalName: 'شرکت آزمایشی توسعه سفر',
    personType: 'LEGAL',
    roleCodes: 'CORPORATE_CUSTOMER',
  },
  {
    code: '',
    legalName: 'گروه آزمایشی سپهر',
    personType: 'LEGAL',
    roleCodes: 'CORPORATE_CUSTOMER',
  },
  {
    code: '',
    legalName: 'مؤسسه آزمایشی پارس',
    personType: 'LEGAL',
    roleCodes: 'CORPORATE_CUSTOMER',
  },
  {
    code: '',
    legalName: 'سازمان آزمایشی چندنقشی',
    personType: 'LEGAL',
    roleCodes: 'AGENCY,CORPORATE_CUSTOMER',
  },
];
