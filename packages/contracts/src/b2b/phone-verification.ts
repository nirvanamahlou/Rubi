export type B2bPhoneVerificationRole = 'AGENCY' | 'CORPORATE_CUSTOMER';

export interface B2bPhoneVerificationContextV1 {
  registrationId: string;
  branchId: string;
  role: B2bPhoneVerificationRole;
  organizationId?: string | null;
  phone: string;
}

export type CreateB2bPhoneChallengeRequestV1 = B2bPhoneVerificationContextV1;

export interface B2bPhoneChallengeV1 {
  challengeId: string;
  canonicalPhone: string;
  expiresAt: string;
  resendAfter: string;
  developmentCode?: string;
}

export interface VerifyB2bPhoneChallengeRequestV1 extends B2bPhoneVerificationContextV1 {
  code: string;
}

export interface B2bPhoneVerificationGrantV1 {
  grant: string;
  canonicalPhone: string;
  expiresAt: string;
}

export interface CreateVerifiedB2bContactRequestV1 extends B2bPhoneVerificationContextV1 {
  grant: string;
  organizationId: string;
  fullName: string;
  jobTitle?: string;
  email?: string;
  nationalId?: string;
}

export function normalizeIranianMobile(value: string): string | undefined {
  const latin = value
    .trim()
    .replace(/[\u06f0-\u06f9]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    )
    .replace(/[\u0660-\u0669]/g, (digit) =>
      String(digit.charCodeAt(0) - 0x0660),
    )
    .replace(/[\s()-]/g, '');
  const local = latin.startsWith('+98')
    ? `0${latin.slice(3)}`
    : latin.startsWith('0098')
      ? `0${latin.slice(4)}`
      : latin;
  return /^09\d{9}$/.test(local) ? `+98${local.slice(1)}` : undefined;
}

export const b2bPhoneVerificationEndpoints = {
  challenges: '/api/v1/b2b/cooperation/phone-verification/challenges',
  verify: (challengeId: string) =>
    `/api/v1/b2b/cooperation/phone-verification/challenges/${encodeURIComponent(challengeId)}/verify` as const,
  contacts: '/api/v1/b2b/cooperation/phone-verification/contacts',
} as const;
