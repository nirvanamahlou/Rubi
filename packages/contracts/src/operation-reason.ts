/** A human operation reason is optional; actor, authorization and audit remain independent. */
export function isOptionalOperationReason(
  value: unknown,
  maxLength = Infinity,
): value is string | null | undefined {
  return (
    value == null ||
    (typeof value === 'string' && value.trim().length <= maxLength)
  );
}
