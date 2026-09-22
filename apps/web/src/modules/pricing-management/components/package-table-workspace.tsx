'use client';

import {
  Eye,
  FileSpreadsheet,
  Layers3,
  LockKeyhole,
  Palette,
  Plane,
  Type,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import { PackagePricingApiError } from '../api/client';
import {
  buildPackageBannerViewModel,
  packageBannerFailureMessages,
} from '../model/package-banner';
import { packageBannerDocumentsAdapter } from '../model/package-banner-output';
import { loadPackageBanner } from './package-banner-workspace';

const packageDesigns = [
  { id: 'jahan', title: 'جدولی · جهان باستان' },
  { id: 'rooms', title: 'آنتالیا · با نوع اتاق' },
  { id: 'niayesh', title: 'جدولی · نیایش سیر' },
] as const;

function faDate(value: string) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function money(amount: string, currencyCode: string) {
  const numeric = Number(amount);
  return `${Number.isFinite(numeric) ? numeric.toLocaleString('fa-IR') : amount} ${currencyCode}`;
}

function EditorSection({
  children,
  icon: Icon,
  number,
  subtitle,
  title,
  open = false,
}: {
  children: React.ReactNode;
  icon: typeof FileSpreadsheet;
  number: string;
  subtitle: string;
  title: string;
  open?: boolean;
}) {
  return (
    <details
      className="group rounded-2xl border border-border bg-background"
      open={open}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-xs font-black text-primary">
          {number}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-sm">{title}</strong>
          <small className="text-xs text-muted-foreground">{subtitle}</small>
        </span>
        <Icon className="size-4 text-muted-foreground" />
      </summary>
      <div className="grid gap-4 border-t border-border p-4">{children}</div>
    </details>
  );
}

export function PackageTableWorkspace({ packageId }: { packageId: string }) {
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof loadPackageBanner>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [design, setDesign] =
    useState<(typeof packageDesigns)[number]['id']>('jahan');
  const [title, setTitle] = useState('');
  const [services, setServices] = useState(
    'پرواز رفت و برگشت، اقامت هتل و بیمه مسافرتی',
  );
  const [notes, setNotes] = useState('');
  const [fontSize, setFontSize] = useState(14);
  const [tableColor, setTableColor] = useState('#173f7a');
  const [alignment, setAlignment] = useState<'right' | 'center'>('right');
  const [showLayers, setShowLayers] = useState(false);
  const [showBrand, setShowBrand] = useState(true);
  const output = packageBannerDocumentsAdapter.availability();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadPackageBanner(packageId, {});
      setResult(loaded);
      setTitle(loaded.tour.package.name);
    } catch (cause) {
      setResult(null);
      setError(cause);
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => void load(), 0);
    return () => globalThis.clearTimeout(timer);
  }, [load]);

  const validation = useMemo(
    () =>
      result?.batch && result.publication
        ? buildPackageBannerViewModel({
            tour: result.tour,
            batch: result.batch,
            publication: result.publication,
          })
        : null,
    [result],
  );

  if (loading)
    return (
      <div className="grid gap-4 lg:grid-cols-[21rem_minmax(0,1fr)]">
        <Skeleton className="h-[42rem]" />
        <Skeleton className="h-[42rem]" />
      </div>
    );

  if (error)
    return (
      <ErrorState
        action={<Button onClick={() => void load()}>تلاش دوباره</Button>}
        description={
          error instanceof Error
            ? error.message
            : 'دریافت اطلاعات پکیج ناموفق بود.'
        }
        title={
          error instanceof PackagePricingApiError && error.status === 403
            ? 'دسترسی تولید پکیج مجاز نیست'
            : 'پکیج در دسترس نیست'
        }
      />
    );

  if (!result?.batch || !result.publication)
    return (
      <EmptyState
        description="برای تولید طرح جدولی، نرخ اتاق و نسخه قیمت منتشرشده لازم است."
        icon={FileSpreadsheet}
        title="پکیج قیمت قابل‌عرضه ندارد"
      />
    );

  if (!validation?.value)
    return (
      <Card className="grid gap-3 border-destructive/30 p-5">
        <h2 className="font-black text-destructive">تولید پکیج متوقف شد</h2>
        <ul className="grid gap-2 text-sm">
          {(validation?.failures ?? []).map((failure) => (
            <li className="rounded-xl bg-destructive/5 p-3" key={failure}>
              {packageBannerFailureMessages[failure]}
            </li>
          ))}
        </ul>
      </Card>
    );

  const model = validation.value;
  const accent =
    design === 'niayesh'
      ? '#9f1239'
      : design === 'rooms'
        ? '#0f766e'
        : tableColor;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[21rem_minmax(0,1fr)]">
      <Card className="overflow-hidden p-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <div className="border-b border-border bg-muted/35 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black">ویرایشگر پکیج</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                داده‌ها از نسخه منتشرشده Rubi خوانده می‌شوند.
              </p>
            </div>
            <Badge>RTL</Badge>
          </div>
          <nav
            aria-label="دسترسی سریع ویرایشگر پکیج"
            className="mt-4 grid grid-cols-5 gap-1 rounded-xl bg-background/80 p-1"
          >
            {['فایل', 'سفر', 'قیمت‌ها', 'متن', 'نمایش'].map((item) => (
              <span
                className="rounded-lg px-1 py-2 text-center text-[10px] font-bold text-muted-foreground"
                key={item}
              >
                {item}
              </span>
            ))}
          </nav>
        </div>

        <div className="grid gap-3 p-4">
          <EditorSection
            icon={FileSpreadsheet}
            number="۰۱"
            open
            subtitle="قالب و داده منتشرشده"
            title="قالب و فایل منبع"
          >
            <label className="grid gap-2 text-sm font-bold">
              طرح پکیج
              <select
                className="h-11 rounded-xl border border-input bg-surface px-3"
                onChange={(event) =>
                  setDesign(event.target.value as typeof design)
                }
                value={design}
              >
                {packageDesigns.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-center">
              <strong className="text-sm">منبع متصل به Rubi</strong>
              <p className="mt-1 text-xs text-muted-foreground">
                نسخه قیمت {model.priceVersion.toLocaleString('fa-IR')} · بدون
                ورود فایل دستی
              </p>
            </div>
          </EditorSection>

          <EditorSection
            icon={Plane}
            number="۰۲"
            open
            subtitle="عنوان، تاریخ و مدت"
            title="مشخصات سفر"
          >
            <label className="grid gap-2 text-sm font-bold">
              عنوان نمایشی
              <Input
                maxLength={85}
                onChange={(event) => setTitle(event.target.value)}
                value={title}
              />
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="rounded-xl bg-muted p-3">
                {faDate(model.startsOn)}
              </span>
              <span className="rounded-xl bg-muted p-3">
                {faDate(model.endsOn)}
              </span>
            </div>
          </EditorSection>

          <EditorSection
            icon={Layers3}
            number="۰۳"
            subtitle={`${model.rooms.length.toLocaleString('fa-IR')} اتاق قابل‌عرضه`}
            title="کادرهای قیمت"
          >
            <p className="text-xs leading-6 text-muted-foreground">
              قیمت‌ها فقط از نسخه فروش منتشرشده خوانده می‌شوند و در این پنل قابل
              تغییر نیستند.
            </p>
            <div className="flex flex-wrap gap-2">
              {model.displayPrices.map((price) => (
                <Badge key={price.currencyCode}>
                  {money(price.amount, price.currencyCode)}
                </Badge>
              ))}
            </div>
          </EditorSection>

          <EditorSection
            icon={Type}
            number="۰۴"
            subtitle="خدمات و یادداشت‌های طرح"
            title="متن و توضیحات"
          >
            <label className="grid gap-2 text-sm font-bold">
              متن خدمات
              <textarea
                className="min-h-24 rounded-xl border border-input bg-surface p-3 text-sm"
                onChange={(event) => setServices(event.target.value)}
                value={services}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              یادداشت تکمیلی
              <textarea
                className="min-h-20 rounded-xl border border-input bg-surface p-3 text-sm"
                onChange={(event) => setNotes(event.target.value)}
                value={notes}
              />
            </label>
          </EditorSection>

          <EditorSection
            icon={Eye}
            number="۰۵"
            subtitle="اندازه، رنگ و محدوده‌ها"
            title="تنظیمات نمایش"
          >
            <label className="grid gap-2 text-sm font-bold">
              اندازه متن جدول
              <input
                max={18}
                min={11}
                onChange={(event) => setFontSize(Number(event.target.value))}
                type="range"
                value={fontSize}
              />
            </label>
            <label className="flex items-center justify-between text-sm font-bold">
              رنگ جدول
              <input
                onChange={(event) => setTableColor(event.target.value)}
                type="color"
                value={tableColor}
              />
            </label>
            <label className="flex items-center justify-between text-sm font-bold">
              نمایش محدوده لایه‌ها
              <input
                checked={showLayers}
                className="size-4 accent-primary"
                onChange={(event) => setShowLayers(event.target.checked)}
                type="checkbox"
              />
            </label>
          </EditorSection>

          <EditorSection
            icon={Palette}
            number="۰۶"
            subtitle="چینش متن‌های طرح"
            title="ویرایش دقیق متن"
          >
            <label className="grid gap-2 text-sm font-bold">
              چینش جدول
              <select
                className="h-11 rounded-xl border border-input bg-surface px-3"
                onChange={(event) =>
                  setAlignment(event.target.value as typeof alignment)
                }
                value={alignment}
              >
                <option value="right">راست‌چین</option>
                <option value="center">وسط‌چین</option>
              </select>
            </label>
          </EditorSection>

          <EditorSection
            icon={LockKeyhole}
            number="۰۷"
            subtitle="نمایش هویت بصری"
            title="لوگوها"
          >
            <label className="flex items-center justify-between text-sm font-bold">
              نمایش نشان Rubi
              <input
                checked={showBrand}
                className="size-4 accent-primary"
                onChange={(event) => setShowBrand(event.target.checked)}
                type="checkbox"
              />
            </label>
          </EditorSection>
        </div>
      </Card>

      <section className="min-w-0">
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <h2 className="font-black">پیش‌نمایش طرح نهایی</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              اطلاعات واقعی پکیج و قیمت‌های فروش قابل‌عرضه
            </p>
          </div>
          <div className="flex gap-2">
            <Button disabled size="sm" variant="outline">
              PNG
            </Button>
            <Button disabled size="sm">
              PDF
            </Button>
          </div>
        </Card>
        <Alert
          className="mb-4"
          description={output.reason}
          title={output.label}
        />
        <Card className="overflow-auto bg-[#e8eef5] p-4 sm:p-7">
          <article
            aria-label="پیش‌نمایش پکیج جدولی"
            className={cn(
              'relative mx-auto min-h-[700px] min-w-[720px] max-w-[980px] overflow-hidden bg-white p-9 shadow-xl',
              showLayers && 'ring-2 ring-dashed ring-primary',
            )}
            dir="rtl"
          >
            <div
              aria-hidden="true"
              className="absolute inset-y-0 start-0 w-36 bg-gradient-to-b from-sky-400 via-cyan-600 to-blue-950"
            />
            <div className="relative me-32">
              <header className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-sm font-bold" style={{ color: accent }}>
                    {model.route}
                  </p>
                  <h3
                    className="mt-2 text-5xl font-black"
                    style={{ color: accent }}
                  >
                    {title || model.packageName}
                  </h3>
                  <p className="mt-3 font-bold text-muted-foreground">
                    {faDate(model.startsOn)} تا {faDate(model.endsOn)}
                  </p>
                </div>
                {showBrand ? (
                  <div
                    className="grid size-24 place-items-center rounded-full border-4 text-center text-sm font-black"
                    style={{ borderColor: accent, color: accent }}
                  >
                    RUBI
                  </div>
                ) : null}
              </header>

              <div
                className="mt-8 overflow-hidden rounded-2xl border"
                style={{ borderColor: accent }}
              >
                <table
                  className="w-full border-collapse"
                  style={{ color: tableColor, fontSize, textAlign: alignment }}
                >
                  <thead style={{ backgroundColor: accent, color: 'white' }}>
                    <tr>
                      <th className="p-3">هتل</th>
                      <th className="p-3">نوع اتاق</th>
                      <th className="p-3">قیمت قابل عرضه</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.rooms.map((room, index) => (
                      <tr
                        className={index % 2 ? 'bg-slate-50' : 'bg-white'}
                        key={`${room.hotelName}-${room.roomName}`}
                      >
                        <td className="border-t p-3 font-bold">
                          {room.hotelName}
                        </td>
                        <td className="border-t p-3">{room.roomName}</td>
                        <td className="border-t p-3 font-black">
                          {room.prices
                            .map((price) =>
                              money(price.amount, price.currencyCode),
                            )
                            .join(' + ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <footer className="mt-6 grid gap-2 rounded-2xl bg-slate-100 p-4 text-sm">
                <strong>{services}</strong>
                {notes ? (
                  <span className="text-muted-foreground">{notes}</span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {model.flight}
                  {model.returnFlight ? ` · برگشت ${model.returnFlight}` : ''}
                </span>
              </footer>
            </div>
          </article>
        </Card>
      </section>
    </div>
  );
}
