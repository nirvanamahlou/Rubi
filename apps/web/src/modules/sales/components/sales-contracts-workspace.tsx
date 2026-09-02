'use client';

import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronLeft,
  CircleAlert,
  CircleCheckBig,
  Clock3,
  FileCheck2,
  FilePenLine,
  Hotel,
  MapPin,
  MoreHorizontal,
  Plane,
  Plus,
  Search,
  Sparkles,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui/form-controls';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { Badge, Card, EmptyState } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import {
  contractSteps,
  filterContracts,
  salesContractPreviews,
  type ContractStage,
  type SalesContractPreview,
} from '../model/contracts';

const stageStyles: Record<ContractStage, string> = {
  'نیازمند اقدام':
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200',
  'در حال تکمیل':
    'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-200',
  'آماده اجرا':
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200',
  بسته‌شده:
    'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-400/25 dark:bg-slate-400/10 dark:text-slate-200',
};

const filters: readonly ('همه' | ContractStage)[] = [
  'همه',
  'نیازمند اقدام',
  'در حال تکمیل',
  'آماده اجرا',
  'بسته‌شده',
];

function MetricCard({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof BriefcaseBusiness;
  label: string;
  tone: string;
  value: string;
}) {
  return (
    <Card className="flex min-w-0 items-center gap-3 p-4 shadow-[0_8px_28px_rgb(30_64_175/0.06)]">
      <span
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-2xl',
          tone,
        )}
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0">
        <strong className="block text-xl font-black leading-none">
          {value}
        </strong>
        <span className="mt-1.5 block truncate text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </span>
    </Card>
  );
}

function ProgressTrack({ contract }: { contract: SalesContractPreview }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-bold text-foreground">
          مرحله {contract.currentStep.toLocaleString('fa-IR')} از{' '}
          {contractSteps.length.toLocaleString('fa-IR')} ·{' '}
          {contractSteps[contract.currentStep - 1]}
        </span>
        <span className="font-black text-primary">
          {contract.progress.toLocaleString('fa-IR')}٪
        </span>
      </div>
      <div
        aria-label={`پیشرفت قرارداد ${contract.progress.toLocaleString('fa-IR')} درصد`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={contract.progress}
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <span
          className="block h-full rounded-full bg-gradient-to-l from-primary to-cyan-400 transition-[width]"
          style={{ width: `${contract.progress}%` }}
        />
      </div>
      <div className="mt-3 hidden grid-cols-5 gap-1.5 lg:grid">
        {contractSteps.map((step, index) => {
          const done =
            index + 1 < contract.currentStep || contract.progress === 100;
          const current =
            index + 1 === contract.currentStep && contract.progress < 100;
          return (
            <div className="flex min-w-0 items-center gap-1.5" key={step}>
              <span
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-black',
                  done
                    ? 'border-primary bg-primary text-primary-foreground'
                    : current
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-surface text-muted-foreground',
                )}
              >
                {done ? (
                  <Check aria-hidden="true" className="size-3" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  'truncate text-[10px] font-bold',
                  current || done ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContractCard({
  contract,
  onOpen,
}: {
  contract: SalesContractPreview;
  onOpen: (contract: SalesContractPreview) => void;
}) {
  return (
    <article className="group overflow-hidden rounded-[22px] border border-border bg-surface shadow-[0_12px_36px_rgb(30_64_175/0.07)] transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_18px_44px_rgb(30_64_175/0.11)]">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn('border', stageStyles[contract.stage])}>
                {contract.stage === 'نیازمند اقدام' ? (
                  <CircleAlert aria-hidden="true" className="me-1 size-3.5" />
                ) : contract.stage === 'آماده اجرا' ? (
                  <CircleCheckBig
                    aria-hidden="true"
                    className="me-1 size-3.5"
                  />
                ) : null}
                {contract.stage}
              </Badge>
              <span
                className="text-xs font-bold text-muted-foreground"
                dir="ltr"
              >
                {contract.id}
              </span>
            </div>
            <h2 className="mt-2 text-lg font-black tracking-tight sm:text-xl">
              {contract.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {contract.customer}
            </p>
          </div>
          <button
            aria-label={`گزینه‌های ${contract.title}`}
            className="absolute end-4 rounded-xl p-2 text-muted-foreground hover:bg-muted sm:static"
            type="button"
          >
            <MoreHorizontal aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <span className="flex items-center gap-2 rounded-xl bg-muted/55 px-3 py-2 text-xs font-semibold">
            <MapPin aria-hidden="true" className="size-4 text-primary" />
            {contract.destination}
          </span>
          <span className="flex items-center gap-2 rounded-xl bg-muted/55 px-3 py-2 text-xs font-semibold">
            <CalendarDays aria-hidden="true" className="size-4 text-primary" />
            {contract.travelDate}
          </span>
          <span className="flex items-center gap-2 rounded-xl bg-muted/55 px-3 py-2 text-xs font-semibold">
            <UsersRound aria-hidden="true" className="size-4 text-primary" />
            {contract.passengers.toLocaleString('fa-IR')} مسافر
          </span>
          <span className="flex items-center gap-2 rounded-xl bg-muted/55 px-3 py-2 text-xs font-semibold">
            <BriefcaseBusiness
              aria-hidden="true"
              className="size-4 text-primary"
            />
            {contract.allocatedServices.toLocaleString('fa-IR')} از{' '}
            {contract.services.toLocaleString('fa-IR')} خدمت
          </span>
        </div>

        <div className="mt-5 rounded-2xl border border-border/80 bg-background/55 p-4">
          <ProgressTrack contract={contract} />
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-primary/15 bg-primary/[0.035] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">
              <Sparkles aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-muted-foreground">
                اقدام بعدی پیشنهادی
              </p>
              <p className="mt-0.5 text-sm font-black">{contract.nextAction}</p>
              {contract.urgency ? (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                  <Clock3 aria-hidden="true" className="size-3.5" />
                  {contract.urgency}
                </p>
              ) : null}
            </div>
          </div>
          <Button
            className="shrink-0"
            onClick={() => onOpen(contract)}
            size="sm"
            variant={contract.stage === 'آماده اجرا' ? 'primary' : 'outline'}
          >
            {contract.stage === 'آماده اجرا'
              ? 'انتشار برای اجرا'
              : 'ادامه قرارداد'}
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/25 px-4 py-3 text-[11px] text-muted-foreground sm:px-5">
        <span>
          کارشناس: <strong className="text-foreground">{contract.owner}</strong>{' '}
          · {contract.updatedAt}
        </span>
        <span className="flex items-center gap-1.5 font-bold text-foreground">
          <WalletCards aria-hidden="true" className="size-3.5 text-primary" />
          {contract.amount}
        </span>
      </footer>
    </article>
  );
}

function WizardStepContent({ step }: { step: number }) {
  if (step === 1)
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="contract-title" label="عنوان قرارداد" required>
          <Input id="contract-title" placeholder="مثلاً تور خانوادگی کیش" />
        </FormField>
        <FormField id="contract-customer" label="مشتری اصلی" required>
          <Select defaultValue="sample-customer">
            <SelectTrigger id="contract-customer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sample-customer">مشتری نمونه جدید</SelectItem>
              <SelectItem value="sample-company">شرکت نمونه سازمانی</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="contract-payer" label="پرداخت‌کننده">
          <Select defaultValue="customer">
            <SelectTrigger id="contract-payer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="customer">همان مشتری اصلی</SelectItem>
              <SelectItem value="other">شخص یا سازمان دیگر</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="contract-channel" label="کانال فروش">
          <Select defaultValue="office">
            <SelectTrigger id="contract-channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="office">فروش حضوری</SelectItem>
              <SelectItem value="phone">تلفنی</SelectItem>
              <SelectItem value="agency">آژانس همکار</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>
    );

  if (step === 2)
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black">مسافران قرارداد</h3>
            <p className="text-xs text-muted-foreground">
              مسافران را از پرونده مشتری انتخاب کنید.
            </p>
          </div>
          <Button size="sm" type="button" variant="outline">
            <Plus aria-hidden="true" className="size-4" />
            افزودن مسافر
          </Button>
        </div>
        {['مشتری نمونه (بزرگسال)', 'همراه نمونه (بزرگسال)'].map(
          (name, index) => (
            <div
              className="flex items-center justify-between rounded-2xl border border-border p-3"
              key={name}
            >
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-secondary font-black text-secondary-foreground">
                  {(index + 1).toLocaleString('fa-IR')}
                </span>
                <span>
                  <strong className="block text-sm">{name}</strong>
                  <span className="text-xs text-muted-foreground">
                    مدارک پایه کامل
                  </span>
                </span>
              </span>
              <Button
                aria-label={`حذف ${name}`}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            </div>
          ),
        )}
      </div>
    );

  if (step === 3)
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          {
            icon: Plane,
            title: 'پرواز رفت‌وبرگشت',
            detail: 'هر ۲ مسافر تخصیص یافتند',
          },
          {
            icon: Hotel,
            title: 'هتل و اتاق',
            detail: 'نوع اتاق هنوز انتخاب نشده',
          },
          {
            icon: WalletCards,
            title: 'بیمه مسافرتی',
            detail: 'طرح پایه · ۲ مسافر',
          },
          {
            icon: BriefcaseBusiness,
            title: 'خدمت جانبی',
            detail: 'ترانسفر فرودگاهی',
          },
        ].map(({ detail, icon: Icon, title }, index) => (
          <button
            className={cn(
              'flex items-start gap-3 rounded-2xl border p-4 text-start transition hover:border-primary/40',
              index === 1
                ? 'border-amber-300 bg-amber-50/60 dark:bg-amber-400/5'
                : 'border-border bg-surface',
            )}
            key={title}
            type="button"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <span>
              <strong className="block text-sm">{title}</strong>
              <span className="mt-1 block text-xs text-muted-foreground">
                {detail}
              </span>
            </span>
          </button>
        ))}
      </div>
    );

  if (step === 4)
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="contract-currency" label="ارز قرارداد" required>
          <Select defaultValue="irr">
            <SelectTrigger id="contract-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="irr">تومان</SelectItem>
              <SelectItem value="eur">یورو</SelectItem>
              <SelectItem value="usd">دلار</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="contract-price" label="مبلغ نهایی فروش" required>
          <Input id="contract-price" inputMode="numeric" placeholder="۰" />
        </FormField>
        <FormField id="contract-validity" label="اعتبار پیشنهاد">
          <Input id="contract-validity" placeholder="مثلاً تا ۲۴ ساعت آینده" />
        </FormField>
        <FormField id="contract-payment" label="شرایط پرداخت">
          <Select defaultValue="deposit">
            <SelectTrigger id="contract-payment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deposit">۳۰٪ پیش‌پرداخت + مانده</SelectItem>
              <SelectItem value="cash">تسویه کامل</SelectItem>
              <SelectItem value="installment">اقساط سازمانی</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <div className="sm:col-span-2">
          <FormField id="contract-terms" label="شرایط کنسلی و توضیحات">
            <Textarea
              id="contract-terms"
              placeholder="شرایط قابل ارائه به مشتری..."
            />
          </FormField>
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
            <FileCheck2 aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h3 className="font-black text-emerald-900 dark:text-emerald-100">
              آماده بازبینی نهایی
            </h3>
            <p className="mt-1 text-xs leading-6 text-emerald-800 dark:text-emerald-200">
              طرفین، مسافران، خدمات و شرایط مالی در یک Snapshot پیش‌نمایش جمع
              شده‌اند. ثبت نهایی در این ماکاپ داده‌ای ذخیره نمی‌کند.
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ['طرفین قرارداد', 'مشتری اصلی + پرداخت‌کننده'],
          ['مسافران', '۲ بزرگسال'],
          ['خدمات تخصیص‌یافته', '۴ خدمت · یک مورد نیازمند تکمیل'],
          ['وضعیت مالی', 'شرایط پرداخت آماده تأیید'],
        ].map(([label, value]) => (
          <div className="rounded-2xl border border-border p-4" key={label}>
            <span className="text-xs font-bold text-muted-foreground">
              {label}
            </span>
            <strong className="mt-1 block text-sm">{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewContractDialog({
  onClose,
  onComplete,
  open,
}: {
  onClose: () => void;
  onComplete: () => void;
  open: boolean;
}) {
  const [step, setStep] = useState(1);
  const close = () => {
    setStep(1);
    onClose();
  };

  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && close()} open={open}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0">
        <div className="border-b border-border bg-gradient-to-l from-primary/10 via-surface to-cyan-400/10 p-5 sm:p-6">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Plus aria-hidden="true" className="size-5" />
            </span>
            قرارداد جدید
          </DialogTitle>
          <DialogDescription>
            اطلاعات را مرحله‌به‌مرحله تکمیل کنید؛ هر بخش بعداً قابل ویرایش است.
          </DialogDescription>
        </div>
        <div className="p-5 sm:p-6">
          <ol
            aria-label="مراحل قرارداد جدید"
            className="mb-6 grid grid-cols-5 gap-1"
          >
            {contractSteps.map((label, index) => {
              const number = index + 1;
              const active = number === step;
              const done = number < step;
              return (
                <li className="min-w-0 text-center" key={label}>
                  <button
                    aria-current={active ? 'step' : undefined}
                    className="group w-full"
                    onClick={() => setStep(number)}
                    type="button"
                  >
                    <span className="flex items-center">
                      <span
                        className={cn(
                          'h-0.5 grow',
                          index === 0
                            ? 'bg-transparent'
                            : done || active
                              ? 'bg-primary'
                              : 'bg-border',
                        )}
                      />
                      <span
                        className={cn(
                          'grid size-8 shrink-0 place-items-center rounded-full border text-xs font-black',
                          done
                            ? 'border-primary bg-primary text-primary-foreground'
                            : active
                              ? 'border-primary bg-surface text-primary ring-4 ring-primary/10'
                              : 'border-border bg-surface text-muted-foreground',
                        )}
                      >
                        {done ? (
                          <Check aria-hidden="true" className="size-4" />
                        ) : (
                          number.toLocaleString('fa-IR')
                        )}
                      </span>
                      <span
                        className={cn(
                          'h-0.5 grow',
                          index === contractSteps.length - 1
                            ? 'bg-transparent'
                            : done
                              ? 'bg-primary'
                              : 'bg-border',
                        )}
                      />
                    </span>
                    <span
                      className={cn(
                        'mt-2 hidden truncate text-[10px] font-bold sm:block',
                        active ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mb-5">
            <p className="text-xs font-bold text-primary">
              مرحله {step.toLocaleString('fa-IR')} از ۵
            </p>
            <h2 className="mt-1 text-lg font-black">
              {contractSteps[step - 1]}
            </h2>
          </div>
          <WizardStepContent step={step} />
          <div className="mt-7 flex items-center justify-between border-t border-border pt-4">
            <Button
              disabled={step === 1}
              onClick={() => setStep((value) => Math.max(1, value - 1))}
              type="button"
              variant="ghost"
            >
              <ArrowRight aria-hidden="true" className="size-4" />
              مرحله قبل
            </Button>
            {step < contractSteps.length ? (
              <Button
                onClick={() => setStep((value) => Math.min(5, value + 1))}
                type="button"
              >
                ذخیره و ادامه
                <ArrowLeft aria-hidden="true" className="size-4" />
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setStep(1);
                  onComplete();
                }}
                type="button"
              >
                <FileCheck2 aria-hidden="true" className="size-4" />
                ثبت پیش‌نویس قرارداد
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContractDetailsDialog({
  contract,
  onClose,
}: {
  contract: SalesContractPreview | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      onOpenChange={(open) => !open && onClose()}
      open={Boolean(contract)}
    >
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        {contract ? (
          <>
            <DialogTitle>{contract.title}</DialogTitle>
            <DialogDescription>
              {contract.id} · آخرین تغییر {contract.updatedAt}
            </DialogDescription>
            <div className="mt-5 rounded-2xl border border-border bg-muted/35 p-4">
              <ProgressTrack contract={contract} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Card className="p-4">
                <p className="text-xs font-bold text-muted-foreground">
                  تخصیص خدمات
                </p>
                <p className="mt-1 text-2xl font-black">
                  {contract.allocatedServices.toLocaleString('fa-IR')} /{' '}
                  {contract.services.toLocaleString('fa-IR')}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {contract.serviceLabels.map((service, index) => (
                    <Badge
                      className={
                        index < contract.allocatedServices
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-200'
                      }
                      key={service}
                    >
                      {index < contract.allocatedServices ? (
                        <Check aria-hidden="true" className="me-1 size-3" />
                      ) : (
                        <Clock3 aria-hidden="true" className="me-1 size-3" />
                      )}
                      {service}
                    </Badge>
                  ))}
                </div>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-bold text-muted-foreground">
                  وضعیت مالی
                </p>
                <p className="mt-2 text-sm font-black">
                  {contract.paymentStatus}
                </p>
                <p className="mt-2 text-lg font-black text-primary">
                  {contract.amount}
                </p>
              </Card>
            </div>
            <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs font-bold text-muted-foreground">
                اقدام بعدی
              </p>
              <p className="mt-1 font-black">{contract.nextAction}</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={onClose} variant="ghost">
                بستن
              </Button>
              <Button>
                <FilePenLine aria-hidden="true" className="size-4" />
                ادامه تکمیل
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function SalesContractsWorkspace() {
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<'همه' | ContractStage>('همه');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedContract, setSelectedContract] =
    useState<SalesContractPreview | null>(null);
  const [createdNotice, setCreatedNotice] = useState(false);
  const contracts = useMemo(
    () => filterContracts(salesContractPreviews, query, stage),
    [query, stage],
  );

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-[26px] border border-primary/15 bg-surface p-5 shadow-[0_18px_50px_rgb(30_64_175/0.08)] sm:p-7">
        <div className="pointer-events-none absolute -end-16 -top-24 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 start-1/3 size-44 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-black text-primary">
              <BriefcaseBusiness aria-hidden="true" className="size-4" />
              فروش و تخصیص خدمات
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              قراردادهای من
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
              وضعیت هر قرارداد، کارهای ناقص و اقدام بعدی را یکجا ببینید و
              قراردادها را بدون جا انداختن هیچ مرحله‌ای تکمیل کنید.
            </p>
          </div>
          <Button
            className="min-h-12 shrink-0 rounded-2xl px-5 shadow-lg shadow-primary/20"
            onClick={() => setWizardOpen(true)}
            size="lg"
          >
            <Plus aria-hidden="true" className="size-5" />
            قرارداد جدید
          </Button>
        </div>
      </header>

      {createdNotice ? (
        <div
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-400/20 dark:bg-emerald-400/5"
          role="status"
        >
          <span className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-200">
            <CircleCheckBig aria-hidden="true" className="size-5" />
            پیش‌نویس نمایشی ساخته شد؛ هیچ اطلاعاتی ذخیره یا ارسال نشده است.
          </span>
          <Button
            aria-label="بستن پیام"
            onClick={() => setCreatedNotice(false)}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : null}

      <section
        aria-label="خلاصه قراردادها"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <MetricCard
          icon={BriefcaseBusiness}
          label="قرارداد فعال"
          tone="bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-200"
          value="۱۲"
        />
        <MetricCard
          icon={CircleAlert}
          label="نیازمند اقدام امروز"
          tone="bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200"
          value="۳"
        />
        <MetricCard
          icon={FileCheck2}
          label="آماده انتشار برای اجرا"
          tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200"
          value="۲"
        />
        <MetricCard
          icon={WalletCards}
          label="ارزش قراردادهای باز"
          tone="bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-200"
          value="۴۸۲ م"
        />
      </section>

      <Card className="p-3 shadow-[0_8px_28px_rgb(30_64_175/0.05)] sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="absolute end-3 top-3.5 size-4 text-muted-foreground"
            />
            <Input
              aria-label="جست‌وجوی قرارداد"
              className="pe-10"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجو در نام مشتری، مقصد یا شماره قرارداد..."
              value={query}
            />
          </div>
          <div
            className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0"
            role="tablist"
          >
            {filters.map((filter) => (
              <button
                aria-selected={stage === filter}
                className={cn(
                  'min-h-10 shrink-0 rounded-xl border px-3 text-xs font-black outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
                  stage === filter
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                key={filter}
                onClick={() => setStage(filter)}
                role="tab"
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">آخرین قراردادها</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {contracts.length.toLocaleString('fa-IR')} قرارداد نمایشی
          </p>
        </div>
        <Button size="sm" variant="ghost">
          مشاهده همه
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Button>
      </div>

      {contracts.length ? (
        <section aria-label="فهرست قراردادهای من" className="grid gap-4">
          {contracts.map((contract) => (
            <ContractCard
              contract={contract}
              key={contract.id}
              onOpen={setSelectedContract}
            />
          ))}
        </section>
      ) : (
        <EmptyState
          action={
            <Button
              onClick={() => {
                setQuery('');
                setStage('همه');
              }}
              variant="outline"
            >
              پاک‌کردن فیلترها
            </Button>
          }
          description="عبارت جست‌وجو یا وضعیت دیگری را امتحان کنید."
          title="قراردادی با این مشخصات پیدا نشد"
        />
      )}

      <NewContractDialog
        onClose={() => setWizardOpen(false)}
        onComplete={() => {
          setWizardOpen(false);
          setCreatedNotice(true);
        }}
        open={wizardOpen}
      />
      <ContractDetailsDialog
        contract={selectedContract}
        onClose={() => setSelectedContract(null)}
      />
    </div>
  );
}
