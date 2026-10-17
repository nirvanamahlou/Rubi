export type HrStatusTone = 'neutral' | 'success' | 'warning' | 'danger';

export function hrStatusText(status: unknown): string {
  if (typeof status === 'string') return status;
  if (typeof status === 'number' && Number.isFinite(status))
    return String(status);
  if (status && typeof status === 'object' && 'label' in status) {
    const label = status.label;
    if (typeof label === 'string') return label;
  }
  return 'نامشخص';
}

export function hrStatusTone(status: unknown): HrStatusTone {
  const label = hrStatusText(status).replace(/[\s\u200c]/g, '');
  if (/ردشده|لغوشده|غیرفعال|تعلیق|منقضی|پایانیافته/.test(label))
    return 'danger';
  if (label === 'تکمیلشده') return 'success';
  if (/انتظار|بررسی|تکمیل|رسیدگی|نیازمند|نشده/.test(label)) return 'warning';
  if (/تأیید|تایید|فعال|پرداختشده|حاضر|امضا/.test(label)) return 'success';
  return 'neutral';
}
