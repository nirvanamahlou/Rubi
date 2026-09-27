export function shouldShowWorkbenchRequestStatus(
  status: string | null | undefined,
  isLatest: boolean,
) {
  return status?.trim().toUpperCase() !== 'NEW' || isLatest;
}

const requestStatusLabels: Record<string, string> = {
  NEW: 'جدید',
  IN_PROGRESS: 'در حال پیگیری',
  DONE: 'تکمیل‌شده',
  CLOSED: 'بسته‌شده',
  REJECTED: 'ردشده',
};

export function workbenchRequestStatusLabel(status: string | null | undefined) {
  if (!status) return 'تعیین نشده';
  return requestStatusLabels[status.trim().toUpperCase()] ?? 'تعیین نشده';
}
