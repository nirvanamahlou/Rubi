import type { MasterDataRecord } from '@nora/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';

export const organizationHeaders = [
  'نام حقوقی آژانس',
  'مدیرعامل',
  'شماره مجوز',
  'تلفن',
  'ایمیل',
  'شماره همراه',
  'نشانی کامل آژانس',
] as const;
export const organizationExtendedHeaders = [
  'نام حقوقی آژانس',
  'شماره ثبت',
  'شناسه ملی',
  'کد اقتصادی',
  'شماره مجوز گردشگری',
  'نام مدیرعامل',
  'کد ملی مدیرعامل',
  'شماره موبایل مدیرعامل',
  'استان',
  'شهر',
  'نشانی کامل آژانس',
] as const;
export const organizationImportLimit = 200;
export interface OrganizationImportRow {
  code: string;
  legalName: string;
  personType: string;
  nationalId: string;
  registrationNumber?: string;
  economicCode?: string;
  tourismLicenseNumber?: string;
  chiefExecutiveName?: string;
  chiefExecutiveNationalId?: string;
  chiefExecutiveMobile?: string;
  officePhone?: string;
  email?: string;
  province?: string;
  city?: string;
  addressLine?: string;
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
    const digits = (value: string) =>
      value
        .normalize('NFKC')
        .replace(/[۰-۹٠-٩]/g, (digit) =>
          String(digit.charCodeAt(0) - (digit >= '۰' ? 0x06f0 : 0x0660)),
        );
    const compactIdentifier = (value: string) =>
      digits(value).replace(/\s/g, '');
    const text = (value: string) =>
      value.normalize('NFKC').replace(/\s+/g, ' ').trim();
    const row = {
      code: compactIdentifier(source.code ?? '').toUpperCase(),
      legalName: text(source.legalName ?? ''),
      personType: (source.personType || 'LEGAL').trim().toUpperCase(),
      nationalId: compactIdentifier(source.nationalId ?? ''),
      registrationNumber: compactIdentifier(source.registrationNumber ?? ''),
      economicCode: compactIdentifier(source.economicCode ?? ''),
      tourismLicenseNumber: compactIdentifier(
        source.tourismLicenseNumber ?? '',
      ),
      chiefExecutiveName: text(source.chiefExecutiveName ?? ''),
      chiefExecutiveNationalId: compactIdentifier(
        source.chiefExecutiveNationalId ?? '',
      ),
      chiefExecutiveMobile: compactIdentifier(
        source.chiefExecutiveMobile ?? '',
      ).replaceAll('-', ''),
      officePhone: digits(source.officePhone ?? '').replace(/[\s().-]/g, ''),
      email: text(source.email ?? '').toLowerCase(),
      province: text(source.province ?? ''),
      city: text(source.city ?? ''),
      addressLine: text(source.addressLine ?? ''),
      roleCodes: [
        ...new Set(
          (source.roleCodes || 'AGENCY')
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
      row.nationalId &&
      (row.personType !== 'LEGAL' || !/^\d{11}$/.test(row.nationalId))
    )
      issue = 'شناسه ملی باید ۱۱ رقم و فقط برای شخصیت حقوقی باشد.';
    else if (
      row.chiefExecutiveNationalId &&
      !/^\d{10}$/.test(row.chiefExecutiveNationalId)
    )
      issue = 'کد ملی مدیرعامل باید ۱۰ رقم باشد.';
    else if (
      row.chiefExecutiveMobile &&
      !/^(?:\+98|0098|0)?9\d{9}$/.test(row.chiefExecutiveMobile)
    )
      issue = 'شماره موبایل مدیرعامل معتبر نیست.';
    else if (row.officePhone && !/^\+?\d{7,20}$/.test(row.officePhone))
      issue = 'شماره تلفن معتبر نیست.';
    else if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
      issue = 'ایمیل معتبر نیست.';
    else if (Boolean(row.province) !== Boolean(row.city))
      issue = 'استان و شهر باید با هم تکمیل شوند.';
    else if (
      row.addressLine &&
      (row.addressLine.length < 5 || row.addressLine.length > 500)
    )
      issue = 'نشانی کامل آژانس باید بین ۵ تا ۵۰۰ نویسه باشد.';
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
        const city =
          row.city && row.province
            ? await resolveOrganizationImportCity(row)
            : undefined;
        const created = await masterDataApi.create('organizations', {
          values: {
            legalName: row.legalName,
            personType: row.personType,
            nationalId: row.nationalId || null,
            registrationNumber: row.registrationNumber || null,
            economicCode: row.economicCode || null,
            tourismLicenseNumber: row.tourismLicenseNumber || null,
            roleCodes: row.roleCodes,
          },
        });
        const primaryPhone = row.chiefExecutiveMobile || row.officePhone;
        if (primaryPhone || row.email)
          await masterDataApi.create('organization-contacts', {
            values: {
              organizationId: created.data.id,
              fullName: row.chiefExecutiveName || 'دفتر آژانس',
              jobTitle: row.chiefExecutiveName ? 'مدیرعامل' : 'دفتر آژانس',
              nationalId: row.chiefExecutiveNationalId ?? '',
              phone: primaryPhone ?? '',
              email: row.email ?? '',
              preferredChannel: primaryPhone ? 'PHONE' : 'EMAIL',
              hasWhatsapp: row.chiefExecutiveMobile ? 'true' : 'false',
              isPrimary: 'true',
            },
          });
        if (
          row.officePhone &&
          row.chiefExecutiveMobile &&
          row.officePhone !== row.chiefExecutiveMobile
        )
          await masterDataApi.create('organization-contacts', {
            values: {
              organizationId: created.data.id,
              fullName: 'دفتر آژانس',
              jobTitle: 'تلفن ثابت',
              phone: row.officePhone,
              preferredChannel: 'PHONE',
              hasWhatsapp: 'false',
              isPrimary: 'false',
            },
          });
        if (row.addressLine)
          await masterDataApi.createOrganizationAddress(created.data.id, {
            ...(city ? { countryId: city.countryId, cityId: city.id } : {}),
            addressLine: row.addressLine,
            label: 'نشانی دفتر مرکزی',
            isPrimary: true,
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

function comparableText(value: unknown) {
  return String(value ?? '')
    .normalize('NFKC')
    .replaceAll('ي', 'ی')
    .replaceAll('ك', 'ک')
    .replace(/[\s‌_-]+/g, '')
    .toLowerCase();
}

async function resolveOrganizationImportCity(row: OrganizationImportRow) {
  const cityName = row.city ?? '';
  const provinceName = row.province ?? '';
  const response = await masterDataApi.list('cities', {
    search: cityName,
    status: 'active',
    page: 1,
    pageSize: 100,
    sortBy: 'name',
    sortDirection: 'asc',
  });
  const city = response.data.find((candidate) => {
    const nameMatches = [candidate.name, candidate.attributes.englishName].some(
      (value) => comparableText(value) === comparableText(cityName),
    );
    const provinceMatches = [
      candidate.attributes.regionName,
      candidate.attributes.regionEnglishName,
    ].some((value) => comparableText(value) === comparableText(provinceName));
    return nameMatches && provinceMatches;
  });
  if (!city) throw new Error('اطلاعات شهر و استان در اطلاعات پایه یافت نشد.');
  const countryId = String(city.attributes.countryId ?? '');
  if (!countryId) throw new Error('کشور مرجع شهر انتخاب‌شده یافت نشد.');
  return { id: city.id, countryId };
}

export const syntheticOrganizations: readonly OrganizationImportRow[] = [
  {
    code: '',
    legalName: 'آژانس آزمایشی افق سفر',
    personType: 'LEGAL',
    nationalId: '14000000001',
    registrationNumber: '10001',
    economicCode: '411111111111',
    tourismLicenseNumber: 'TRAVEL-10001',
    chiefExecutiveName: 'مدیر نمونه اول',
    chiefExecutiveNationalId: '0013547896',
    chiefExecutiveMobile: '09121234567',
    province: 'تهران',
    city: 'تهران',
    addressLine: 'تهران، خیابان نمونه، پلاک ۱',
    roleCodes: 'AGENCY',
  },
  {
    code: '',
    legalName: 'آژانس آزمایشی آبیراه',
    personType: 'LEGAL',
    nationalId: '14000000002',
    registrationNumber: '10002',
    economicCode: '422222222222',
    tourismLicenseNumber: 'TRAVEL-10002',
    chiefExecutiveName: 'مدیر نمونه دوم',
    chiefExecutiveNationalId: '0023547896',
    chiefExecutiveMobile: '09121234568',
    province: 'تهران',
    city: 'تهران',
    addressLine: 'تهران، خیابان نمونه، پلاک ۲',
    roleCodes: 'AGENCY',
  },
  {
    code: '',
    legalName: 'آژانس آزمایشی آسمان',
    personType: 'LEGAL',
    nationalId: '14000000003',
    registrationNumber: '10003',
    economicCode: '433333333333',
    tourismLicenseNumber: 'TRAVEL-10003',
    chiefExecutiveName: 'مدیر نمونه سوم',
    chiefExecutiveNationalId: '0033547896',
    chiefExecutiveMobile: '09121234569',
    province: 'تهران',
    city: 'تهران',
    addressLine: 'تهران، خیابان نمونه، پلاک ۳',
    roleCodes: 'AGENCY',
  },
  {
    code: '',
    legalName: 'آژانس آزمایشی نیلگون',
    personType: 'LEGAL',
    nationalId: '14000000004',
    registrationNumber: '10004',
    economicCode: '',
    tourismLicenseNumber: 'TRAVEL-10004',
    chiefExecutiveName: 'مدیر نمونه چهارم',
    chiefExecutiveNationalId: '0043547896',
    chiefExecutiveMobile: '09121234570',
    province: 'تهران',
    city: 'تهران',
    addressLine: 'تهران، خیابان نمونه، پلاک ۴',
    roleCodes: 'AGENCY',
  },
  {
    code: '',
    legalName: 'شرکت آزمایشی توسعه سفر',
    personType: 'LEGAL',
    nationalId: '14000000005',
    registrationNumber: '10005',
    economicCode: '',
    tourismLicenseNumber: 'TRAVEL-10005',
    chiefExecutiveName: 'مدیر نمونه پنجم',
    chiefExecutiveNationalId: '0053547896',
    chiefExecutiveMobile: '09121234571',
    province: 'تهران',
    city: 'تهران',
    addressLine: 'تهران، خیابان نمونه، پلاک ۵',
    roleCodes: 'CORPORATE_CUSTOMER',
  },
  {
    code: '',
    legalName: 'گروه آزمایشی سپهر',
    personType: 'LEGAL',
    nationalId: '14000000006',
    registrationNumber: '10006',
    economicCode: '',
    tourismLicenseNumber: 'TRAVEL-10006',
    chiefExecutiveName: 'مدیر نمونه ششم',
    chiefExecutiveNationalId: '0063547896',
    chiefExecutiveMobile: '09121234572',
    province: 'تهران',
    city: 'تهران',
    addressLine: 'تهران، خیابان نمونه، پلاک ۶',
    roleCodes: 'CORPORATE_CUSTOMER',
  },
  {
    code: '',
    legalName: 'مؤسسه آزمایشی پارس',
    personType: 'LEGAL',
    nationalId: '14000000007',
    registrationNumber: '10007',
    economicCode: '',
    tourismLicenseNumber: 'TRAVEL-10007',
    chiefExecutiveName: 'مدیر نمونه هفتم',
    chiefExecutiveNationalId: '0073547896',
    chiefExecutiveMobile: '09121234573',
    province: 'تهران',
    city: 'تهران',
    addressLine: 'تهران، خیابان نمونه، پلاک ۷',
    roleCodes: 'CORPORATE_CUSTOMER',
  },
  {
    code: '',
    legalName: 'سازمان آزمایشی چندنقشی',
    personType: 'LEGAL',
    nationalId: '14000000008',
    registrationNumber: '10008',
    economicCode: '',
    tourismLicenseNumber: 'TRAVEL-10008',
    chiefExecutiveName: 'مدیر نمونه هشتم',
    chiefExecutiveNationalId: '0083547896',
    chiefExecutiveMobile: '09121234574',
    province: 'تهران',
    city: 'تهران',
    addressLine: 'تهران، خیابان نمونه، پلاک ۸',
    roleCodes: 'AGENCY,CORPORATE_CUSTOMER',
  },
];
