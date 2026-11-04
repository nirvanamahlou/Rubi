/** Native operations may only use the connection bound to the selected registry ID. */
export function matchesNativeSite(
  status: { registrySystemId?: string } | null,
  expectedSystemId?: string,
) {
  return !expectedSystemId || status?.registrySystemId === expectedSystemId;
}
