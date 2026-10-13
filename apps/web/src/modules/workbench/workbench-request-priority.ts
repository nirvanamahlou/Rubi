const priorityLabels: Record<string, string> = {
  LOW: 'پایین',
  NORMAL: 'عادی',
  HIGH: 'بالا',
  URGENT: 'فوری',
};

export function workbenchRequestPriorityLabel(
  priority: string | null | undefined,
) {
  if (!priority) return 'تعیین نشده';
  return priorityLabels[priority.trim().toUpperCase()] ?? 'تعیین نشده';
}
