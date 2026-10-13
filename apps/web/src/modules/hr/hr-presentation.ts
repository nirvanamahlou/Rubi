export type HrStatusTone = 'neutral' | 'success' | 'warning' | 'danger';

export function hrStatusTone(status: string): HrStatusTone {
  const label = status.replace(/[\s\u200c]/g, '');
  if (/ردشده|لغوشده|غیرفعال|تعلیق|منقضی|پایانیافته/.test(label))
    return 'danger';
  if (label === 'تکمیلشده') return 'success';
  if (/انتظار|بررسی|تکمیل|رسیدگی|نیازمند|نشده/.test(label)) return 'warning';
  if (/تأیید|تایید|فعال|پرداختشده|حاضر|امضا/.test(label)) return 'success';
  return 'neutral';
}
