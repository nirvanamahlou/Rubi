'use client';

import {
  CalendarDays,
  Download,
  Image as ImageIcon,
  Plane,
  Search,
  Sparkles,
  Tags,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { Alert, Badge, Card, EmptyState, PageHeader } from '@/components/ui/surfaces';
import {
  type BannerTheme,
  downloadPriceBanner,
  formatPrice,
} from '../model/price-banner';
import {
  applyPreviewPrices,
  bannerItems,
  filterDailyPrices,
  priceChanged,
  pricingPreviewDate,
  pricingPreviewItems,
  validateDailyPrice,
  type DailyPriceItem,
  type PriceCurrency,
  type PriceProductType,
} from '../model/pricing-management';

const productLabels: Record<PriceProductType, string> = {
  TOUR: 'تور شرکت',
  OWN_TICKET: 'بلیت ملکی',
};
const themes: Record<BannerTheme, string> = {
  BLUE: 'از آبی سازمانی',
  TEAL: 'از فیروزه‌ای',
  RED: 'از نارنجی فروش',
};
const bannerBackgrounds: Record<BannerTheme, string> = {
  BLUE: 'from-[#123f8c] to-[#0872ce]',
  TEAL: 'from-[#075985] to-[#0f766e]',
  RED: 'from-[#7f1d1d] to-[#c2410c]',
};

export function PricingManagementWorkspace() {
  const [items, setItems] = useState<DailyPriceItem[]>(() =>
    pricingPreviewItems.map((item) => ({ ...item })),
  );
  const [date, setDate] = useState(pricingPreviewDate);
  const [type, setType] = useState<PriceProductType | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [bannerTitle, setBannerTitle] = useState('پیشنهادهای ویژه امروز');
  const [theme, setTheme] = useState<BannerTheme>('BLUE');
  const [exporting, setExporting] = useState(false);

  const filtered = useMemo(
    () => filterDailyPrices(items, search, type, date),
    [date, items, search, type],
  );
  const selectedForBanner = bannerItems(items);
  const changedCount = items.filter(priceChanged).length;
  const summaryCards: readonly [string, string, LucideIcon][] = [
    ['محصولات امروز', filtered.length.toLocaleString('fa-IR'), Tags],
    [
      'تورهای شرکت',
      filtered
        .filter((item) => item.productType === 'TOUR')
        .length.toLocaleString('fa-IR'),
      Sparkles,
    ],
    [
      'بلیت‌های ملکی',
      filtered
        .filter((item) => item.productType === 'OWN_TICKET')
        .length.toLocaleString('fa-IR'),
      Plane,
    ],
    [
      'تغییر ذخیره‌نشده',
      changedCount.toLocaleString('fa-IR'),
      CalendarDays,
    ],
  ];

  const patchItem = (id: string, patch: Partial<DailyPriceItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    setNotice('');
  };

  const apply = () => {
    const invalid = items.map(validateDailyPrice).find(Boolean);
    if (invalid) {
      setNotice(invalid);
      return;
    }
    if (!changedCount) {
      setNotice('قیمتی برای اعمال تغییر نکرده است.');
      return;
    }
    setItems(applyPreviewPrices(items));
    setNotice(
      `${changedCount.toLocaleString('fa-IR')} قیمت در پیش‌نمایش این نشست به‌روزرسانی شد؛ ذخیره سروری هنوز فعال نیست.`,
    );
  };

  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow="Rubi Sales"
        title="مدیریت قیمت"
        description="ویرایش روزانه قیمت تورهای شرکت و بلیت‌های ملکی، همراه با خروجی بنر"
      />
      <Alert
        tone="warning"
        title="نسخه Preview؛ قیمت عملیاتی ذخیره یا منتشر نمی‌شود"
        description="داده‌های این صفحه synthetic هستند. اعتبارسنجی مبلغ و خروجی PNG واقعی‌اند، اما ذخیره روزانه پس از قرارداد API، مجوز، Audit و Migration فعال می‌شود."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(([label, value, Icon]) => (
          <Card className="p-4" key={label}>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Icon className="size-5 text-primary" />
            </div>
            <p className="mt-3 text-2xl font-black">{value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[12rem_13rem_1fr_auto] md:items-end">
          <label className="text-xs font-bold">
            تاریخ قیمت
            <Input
              className="mt-2"
              onChange={(event) => setDate(event.target.value)}
              type="date"
              value={date}
            />
          </label>
          <label className="text-xs font-bold">
            نوع محصول
            <select
              className="mt-2 h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm"
              onChange={(event) =>
                setType(event.target.value as PriceProductType | 'ALL')
              }
              value={type}
            >
              <option value="ALL">همه محصولات ملکی</option>
              <option value="TOUR">تورهای شرکت</option>
              <option value="OWN_TICKET">بلیت‌های ملکی</option>
            </select>
          </label>
          <label className="text-xs font-bold">
            جست‌وجو
            <span className="relative mt-2 block">
              <Search className="absolute end-3 top-3 size-4 text-muted-foreground" />
              <Input
                className="pe-10"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="نام، مسیر یا کد محصول"
                value={search}
              />
            </span>
          </label>
          <Button disabled={!changedCount} onClick={apply}>
            اعمال تغییرات Preview
          </Button>
        </div>
        {notice ? <Alert className="mt-4" title={notice} /> : null}
      </Card>

      {filtered.length ? (
        <div className="space-y-3" aria-label="فهرست قیمت‌های روزانه">
          {filtered.map((item) => {
            const error = validateDailyPrice(item);
            return (
              <Card className="p-4" key={item.id}>
                <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr_0.8fr_1fr_8rem] xl:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{productLabels[item.productType]}</Badge>
                      {priceChanged(item) ? <Badge>تغییرکرده</Badge> : null}
                    </div>
                    <h2 className="mt-2 font-black">{item.productName}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.routeLabel} · {item.serviceCode}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">قیمت فعلی</p>
                    <p className="mt-1 font-bold" dir="ltr">
                      {formatPrice(item.currentPrice, item.currencyCode)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.capacityLabel}
                    </p>
                  </div>
                  <label className="text-xs font-bold">
                    ارز
                    <select
                      className="mt-2 h-11 w-full rounded-xl border border-input bg-surface px-3"
                      onChange={(event) =>
                        patchItem(item.id, {
                          currencyCode: event.target.value as PriceCurrency,
                        })
                      }
                      value={item.currencyCode}
                    >
                      {(['IRR', 'USD', 'EUR', 'AED', 'TRY'] as const).map(
                        (currency) => (
                          <option key={currency} value={currency}>
                            {currency}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="text-xs font-bold">
                    قیمت جدید
                    <Input
                      aria-invalid={Boolean(error)}
                      className="mt-2"
                      dir="ltr"
                      inputMode="decimal"
                      onChange={(event) =>
                        patchItem(item.id, { draftPrice: event.target.value })
                      }
                      value={item.draftPrice}
                    />
                    {error ? (
                      <span className="mt-1 block text-destructive">{error}</span>
                    ) : null}
                  </label>
                  <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm">
                    <input
                      checked={item.featured}
                      onChange={(event) =>
                        patchItem(item.id, { featured: event.target.checked })
                      }
                      type="checkbox"
                    />
                    نمایش در بنر
                  </label>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="قیمتی برای این روز پیدا نشد"
          description="تاریخ، نوع محصول یا عبارت جست‌وجو را تغییر دهید."
        />
      )}

      <Card className="overflow-hidden">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-4 p-5">
            <div>
              <h2 className="font-black">خروجی بنر قیمت</h2>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                حداکثر شش ردیف انتخاب‌شده در فایل PNG مربع ۱۲۰۰ پیکسل قرار می‌گیرند.
              </p>
            </div>
            <label className="block text-xs font-bold">
              عنوان بنر
              <Input
                className="mt-2"
                maxLength={60}
                onChange={(event) => setBannerTitle(event.target.value)}
                value={bannerTitle}
              />
            </label>
            <label className="block text-xs font-bold">
              رنگ بنر
              <select
                className="mt-2 h-11 w-full rounded-xl border border-input bg-surface px-3"
                onChange={(event) => setTheme(event.target.value as BannerTheme)}
                value={theme}
              >
                {Object.entries(themes).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              disabled={!selectedForBanner.length || exporting}
              onClick={() => {
                setExporting(true);
                void downloadPriceBanner({
                  title: bannerTitle,
                  date,
                  theme,
                  items: selectedForBanner,
                })
                  .then(() => setNotice('فایل PNG بنر با موفقیت ساخته شد.'))
                  .catch((reason: unknown) =>
                    setNotice(
                      reason instanceof Error
                        ? reason.message
                        : 'ساخت بنر ناموفق بود.',
                    ),
                  )
                  .finally(() => setExporting(false));
              }}
            >
              <Download className="size-4" />
              {exporting ? 'در حال ساخت…' : 'دریافت بنر PNG'}
            </Button>
          </section>
          <section
            aria-label="پیش‌نمایش بنر قیمت"
            className={`bg-gradient-to-br ${bannerBackgrounds[theme]} p-6 text-white`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xl font-black">{bannerTitle}</p>
                <p className="mt-1 text-xs text-white/70">{date}</p>
              </div>
              <ImageIcon className="size-8 text-white/80" />
            </div>
            <div className="mt-5 space-y-2">
              {selectedForBanner.length ? (
                selectedForBanner.map((item) => (
                  <div
                    className="rounded-xl bg-white/10 p-3 backdrop-blur"
                    key={item.id}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-bold">{item.productName}</span>
                      <span className="shrink-0 font-black" dir="ltr">
                        {formatPrice(item.draftPrice, item.currencyCode)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white/70">
                      {item.routeLabel}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-xl bg-white/10 p-5 text-sm">
                  از فهرست قیمت‌ها، گزینه «نمایش در بنر» را انتخاب کنید.
                </p>
              )}
            </div>
            <p className="mt-6 text-sm font-bold">شرکت نیایش سیر سحر</p>
          </section>
        </div>
      </Card>
    </main>
  );
}
