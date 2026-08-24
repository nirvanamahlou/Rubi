'use client';

import {
  CheckCircle2,
  FileCheck2,
  Landmark,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';

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
  DialogDescription,
  DialogTitle,
  Drawer,
  DrawerClose,
  DrawerContent,
} from '@/components/ui/overlays';
import { Alert, Badge, Card } from '@/components/ui/surfaces';
import { FINANCE_PREVIEW_NOTICE, FINANCE_UI_VERSION } from '../api/contracts';
import {
  validateFinancePreviewDraft,
  type FinancePreviewDraft,
  type FinancePreviewRecord,
} from '../model/finance';

export type FinanceFormMode = 'create' | 'view' | 'edit';
export type FinanceFormKind =
  'JOURNAL' | 'RECEIPT' | 'PAYMENT' | 'CHECK' | 'INVOICE' | 'RELEASE';

const formLabels: Readonly<Record<FinanceFormKind, string>> = {
  JOURNAL: 'سند حسابداری',
  RECEIPT: 'دریافت',
  PAYMENT: 'پرداخت',
  CHECK: 'چک',
  INVOICE: 'فاکتور',
  RELEASE: 'Financial Release',
};

const previewDraft: FinancePreviewDraft = {
  title: 'عملیات مالی کاملاً نمایشی',
  partyReference: 'preview-party-001',
  contractReference: 'preview-contract-001',
  amount: '125000000',
  currencyCode: 'IRR',
  description: 'شرح و دلیل کاملاً ساختگی برای بررسی Foundation مالی',
  expectedVersion: '1',
  idempotencyKey: 'finance:journal:preview-001',
};

const emptyDraft: FinancePreviewDraft = {
  title: '',
  partyReference: '',
  contractReference: '',
  amount: '',
  currencyCode: 'IRR',
  description: '',
  expectedVersion: '1',
  idempotencyKey: 'finance:preview:',
};

export function FinancePreviewForm({
  kind,
  mode,
  onClose,
  record,
}: {
  kind: FinanceFormKind;
  mode: FinanceFormMode;
  onClose: () => void;
  record?: FinancePreviewRecord;
}) {
  const [draft, setDraft] = useState<FinancePreviewDraft>(() => {
    if (mode === 'create') return emptyDraft;
    return {
      ...previewDraft,
      title: record?.title ?? previewDraft.title,
      partyReference: record
        ? 'preview-party-from-record'
        : previewDraft.partyReference,
      contractReference:
        record?.contractReference ?? previewDraft.contractReference,
      amount: record?.amount ?? previewDraft.amount,
      currencyCode: record?.currencyCode ?? previewDraft.currencyCode,
    };
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof FinancePreviewDraft, string>>
  >({});
  const [validated, setValidated] = useState(false);
  const readOnly = mode === 'view';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateFinancePreviewDraft(draft);
    setErrors(result.errors);
    setValidated(result.valid);
  }

  return (
    <Drawer onOpenChange={(open) => !open && onClose()} open>
      <DrawerContent className="w-[min(96vw,48rem)] p-6">
        <DialogTitle>
          {mode === 'create'
            ? `ایجاد نمایشی ${formLabels[kind]}`
            : mode === 'edit'
              ? `ویرایش نمایشی ${formLabels[kind]}`
              : `مشاهده نمایشی ${formLabels[kind]}`}
        </DialogTitle>
        <DialogDescription>{FINANCE_PREVIEW_NOTICE}</DialogDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>{FINANCE_UI_VERSION}</Badge>
          <Badge className="bg-amber-500/10 text-amber-700">
            بدون Persistence
          </Badge>
          <Badge className="bg-sky-500/10 text-sky-700">
            expectedVersion + idempotency
          </Badge>
        </div>

        <form className="mt-6 space-y-5" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              {...(errors.title ? { error: errors.title } : {})}
              id="finance-form-title"
              label="عنوان عملیات"
              required
            >
              <Input
                disabled={readOnly}
                id="finance-form-title"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                readOnly={readOnly}
                value={draft.title}
              />
            </FormField>
            <FormField label="نوع عملیات">
              <Select defaultValue={kind} disabled>
                <SelectTrigger aria-label="نوع عملیات">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(formLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              {...(errors.partyReference
                ? { error: errors.partyReference }
                : {})}
              description="فقط Public Reference؛ PII کپی نمی‌شود."
              id="finance-party-reference"
              label="طرف‌حساب"
              required
            >
              <Input
                disabled={readOnly}
                dir="ltr"
                id="finance-party-reference"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    partyReference: event.target.value,
                  }))
                }
                placeholder="preview-party-..."
                readOnly={readOnly}
                value={draft.partyReference}
              />
            </FormField>
            <FormField
              {...(errors.contractReference
                ? { error: errors.contractReference }
                : {})}
              description="Reference پایدار قرارداد؛ بدون Query مستقیم Sales."
              id="finance-contract-reference"
              label="قرارداد/پرونده سفر"
            >
              <Input
                disabled={readOnly}
                dir="ltr"
                id="finance-contract-reference"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    contractReference: event.target.value,
                  }))
                }
                placeholder="preview-contract-..."
                readOnly={readOnly}
                value={draft.contractReference}
              />
            </FormField>
            <FormField
              {...(errors.amount ? { error: errors.amount } : {})}
              description="Decimal string؛ نمایش تومان فقط Presentation است."
              id="finance-amount"
              label="مبلغ رسمی"
              required
            >
              <div className="grid grid-cols-[1fr_6rem] gap-2">
                <Input
                  disabled={readOnly}
                  dir="ltr"
                  id="finance-amount"
                  inputMode="decimal"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  placeholder="125000000"
                  readOnly={readOnly}
                  value={draft.amount}
                />
                <Select
                  disabled={readOnly}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      currencyCode:
                        value as FinancePreviewDraft['currencyCode'],
                    }))
                  }
                  value={draft.currencyCode}
                >
                  <SelectTrigger aria-label="کد ارز">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['IRR', 'USD', 'EUR', 'TRY', 'AED'].map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FormField>
            <FormField
              {...(errors.expectedVersion
                ? { error: errors.expectedVersion }
                : {})}
              id="finance-expected-version"
              label="expectedVersion"
              required
            >
              <Input
                disabled={readOnly}
                dir="ltr"
                id="finance-expected-version"
                inputMode="numeric"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    expectedVersion: event.target.value,
                  }))
                }
                readOnly={readOnly}
                value={draft.expectedVersion}
              />
            </FormField>
          </div>

          {kind === 'JOURNAL' ? (
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <FileCheck2 className="size-5 text-primary" />
                <h3 className="font-bold">خطوط دوطرفه Preview</h3>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Alert
                  description={`بدهکار: ${draft.amount || '۰'} ${draft.currencyCode}`}
                  title="حساب صندوق نمونه"
                />
                <Alert
                  description={`بستانکار: ${draft.amount || '۰'} ${draft.currencyCode}`}
                  title="حساب دریافتنی نمونه"
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                توازن فقط در UI نمایش داده می‌شود؛ posting واقعی فعال نیست.
              </p>
            </Card>
          ) : null}

          {kind === 'RECEIPT' || kind === 'PAYMENT' ? (
            <div className="grid gap-4 rounded-2xl border border-border bg-muted/20 p-4 sm:grid-cols-2">
              <FormField label="روش">
                <Select defaultValue="MIXED" disabled={readOnly}>
                  <SelectTrigger aria-label="روش دریافت یا پرداخت">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">نقد</SelectItem>
                    <SelectItem value="CARD">کارت</SelectItem>
                    <SelectItem value="TRANSFER">حواله</SelectItem>
                    <SelectItem value="GATEWAY">درگاه</SelectItem>
                    <SelectItem value="CHECK">چک</SelectItem>
                    <SelectItem value="CREDIT">اعتبار</SelectItem>
                    <SelectItem value="MIXED">ترکیبی</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="حساب بانک/صندوق">
                <Input
                  defaultValue="preview-financial-account-001"
                  disabled={readOnly}
                  dir="ltr"
                  readOnly={readOnly}
                />
              </FormField>
            </div>
          ) : null}

          {kind === 'CHECK' ? (
            <div className="grid gap-4 rounded-2xl border border-border bg-muted/20 p-4 sm:grid-cols-2">
              <FormField label="جهت چک">
                <Select defaultValue="RECEIVABLE" disabled={readOnly}>
                  <SelectTrigger aria-label="جهت چک">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECEIVABLE">دریافتی</SelectItem>
                    <SelectItem value="PAYABLE">پرداختی</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="شناسه صیاد ساختگی">
                <Input
                  defaultValue="preview-sayad-0001"
                  disabled={readOnly}
                  dir="ltr"
                  readOnly={readOnly}
                />
              </FormField>
              <FormField label="تاریخ سررسید">
                <Input
                  defaultValue="2026-08-30"
                  disabled={readOnly}
                  readOnly={readOnly}
                  type="date"
                />
              </FormField>
              <FormField label="وضعیت">
                <Select defaultValue="RECEIVED" disabled={readOnly}>
                  <SelectTrigger aria-label="وضعیت چک">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECEIVED">دریافت‌شده</SelectItem>
                    <SelectItem value="DEPOSITED">واگذار به بانک</SelectItem>
                    <SelectItem value="DUE">سررسیدشده</SelectItem>
                    <SelectItem value="CLEARED">وصول‌شده</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          ) : null}

          {kind === 'RELEASE' ? (
            <div className="grid gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:grid-cols-2">
              <FormField label="وضعیت درخواستی">
                <Select defaultValue="CONDITIONAL" disabled={readOnly}>
                  <SelectTrigger aria-label="وضعیت آزادسازی مالی">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BLOCKED">مسدود</SelectItem>
                    <SelectItem value="CONDITIONAL">مشروط</SelectItem>
                    <SelectItem value="APPROVED">مجاز</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="مبنای ارزیابی">
                <Select defaultValue="VALID_CHECK" disabled={readOnly}>
                  <SelectTrigger aria-label="مبنای آزادسازی">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_SETTLEMENT">تسویه کامل</SelectItem>
                    <SelectItem value="APPROVED_CREDIT">اعتبار مصوب</SelectItem>
                    <SelectItem value="APPROVED_PAYMENT_PLAN">
                      برنامه پرداخت مصوب
                    </SelectItem>
                    <SelectItem value="VALID_CHECK">چک معتبر</SelectItem>
                    <SelectItem value="MANAGER_EXCEPTION">
                      استثنای مدیر
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="تاییدکننده دوم">
                <Input
                  defaultValue="preview-approver-002"
                  disabled={readOnly}
                  dir="ltr"
                  readOnly={readOnly}
                />
              </FormField>
              <FormField label="انقضای استثنا">
                <Input
                  defaultValue="2026-08-25T12:00"
                  disabled={readOnly}
                  readOnly={readOnly}
                  type="datetime-local"
                />
              </FormField>
            </div>
          ) : null}

          <FormField
            {...(errors.description ? { error: errors.description } : {})}
            description="Reason برای Audit اجباری است."
            id="finance-description"
            label="شرح و دلیل"
            required
          >
            <Textarea
              disabled={readOnly}
              id="finance-description"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              readOnly={readOnly}
              value={draft.description}
            />
          </FormField>
          <FormField
            {...(errors.idempotencyKey ? { error: errors.idempotencyKey } : {})}
            id="finance-idempotency-key"
            label="Idempotency Key"
            required
          >
            <Input
              disabled={readOnly}
              dir="ltr"
              id="finance-idempotency-key"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  idempotencyKey: event.target.value,
                }))
              }
              readOnly={readOnly}
              value={draft.idempotencyKey}
            />
          </FormField>

          {kind === 'PAYMENT' || kind === 'JOURNAL' || kind === 'RELEASE' ? (
            <Alert
              description="ثبت‌کننده و تاییدکننده باید متفاوت باشند؛ نتیجه و استثنا Audit می‌شود."
              title="Maker/Checker اجباری"
              tone="warning"
            />
          ) : null}
          {validated ? (
            <Alert
              description="Validation موفق بود؛ هیچ داده، workflow یا فایل خروجی ایجاد نشد."
              title="Preview آماده بررسی است"
            >
              <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="size-4" />
                کنترل Decimal، Reference، Version و Idempotency پاس شد.
              </div>
            </Alert>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <DrawerClose asChild>
              <Button type="button" variant="ghost">
                بستن
              </Button>
            </DrawerClose>
            {!readOnly ? (
              <Button type="submit">
                {kind === 'JOURNAL' ? (
                  <Landmark className="size-4" />
                ) : kind === 'RELEASE' ? (
                  <ShieldCheck className="size-4" />
                ) : kind === 'CHECK' ? (
                  <WalletCards className="size-4" />
                ) : (
                  <ReceiptText className="size-4" />
                )}
                بررسی بدون ذخیره
              </Button>
            ) : null}
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
