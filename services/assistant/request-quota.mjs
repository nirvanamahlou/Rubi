/** Operator-only immutable identity list. Never consume client names or headers. */
export function requestQuotaExemptions(env = process.env) {
  const value = env.ASSISTANT_RATE_LIMIT_EXEMPT_USER_IDS;
  if (value === undefined || value === '') return [];
  if (typeof value !== 'string')
    throw new Error('INVALID_ASSISTANT_RATE_EXEMPTIONS');
  return validateQuotaExemptions(value.split(',').map((id) => id.trim()));
}

export function validateQuotaExemptions(ids) {
  if (
    !Array.isArray(ids) ||
    ids.length > 16 ||
    ids.some(
      (id) =>
        typeof id !== 'string' ||
        !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id),
    )
  )
    throw new Error('INVALID_ASSISTANT_RATE_EXEMPTIONS');
  return [...new Set(ids.map((id) => id.toLowerCase()))];
}
