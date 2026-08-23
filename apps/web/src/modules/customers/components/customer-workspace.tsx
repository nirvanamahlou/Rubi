'use client';

import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Eye,
  FilePenLine,
  Link2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/overlays';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  PaginationShell,
  Skeleton,
} from '@/components/ui/surfaces';
import {
  CUSTOMER_API_VERSION,
  CUSTOMER_PHASE_A_NOTICE,
  normalizeCustomerListQuery,
} from '../api/contracts';
import {
  customerStateOptions,
  filterPreviewCustomers,
  getConsentLabel,
  previewCustomers,
  type CustomerDraft,
  type CustomerPreviewState,
  validateCustomerDraft,
} from '../model/customer';

type FormMode = 'create' | 'view' | 'edit';
const emptyDraft: CustomerDraft = {
  displayName: '',
  firstName: '',
  lastName: '',
  primaryPhone: '',
  email: '',
  addressLabel: '',
};
const previewDraft: CustomerDraft = {
  displayName: 'مشتری نمونه ۰۱',
  firstName: 'نام نمونه',
  lastName: 'نام خانوادگی نمونه',
  primaryPhone: '',
  email: 'preview@example.invalid',
  addressLabel: 'نشانی نمایشی؛ در سامانه ذخیره نشده',
};

function CustomerForm({
  mode,
  onClose,
}: {
  mode: FormMode;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<CustomerDraft>(
    mode === 'create' ? emptyDraft : previewDraft,
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof CustomerDraft, string>>
  >({});
  const [validated, setValidated] = useState(false);
  const readonly = mode === 'view';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateCustomerDraft(draft);
    setErrors(result.errors);
    setValidated(result.valid);
  }

  return (
    <Drawer onOpenChange={(open) => !open && onClose()} open>
      <DrawerContent className="w-[min(94vw,38rem)] p-6">
        <DialogTitle>
          {mode === 'create'
            ? 'ایجاد مشتری'
            : mode === 'edit'
              ? 'ویرایش مشتری'
              : 'مشاهده Customer 360'}
        </DialogTitle>
        <DialogDescription>
          {readonly
            ? 'این فرم فقط نمونه‌ی طراحی است و رکورد پایدار ندارد.'
            : 'اعتبارسنجی فعال است؛ ارسال فرم هیچ داده‌ای ذخیره نمی‌کند.'}
        </DialogDescription>
        <div className="mt-4 flex gap-2">
          <Badge>{CUSTOMER_API_VERSION}</Badge>
          <Badge className="bg-amber-500/10 text-amber-700">
            بدون Persistence
          </Badge>
        </div>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ['displayName', 'نام نمایشی', 'مثال: مشتری سازمانی', 'text'],
                ['firstName', 'نام', 'نام غیرحساس', 'text'],
                ['lastName', 'نام خانوادگی', 'نام خانوادگی غیرحساس', 'text'],
                ['primaryPhone', 'شماره تماس', '+98...', 'tel'],
                ['email', 'ایمیل', 'name@example.com', 'email'],
              ] as const
            ).map(([key, label, placeholder, type]) => (
              <FormField
                {...(errors[key] ? { error: errors[key] } : {})}
                id={`customer-${key}`}
                key={key}
                label={label}
                required={['displayName', 'firstName', 'lastName'].includes(
                  key,
                )}
              >
                <Input
                  aria-invalid={Boolean(errors[key])}
                  disabled={readonly}
                  id={`customer-${key}`}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  placeholder={placeholder}
                  readOnly={readonly}
                  type={type}
                  value={draft[key]}
                />
              </FormField>
            ))}
          </div>
          <FormField
            description="فقط برچسب نشانی غیرحساس؛ فایل هویتی دریافت نمی‌شود."
            id="customer-address"
            label="نشانی"
          >
            <Textarea
              disabled={readonly}
              id="customer-address"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  addressLabel: event.target.value,
                }))
              }
              readOnly={readonly}
              value={draft.addressLabel}
            />
          </FormField>
          {validated ? (
            <Alert
              description="فرم آماده اتصال آینده به Application Port است؛ ذخیره‌ای انجام نشد."
              title="اعتبارسنجی موفق"
            />
          ) : null}
          <div className="flex justify-end gap-2">
            <DrawerClose asChild>
              <Button type="button" variant="ghost">
                بستن
              </Button>
            </DrawerClose>
            {!readonly ? (
              <Button type="submit">بررسی فرم بدون ذخیره</Button>
            ) : null}
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

function CustomerResults({
  onOpen,
  state,
}: {
  onOpen: (mode: FormMode) => void;
  state: CustomerPreviewState;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'displayName' | 'updatedAt'>(
    'updatedAt',
  );
  const customers = useMemo(
    () =>
      filterPreviewCustomers(
        previewCustomers,
        normalizeCustomerListQuery({
          search,
          status,
          sortBy,
          sortDirection: sortBy === 'updatedAt' ? 'desc' : 'asc',
        }),
      ),
    [search, sortBy, status],
  );

  return (
    <section className="space-y-4">
      <FilterBar className="grid sm:grid-cols-3">
        <FormField id="customer-search" label="جست‌وجو">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute end-3 top-3.5 size-4 text-muted-foreground"
            />
            <Input
              className="pe-10"
              id="customer-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="نام یا تماس ماسک‌شده"
              value={search}
            />
          </div>
        </FormField>
        <FormField label="وضعیت">
          <Select
            onValueChange={(value) => setStatus(value as typeof status)}
            value={status}
          >
            <SelectTrigger aria-label="فیلتر وضعیت مشتری">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              <SelectItem value="active">فعال</SelectItem>
              <SelectItem value="inactive">غیرفعال</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="مرتب‌سازی">
          <Select
            onValueChange={(value) => setSortBy(value as typeof sortBy)}
            value={sortBy}
          >
            <SelectTrigger aria-label="مرتب‌سازی مشتریان">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt">آخرین تغییر</SelectItem>
              <SelectItem value="displayName">نام نمایشی</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </FilterBar>

      {state === 'loading' ? (
        <Card aria-live="polite" className="space-y-3 p-4">
          {[1, 2, 3].map((row) => (
            <Skeleton className="h-16 w-full" key={row} />
          ))}
        </Card>
      ) : state === 'error' ? (
        <ErrorState
          action={
            <Button size="sm" variant="outline">
              <RefreshCw aria-hidden="true" className="size-4" />
              تلاش دوباره
            </Button>
          }
          description="جزئیات خام سرور یا داده حساس نمایش داده نمی‌شود."
          title="دریافت مشتریان ناموفق بود"
        />
      ) : state === 'forbidden' ? (
        <EmptyState
          description="نمایش اطلاعات به customers.read نیاز دارد و پیش‌فرض مسدود است."
          icon={Ban}
          title="دسترسی مشاهده مشتریان وجود ندارد"
        />
      ) : state === 'empty' || customers.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={() => onOpen('create')} size="sm">
              طراحی فرم ایجاد
            </Button>
          }
          description="هیچ جست‌وجوی Database اجرا نشده است."
          icon={UsersRound}
          title="موردی یافت نشد"
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-black">فهرست نمایشی مشتریان و مسافران</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              شناسه‌ها ساختگی و تماس‌ها ماسک‌شده‌اند.
            </p>
          </div>
          <div className="divide-y divide-border">
            {customers.map((customer) => (
              <article
                className="grid gap-4 p-4 md:grid-cols-[1.2fr_1fr_auto] md:items-center"
                key={customer.id}
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <UserRound aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-bold">{customer.displayName}</h3>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {customer.maskedContact}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>
                    {customer.status === 'active' ? 'فعال' : 'غیرفعال'}
                  </Badge>
                  <Badge>رضایت: {getConsentLabel(customer.consent)}</Badge>
                  <Badge>
                    {customer.companionCount.toLocaleString('fa-IR')} همراه
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => onOpen('view')}
                    size="sm"
                    variant="outline"
                  >
                    <Eye aria-hidden="true" className="size-4" />
                    مشاهده
                  </Button>
                  <Button
                    onClick={() => onOpen('edit')}
                    size="sm"
                    variant="outline"
                  >
                    <FilePenLine aria-hidden="true" className="size-4" />
                    ویرایش
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </Card>
      )}
      <PaginationShell
        totalLabel={`${customers.length.toLocaleString('fa-IR')} رکورد نمایشی`}
      />
    </section>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <Icon aria-hidden="true" className="size-4 text-primary" />
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function Customer360Preview() {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-black">Customer 360 — پیش‌نمایش</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            بدون اطلاعات حساس یا داده پایدار
          </p>
        </div>
        <Badge className="bg-amber-500/10 text-amber-700">داده غیرواقعی</Badge>
      </div>
      <Tabs className="mt-5" defaultValue="identity" dir="rtl">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="identity">هویت پایه</TabsTrigger>
          <TabsTrigger value="contact">ارتباط و نشانی</TabsTrigger>
          <TabsTrigger value="consent">رضایت‌نامه</TabsTrigger>
          <TabsTrigger value="companions">همراهان</TabsTrigger>
        </TabsList>
        <TabsContent className="mt-4" value="identity">
          <div className="grid gap-3 sm:grid-cols-3">
            <Info icon={UserRound} label="نام نمایشی" value="مشتری نمونه ۰۱" />
            <Info icon={ShieldCheck} label="مدارک حساس" value="ذخیره نمی‌شود" />
            <Info icon={CheckCircle2} label="وضعیت" value="فعال — نمایشی" />
          </div>
        </TabsContent>
        <TabsContent className="mt-4" value="contact">
          <div className="grid gap-3 sm:grid-cols-2">
            <Info icon={Link2} label="تماس اصلی" value="۰۹۱۲•••۱۲۳۴" />
            <Info icon={MapPin} label="نشانی" value="برچسب نمایشی ثبت‌نشده" />
          </div>
        </TabsContent>
        <TabsContent className="mt-4" value="consent">
          <Info
            icon={ShieldCheck}
            label="رضایت ارتباطی"
            value="مدیریت نیازمند customers.consent.manage"
          />
        </TabsContent>
        <TabsContent className="mt-4" value="companions">
          <Info
            icon={UsersRound}
            label="ارتباط همراهان"
            value="۲ رابطه نمایشی؛ بدون FK یا ذخیره‌سازی"
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function DuplicateReview() {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <AlertTriangle aria-hidden="true" className="size-5 text-amber-700" />
        <div>
          <h2 className="font-black">بررسی دستی موارد مشابه</h2>
          <p className="text-xs text-muted-foreground">
            Candidate Detection فقط پیشنهاد می‌دهد؛ Auto-merge وجود ندارد.
          </p>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-dashed border-border p-4">
        <p className="text-sm font-bold">کاندیدای نمایشی با امتیاز ۸۵٪</p>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          دلیل‌ها: تماس ماسک‌شده و نام مشابه. تصمیم نهایی به customers.merge و
          Audit فاز B نیاز دارد.
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline">
            متمایز هستند
          </Button>
          <Button disabled size="sm">
            پیشنهاد ادغام
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function CustomerWorkspace() {
  const [state, setState] = useState<CustomerPreviewState>('preview');
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <Button onClick={() => setFormMode('create')}>
            <Plus aria-hidden="true" className="size-4" />
            ایجاد مشتری
          </Button>
        }
        description="Foundation تجربه مشتریان و مسافران، Customer 360 و بررسی دستی موارد مشابه."
        eyebrow="CUSTOMER-001 · Phase A · PC-A"
        title="مشتریان و مسافران"
      />
      <Alert
        description={CUSTOMER_PHASE_A_NOTICE}
        title="پیش‌نمایش بدون Persistence"
        tone="warning"
      />
      <Card className="p-4">
        <fieldset>
          <legend className="text-xs font-bold text-muted-foreground">
            وضعیت‌های قابل بازبینی
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {customerStateOptions.map(([value, label]) => (
              <Button
                aria-pressed={state === value}
                key={value}
                onClick={() => setState(value)}
                size="sm"
                variant={state === value ? 'secondary' : 'ghost'}
              >
                {label}
              </Button>
            ))}
          </div>
        </fieldset>
      </Card>
      <CustomerResults onOpen={setFormMode} state={state} />
      <div className="grid gap-5 xl:grid-cols-2">
        <Customer360Preview />
        <DuplicateReview />
      </div>
      {formMode ? (
        <CustomerForm mode={formMode} onClose={() => setFormMode(null)} />
      ) : null}
    </div>
  );
}
