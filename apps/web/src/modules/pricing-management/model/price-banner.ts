import type { DailyPriceItem } from './pricing-management';

export type BannerTheme = 'BLUE' | 'TEAL' | 'RED';

const themes: Record<
  BannerTheme,
  { start: string; end: string; accent: string }
> = {
  BLUE: { start: '#123f8c', end: '#0872ce', accent: '#85d7ff' },
  TEAL: { start: '#075985', end: '#0f766e', accent: '#99f6e4' },
  RED: { start: '#7f1d1d', end: '#c2410c', accent: '#fed7aa' },
};

export function formatPrice(amount: string, currencyCode: string) {
  return `${new Intl.NumberFormat('fa-IR').format(Number(amount))} ${currencyCode}`;
}

export function priceBannerFileName(date: string) {
  return `niyayesh-price-banner-${date}.png`;
}

export async function downloadPriceBanner(input: {
  title: string;
  date: string;
  theme: BannerTheme;
  items: readonly DailyPriceItem[];
}) {
  if (!input.items.length)
    throw new Error('حداقل یک قیمت برای بنر انتخاب کنید.');
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1200;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('ساخت بنر در این مرورگر پشتیبانی نمی‌شود.');

  const palette = themes[input.theme];
  const gradient = context.createLinearGradient(0, 0, 1200, 1200);
  gradient.addColorStop(0, palette.start);
  gradient.addColorStop(1, palette.end);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1200, 1200);

  context.direction = 'rtl';
  context.textAlign = 'right';
  context.fillStyle = '#ffffff';
  context.font = '800 62px Vazirmatn, sans-serif';
  context.fillText(input.title.trim() || 'قیمت‌های امروز نیایش سیر', 1080, 120);
  context.fillStyle = palette.accent;
  context.font = '500 30px Vazirmatn, sans-serif';
  context.fillText(`به‌روزرسانی قیمت · ${input.date}`, 1080, 175);

  input.items.forEach((item, index) => {
    const y = 245 + index * 135;
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.beginPath();
    context.roundRect(90, y, 1020, 108, 22);
    context.fill();
    context.fillStyle = '#ffffff';
    context.font = '700 34px Vazirmatn, sans-serif';
    context.fillText(item.productName, 1065, y + 42);
    context.fillStyle = 'rgba(255,255,255,0.78)';
    context.font = '500 23px Vazirmatn, sans-serif';
    context.fillText(`${item.routeLabel} · ${item.serviceCode}`, 1065, y + 79);
    context.textAlign = 'left';
    context.fillStyle = palette.accent;
    context.font = '800 31px Vazirmatn, sans-serif';
    context.fillText(formatPrice(item.draftPrice, item.currencyCode), 135, y + 63);
    context.textAlign = 'right';
  });

  context.fillStyle = '#ffffff';
  context.font = '700 27px Vazirmatn, sans-serif';
  context.fillText('شرکت نیایش سیر سحر', 1080, 1100);
  context.fillStyle = 'rgba(255,255,255,0.7)';
  context.font = '500 21px Vazirmatn, sans-serif';
  context.fillText('قیمت‌ها تا زمان تکمیل ظرفیت قابل تغییر هستند.', 1080, 1142);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error('ساخت فایل بنر ناموفق بود.');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = priceBannerFileName(input.date);
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
