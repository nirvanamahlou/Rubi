'use client';

import type {
  CustomerDetail,
  DocumentListItemV1,
  DocumentOptionsResponseV1,
} from '@rubi/contracts';
import {
  ExternalLink,
  FileCheck2,
  FileClock,
  FileUp,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Alert,
  Badge,
  Button,
  Card,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Textarea,
} from '@/components/ui';

import {
  customerDocumentsApi,
  CustomerDocumentsApiError,
} from '../api/customer-documents-client';

type Options = DocumentOptionsResponseV1['data'];
type LoadState = 'loading' | 'ready' | 'unauthorized' | 'forbidden' | 'error';

interface UploadValues {
  title: string;
  description: string;
  documentTypeId: string;
  categoryId: string;
  confidentiality: string;
  validUntil: string;
  versionNote: string;
}

const emptyUpload: UploadValues = {
  title: '',
  description: '',
  documentTypeId: '',
  categoryId: '',
  confidentiality: '',
  validUntil: '',
  versionNote: '',
};

const scanLabels: Record<string, string> = {
  CLEAN: 'پاک و قابل دریافت',
  PENDING_SCAN: 'در صف بررسی',
  QUARANTINED: 'در قرنطینه',
  AWAITING_ANTIVIRUS_ADAPTER: 'محافظت‌شده؛ در انتظار آنتی‌ویروس',
  SCAN_FAILED: 'بررسی ناموفق',
  INFECTED: 'فایل آلوده',
};

function loadFailure(error: unknown): LoadState {
  if (error instanceof CustomerDocumentsApiError && error.status === 401)
    return 'unauthorized';
  if (error instanceof CustomerDocumentsApiError && error.status === 403)
    return 'forbidden';
  return 'error';
}

function formatDate(value: string | null): string {
  if (!value) return 'بدون تاریخ انقضا';
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(
    new Date(value),
  );
}

function documentTone(record: DocumentListItemV1): string {
  if (record.currentVersion.scanStatus === 'INFECTED')
    return 'bg-destructive/10 text-destructive';
  if (record.currentVersion.scanStatus === 'CLEAN')
    return 'bg-emerald-100 text-emerald-800';
  return 'bg-amber-100 text-amber-800';
}

export function CustomerDocumentsPanel({
  customer,
}: {
  customer: CustomerDetail;
}) {
  const [records, setRecords] = useState<readonly DocumentListItemV1[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<LoadState>('loading');
  const [message, setMessage] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [options, setOptions] = useState<Options | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [values, setValues] = useState<UploadValues>(emptyUpload);

  const identityTypes = useMemo(
    () =>
      options?.documentTypes.filter(
        (documentType) => documentType.domain === 'CUSTOMER_IDENTITY',
      ) ?? [],
    [options],
  );
  const selectedType = identityTypes.find(
    (documentType) => documentType.id === values.documentTypeId,
  );
  const branchAllowed = Boolean(
    options?.branches.some((branch) => branch.id === customer.ownerBranchId),
  );

  const load = useCallback(async () => {
    setState('loading');
    setMessage('');
    try {
      const response = await customerDocumentsApi.listForCustomer({
        customerId: customer.id,
        branchId: customer.ownerBranchId,
      });
      setRecords(response.data);
      setTotal(response.meta.total);
      setState('ready');
    } catch (error) {
      setState(loadFailure(error));
      setMessage(
        error instanceof Error
          ? error.message
          : 'دریافت مدارک مشتری ناموفق بود.',
      );
    }
  }, [customer.id, customer.ownerBranchId]);

  useEffect(() => {
    let active = true;
    void customerDocumentsApi
      .listForCustomer({
        customerId: customer.id,
        branchId: customer.ownerBranchId,
      })
      .then((response) => {
        if (!active) return;
        setRecords(response.data);
        setTotal(response.meta.total);
        setState('ready');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState(loadFailure(error));
        setMessage(
          error instanceof Error
            ? error.message
            : 'دریافت مدارک مشتری ناموفق بود.',
        );
      });
    return () => {
      active = false;
    };
  }, [customer.id, customer.ownerBranchId]);

  async function prepareUpload() {
    setUploadOpen(true);
    setMessage('');
    if (options) return;
    setOptionsLoading(true);
    try {
      const response = await customerDocumentsApi.options();
      const customerTypes = response.data.documentTypes.filter(
        (documentType) => documentType.domain === 'CUSTOMER_IDENTITY',
      );
      const firstType =
        customerTypes.find(
          (documentType) => documentType.code === 'PASSPORT',
        ) ?? customerTypes[0];
      const firstCategory =
        response.data.categories.find(
          (category) => category.code === 'CUSTOMER_IDENTITY',
        ) ?? response.data.categories[0];
      setOptions(response.data);
      setValues((current) => ({
        ...current,
        documentTypeId: current.documentTypeId || firstType?.id || '',
        categoryId: current.categoryId || firstCategory?.id || '',
        confidentiality:
          current.confidentiality || firstType?.defaultConfidentiality || '',
      }));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'دریافت گزینه‌های بارگذاری ناموفق بود.',
      );
    } finally {
      setOptionsLoading(false);
    }
  }

  function update(name: keyof UploadValues, value: string) {
    setMessage('');
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setMessage('فایل مدرک را انتخاب کنید.');
    if (values.title.trim().length < 2)
      return setMessage('عنوان مدرک باید حداقل دو حرف باشد.');
    if (!selectedType) return setMessage('نوع مدرک معتبر را انتخاب کنید.');
    if (!values.categoryId) return setMessage('دسته‌بندی مدرک را انتخاب کنید.');
    if (!branchAllowed)
      return setMessage('شعبه مالک مشتری در دسترسی فعلی شما نیست.');
    if (selectedType.requiresExpiry && !values.validUntil)
      return setMessage('برای این نوع مدرک، تاریخ انقضا الزامی است.');
    if (file.size > selectedType.maxFileSizeBytes)
      return setMessage('حجم فایل از سقف مجاز این نوع مدرک بیشتر است.');
    if (!selectedType.allowedMimeTypes.includes(file.type))
      return setMessage('نوع فایل با سیاست این مدرک سازگار نیست.');

    setSubmitting(true);
    setMessage('');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('title', values.title.trim());
      form.set('documentTypeId', selectedType.id);
      form.set('categoryId', values.categoryId);
      form.set('branchId', customer.ownerBranchId);
      form.set('ownerUserId', options!.currentUserId);
      form.set('sourceModule', 'customers');
      form.set('sourceEntityType', 'Customer');
      form.set('sourceEntityId', customer.id);
      form.set('sourceDisplayLabel', `پرونده مشتری ${customer.id.slice(0, 8)}`);
      if (values.description.trim())
        form.set('description', values.description.trim());
      if (values.confidentiality)
        form.set('confidentiality', values.confidentiality);
      if (values.validUntil) form.set('validUntil', values.validUntil);
      if (values.versionNote.trim())
        form.set('versionNote', values.versionNote.trim());

      await customerDocumentsApi.upload(form);
      setUploadOpen(false);
      setFile(null);
      setValues((current) => ({
        ...emptyUpload,
        documentTypeId: current.documentTypeId,
        categoryId: current.categoryId,
        confidentiality: current.confidentiality,
      }));
      setMessage(
        'مدرک به پرونده مشتری افزوده شد. وضعیت بررسی امنیتی نمایش داده می‌شود.',
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'بارگذاری مدرک ناموفق بود.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
            <p className="font-bold">مدارک سفر و هویتی</p>
            {state === 'ready' ? (
              <Badge>{total.toLocaleString('fa-IR')} مدرک</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            فایل‌ها در آرشیو اسناد، با سطح محرمانگی، نسخه و تاریخچه دسترسی
            نگهداری می‌شوند.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            aria-label="تازه‌سازی مدارک مشتری"
            disabled={state === 'loading'}
            onClick={() => void load()}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCw className="size-4" />
            تازه‌سازی
          </Button>
          <Button onClick={() => void prepareUpload()} size="sm" type="button">
            <FileUp className="size-4" />
            افزودن مدرک
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/documents">
              <ExternalLink className="size-4" />
              آرشیو اسناد
            </Link>
          </Button>
        </div>
      </div>

      {message ? (
        <Alert
          description={message}
          title={message.includes('افزوده شد') ? 'عملیات موفق' : 'وضعیت مدارک'}
          tone={message.includes('افزوده شد') ? 'info' : 'warning'}
        />
      ) : null}

      {state === 'loading' ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : null}
      {state === 'unauthorized' ? (
        <Alert
          description="نشست شما معتبر نیست؛ دوباره وارد سامانه شوید."
          title="نیاز به ورود"
          tone="error"
        />
      ) : null}
      {state === 'forbidden' ? (
        <Alert
          description="مجوز مشاهده اسناد هویتی این شعبه برای حساب شما فعال نیست."
          title="دسترسی محدود"
          tone="warning"
        />
      ) : null}
      {state === 'error' ? (
        <Alert
          description={message || 'ارتباط با آرشیو اسناد برقرار نشد.'}
          title="خطا در دریافت مدارک"
          tone="error"
        />
      ) : null}
      {state === 'ready' && records.length === 0 ? (
        <EmptyState
          description="اولین فایل پاسپورت، ویزا یا مدرک هویتی را از همین پرونده بارگذاری کنید."
          icon={FileClock}
          title="هنوز مدرکی برای این مشتری ثبت نشده است"
        />
      ) : null}
      {state === 'ready' && records.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {records.map((record) => (
            <article
              className="rounded-2xl border bg-muted/10 p-4"
              key={record.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{record.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {record.type.name} · {record.archiveCode}
                  </p>
                </div>
                <FileCheck2
                  className="size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className={documentTone(record)}>
                  {scanLabels[record.currentVersion.scanStatus] ??
                    'وضعیت نامشخص'}
                </Badge>
                <Badge className="bg-muted text-muted-foreground">
                  نسخه{' '}
                  {record.currentVersion.versionNumber.toLocaleString('fa-IR')}
                </Badge>
                <Badge className="bg-muted text-muted-foreground">
                  اعتبار: {formatDate(record.validUntil)}
                </Badge>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <Alert
        description="خود فایل اکنون امن و نسخه‌دار نگهداری می‌شود. ثبت و جست‌وجوی شماره پاسپورت، کشور صادرکننده و سایر داده‌های ساخت‌یافته پس از تصویب سیاست نگهداری و کلیدگذاری DEC-OPEN-006 فعال خواهد شد."
        title="مرز حفاظت اطلاعات هویتی"
        tone="info"
      />

      <Dialog
        onOpenChange={(open) => !submitting && setUploadOpen(open)}
        open={uploadOpen}
      >
        <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto">
          <DialogTitle>افزودن مدرک به پرونده مشتری</DialogTitle>
          <DialogDescription>
            شعبه و شناسه پرونده از مشتری جاری گرفته می‌شود و قابل تغییر نیست.
          </DialogDescription>
          {optionsLoading ? <Skeleton className="h-64" /> : null}
          {!optionsLoading && !options ? (
            <Alert
              description={message || 'گزینه‌های بارگذاری در دسترس نیستند.'}
              title="امکان بارگذاری فراهم نیست"
              tone="error"
            />
          ) : null}
          {!optionsLoading && options ? (
            <form
              className="space-y-4"
              onSubmit={(event) => void submit(event)}
            >
              <FormField id="customer-document-file" label="فایل مدرک" required>
                <Input
                  accept={selectedType?.allowedMimeTypes.join(',')}
                  id="customer-document-file"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  required
                  type="file"
                />
              </FormField>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField id="customer-document-title" label="عنوان" required>
                  <Input
                    id="customer-document-title"
                    onChange={(event) => update('title', event.target.value)}
                    value={values.title}
                  />
                </FormField>
                <FormField
                  id="customer-document-type"
                  label="نوع مدرک"
                  required
                >
                  <Select
                    onValueChange={(value) => {
                      const nextType = identityTypes.find(
                        (type) => type.id === value,
                      );
                      setValues((current) => ({
                        ...current,
                        documentTypeId: value,
                        confidentiality:
                          nextType?.defaultConfidentiality ??
                          current.confidentiality,
                        validUntil: nextType?.requiresExpiry
                          ? current.validUntil
                          : '',
                      }));
                    }}
                    value={values.documentTypeId}
                  >
                    <SelectTrigger id="customer-document-type">
                      <SelectValue placeholder="انتخاب نوع مدرک" />
                    </SelectTrigger>
                    <SelectContent>
                      {identityTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField
                  id="customer-document-category"
                  label="دسته‌بندی"
                  required
                >
                  <Select
                    onValueChange={(value) => update('categoryId', value)}
                    value={values.categoryId}
                  >
                    <SelectTrigger id="customer-document-category">
                      <SelectValue placeholder="انتخاب دسته‌بندی" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField
                  id="customer-document-confidentiality"
                  label="محرمانگی"
                  required
                >
                  <Select
                    onValueChange={(value) => update('confidentiality', value)}
                    value={values.confidentiality}
                  >
                    <SelectTrigger id="customer-document-confidentiality">
                      <SelectValue placeholder="انتخاب محرمانگی" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INTERNAL">داخلی</SelectItem>
                      <SelectItem value="CONFIDENTIAL">محرمانه</SelectItem>
                      <SelectItem value="RESTRICTED">بسیار محدود</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField
                  label="تاریخ انقضا"
                  required={Boolean(selectedType?.requiresExpiry)}
                >
                  <DatePicker
                    id="customer-document-valid-until"
                    onChange={(value) => update('validUntil', value)}
                    required={Boolean(selectedType?.requiresExpiry)}
                    value={values.validUntil}
                  />
                </FormField>
                <FormField
                  id="customer-document-version-note"
                  label="یادداشت نسخه"
                >
                  <Input
                    id="customer-document-version-note"
                    onChange={(event) =>
                      update('versionNote', event.target.value)
                    }
                    placeholder="مثلاً بارگذاری اولیه"
                    value={values.versionNote}
                  />
                </FormField>
              </div>
              <FormField id="customer-document-description" label="توضیحات">
                <Textarea
                  id="customer-document-description"
                  onChange={(event) =>
                    update('description', event.target.value)
                  }
                  value={values.description}
                />
              </FormField>
              <Alert
                description={
                  options.uploadPolicy.antivirusAvailable
                    ? 'فایل پس از بارگذاری اسکن می‌شود و فقط فایل پاک قابل دریافت است.'
                    : 'آنتی‌ویروس این محیط متصل نیست؛ فایل خصوصی و غیرقابل دریافت باقی می‌ماند.'
                }
                title="کنترل امنیت فایل"
                tone={
                  options.uploadPolicy.antivirusAvailable ? 'info' : 'warning'
                }
              />
              {!branchAllowed ? (
                <Alert
                  description="برای بارگذاری باید به شعبه مالک این مشتری دسترسی داشته باشید."
                  title="شعبه غیرمجاز"
                  tone="error"
                />
              ) : null}
              {message && !message.includes('افزوده شد') ? (
                <Alert
                  description={message}
                  title="بارگذاری ناموفق بود"
                  tone="error"
                />
              ) : null}
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button
                  disabled={submitting}
                  onClick={() => setUploadOpen(false)}
                  type="button"
                  variant="ghost"
                >
                  انصراف
                </Button>
                <Button disabled={submitting || !branchAllowed} type="submit">
                  {submitting ? 'در حال بارگذاری…' : 'ثبت امن مدرک'}
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
