import { BadRequestException } from '@nestjs/common';
import { bankInstitutionKinds } from '@nora/contracts';

export function validateBankInstitutionFields(data: Record<string, unknown>) {
  if (
    data.institutionKind != null &&
    !bankInstitutionKinds.some(({ value }) => value === data.institutionKind)
  )
    throw new BadRequestException('نوع بانک معتبر نیست.');
  const limits = {
    publicRelationsPhone: 80,
    website: 500,
    description: 2000,
    descriptionEn: 2000,
  };
  for (const [key, limit] of Object.entries(limits)) {
    const value = data[key];
    if (value == null) continue;
    if (typeof value !== 'string' || value.length > limit)
      throw new BadRequestException('اطلاعات تکمیلی بانک معتبر نیست.');
    data[key] = value.trim() || null;
  }
  validateBankWebsite(data);
}

function validateBankWebsite(data: Record<string, unknown>) {
  if (data.website && !/^https?:\/\/[^\s]+$/i.test(String(data.website)))
    throw new BadRequestException('نشانی وب‌سایت بانک معتبر نیست.');
}

export function validateBankBranchMetadata(data: Record<string, unknown>) {
  if (data.website != null) {
    if (typeof data.website !== 'string' || data.website.length > 500)
      throw new BadRequestException('نشانی وب‌سایت بانک معتبر نیست.');
    data.website = data.website.trim() || null;
    validateBankWebsite(data);
  }
  if (data.swiftCode != null) {
    const value = String(data.swiftCode).trim().toUpperCase();
    if (value && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(value))
      throw new BadRequestException('کد SWIFT باید ۸ یا ۱۱ نویسه بزرگ باشد.');
    data.swiftCode = value || null;
  }
}
