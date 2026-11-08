import type { WorkbenchLeaveInputV1 } from '@nora/contracts';
export function leaveDescription(
  description: string,
  leave?: WorkbenchLeaveInputV1 | null,
  details = true,
) {
  if (!leave) return description;
  const marker = `\n\nمرخصی ${leave.mode}\nاز `;
  const start = description.indexOf(marker);
  const body = start < 0 ? description : description.slice(0, start);
  if (!details) return body;
  const date = (value: string) =>
    new Date(`${value}T00:00:00Z`).toLocaleDateString('fa-IR', {
      timeZone: 'UTC',
    });
  return `${body}\n\nمرخصی ${leave.mode}\nاز ${date(leave.from)} تا ${date(leave.to)}\n${leave.startTime ?? ''} ${leave.endTime ?? ''}\nدلیل: ${leave.reason}\nجانشین احتمالی: ${leave.substitute || '—'}`;
}
