export function shouldShowWorkbenchRequestStatus(
  status: string | null | undefined,
  isLatest: boolean,
) {
  return status?.trim().toUpperCase() !== 'NEW' || isLatest;
}
