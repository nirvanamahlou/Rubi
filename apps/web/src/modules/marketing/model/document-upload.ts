import type { DocumentConfidentialityCode } from '@nora/contracts';

export function marketingDocumentCodeError(
  defaultConfidentiality: DocumentConfidentialityCode | undefined,
  code: string,
) {
  return defaultConfidentiality === 'CONFIDENTIAL' && !/^\d{6}$/u.test(code)
    ? 'کد محرمانگی ۶ رقمی الزامی است.'
    : '';
}

export function appendMarketingConfidentialCode(form: FormData, code: string) {
  if (code) form.set('confidentialAccessCode', code);
}
