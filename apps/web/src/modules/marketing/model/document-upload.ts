export function marketingDocumentCodeError(code: string) {
  // Options contain the type default, not the effective branch policy.
  // Documents alone decides whether a code is required or forbidden.
  return code && !/^\d{6}$/u.test(code) ? 'کد محرمانگی باید ۶ رقمی باشد.' : '';
}

export function appendMarketingConfidentialCode(form: FormData, code: string) {
  if (code) form.set('confidentialAccessCode', code);
}
