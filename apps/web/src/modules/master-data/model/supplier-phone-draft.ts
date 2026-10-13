/** An empty masked supplier phone is not an edit until the user touches it. */
export function supplierEditValues(
  values: Record<string, string>,
  phoneTouched: boolean,
): Record<string, string> {
  if (phoneTouched) return values;
  const draft = { ...values };
  delete draft.primaryPhone;
  return draft;
}
