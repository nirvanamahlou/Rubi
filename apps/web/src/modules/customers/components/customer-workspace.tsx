'use client';

import type {
  CustomerDetail,
  CustomerKind,
  CustomerListQuery,
  CustomerMutationRequest,
  CustomerRole,
  CustomerSummary,
  DuplicateCandidate,
} from '@rubi/contracts';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Eye,
  FilePenLine,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import {
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { customersApi, CustomersApiError } from '../api/client';
import { contactDisplayValue } from '../model/customer';

const pageSize = 25;
type RequestState = 'loading' | 'ready' | 'error' | 'forbidden';
type FormMode = 'create' | 'view' | 'edit';

function customerDraft(customer?: CustomerDetail): CustomerMutationRequest {
  return {
    kind: customer?.kind ?? 'person',
    organizationId: customer?.organizationId ?? null,
    firstName: customer?.firstName ?? '',
    lastName: customer?.lastName ?? '',
    displayName: customer?.displayName ?? '',
    birthDate: customer?.birthDate ?? null,
    roles: customer?.roles ?? ['customer'],
    acquaintanceMethodId: customer?.acquaintanceMethodId ?? null,
    ...(customer ? { version: customer.version } : {}),
  };
}

function CustomerDrawer({
  mode,
  customer,
  onClose,
  onSaved,
}: {
  mode: FormMode;
  customer?: CustomerDetail;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CustomerMutationRequest>(() =>
    customerDraft(customer),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [contact, setContact] = useState('');
  const [revealedContacts, setRevealedContacts] = useState<Set<string>>(
    () => new Set(),
  );
  const [address, setAddress] = useState('');
  const [companionId, setCompanionId] = useState('');
  const [duplicates, setDuplicates] = useState<readonly DuplicateCandidate[]>(
    [],
  );
  const readonly = mode === 'view';

  async function perform(operation: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await operation();
      await onSaved(success);
    } catch (error) {
      setMessage(
        error instanceof CustomersApiError && error.status === 409
          ? 'نسخه رکورد تغییر کرده است؛ صفحه دوباره بارگذاری شد.'
          : error instanceof Error
            ? error.message
            : 'عملیات ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (customer) {
      await perform(
        () =>
          customersApi.update(customer.id, {
            ...draft,
            version: customer.version,
          }),
        'مشتری با موفقیت ویرایش شد.',
      );
    } else {
      await perform(
        () => customersApi.create(draft),
        'مشتری با موفقیت ایجاد شد.',
      );
    }
  }

  async function addContact() {
    if (!customer || !contact.trim()) return;
    await perform(
      () =>
        customersApi.addContact(customer.id, {
          type: contact.includes('@') ? 'email' : 'phone',
          value: contact,
          label: 'اصلی',
          isPrimary: true,
          version: customer.version,
        }),
      'تماس به‌صورت fingerprint و مقدار ماسک‌شده ذخیره شد.',
    );
  }

  async function addAddress() {
    if (!customer || !address.trim()) return;
    await perform(
      () =>
        customersApi.addAddress(customer.id, {
          type: 'other',
          label: address,
          isPrimary: customer.addresses.length === 0,
          version: customer.version,
        }),
      'برچسب نشانی ثبت شد.',
    );
  }

  async function addConsent(status: 'granted' | 'revoked') {
    if (!customer) return;
    await perform(
      () =>
        customersApi.addConsent(customer.id, {
          purpose: 'marketing',
          channel: 'all',
          status,
          source: 'staff-ui',
          reason:
            status === 'granted'
              ? 'ثبت رضایت توسط کارشناس'
              : 'لغو رضایت توسط کارشناس',
          version: customer.version,
        }),
      'تاریخچه رضایت ثبت شد.',
    );
  }

  async function addCompanion() {
    if (!customer || !companionId.trim()) return;
    await perform(
      () =>
        customersApi.addCompanion(customer.id, {
          relatedCustomerId: companionId,
          relationshipType: 'companion',
          version: customer.version,
        }),
      'رابطه همراه ثبت شد.',
    );
  }

  async function detectDuplicates() {
    if (!customer) return;
    setBusy(true);
    try {
      const response = await customersApi.detectDuplicates(customer.id);
      setDuplicates(response.data);
      setMessage(
        response.data.length
          ? 'موارد مشابه برای بررسی دستی یافت شد.'
          : 'مورد مشابهی یافت نشد.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'تشخیص موارد مشابه ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function review(
    candidate: DuplicateCandidate,
    status: 'confirmed-distinct' | 'merge-proposed',
  ) {
    await perform(
      () =>
        customersApi.reviewDuplicate(candidate.id, {
          status,
          reason:
            status === 'confirmed-distinct'
              ? 'بررسی دستی: دو شخص متمایز هستند'
              : 'پیشنهاد ادغام پس از بررسی دستی',
          version: candidate.version,
        }),
      status === 'merge-proposed'
        ? 'پیشنهاد ثبت شد؛ اجرای Merge تا تصمیم محصول/امنیت مسدود است.'
        : 'تمایز دو رکورد ثبت شد.',
    );
  }

  return (
    <Drawer onOpenChange={(open) => !open && onClose()} open>
      <DrawerContent className="w-[min(96vw,48rem)] overflow-y-auto p-6">
        <DialogTitle>
          {mode === 'create'
            ? 'ایجاد مشتری'
            : mode === 'edit'
              ? 'ویرایش مشتری'
              : 'Customer 360'}
        </DialogTitle>
        <DialogDescription>
          Persistence واقعی، کنترل نسخه و دسترسی شعبه فعال است. مدارک هویتی حساس
          ذخیره نمی‌شوند.
        </DialogDescription>
        {message ? (
          <Alert className="mt-4" description={message} title="نتیجه عملیات" />
        ) : null}

        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="نوع مشتری">
              <Select
                disabled={readonly}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    kind: value as CustomerKind,
                  }))
                }
                value={draft.kind}
              >
                <SelectTrigger aria-label="نوع مشتری">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">شخص حقیقی</SelectItem>
                  <SelectItem value="organization">مشتری سازمانی</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField id="customer-display-name" label="نام نمایشی" required>
              <Input
                disabled={readonly}
                id="customer-display-name"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
                value={draft.displayName}
              />
            </FormField>
            {draft.kind === 'person' ? (
              <>
                <FormField id="customer-first-name" label="نام" required>
                  <Input
                    disabled={readonly}
                    id="customer-first-name"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                    value={draft.firstName ?? ''}
                  />
                </FormField>
                <FormField
                  id="customer-last-name"
                  label="نام خانوادگی"
                  required
                >
                  <Input
                    disabled={readonly}
                    id="customer-last-name"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                    value={draft.lastName ?? ''}
                  />
                </FormField>
                <FormField
                  {...(customer?.birthDateMasked
                    ? {
                        description:
                          'برای مشاهده به customers.sensitive.read نیاز است.',
                      }
                    : {})}
                  id="customer-birth-date"
                  label="تاریخ تولد"
                >
                  <Input
                    disabled={readonly}
                    id="customer-birth-date"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        birthDate: event.target.value || null,
                      }))
                    }
                    type="date"
                    value={draft.birthDate ?? ''}
                  />
                </FormField>
              </>
            ) : (
              <FormField
                id="customer-organization"
                label="شناسه Organization"
                required
              >
                <Input
                  disabled={readonly}
                  id="customer-organization"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      organizationId: event.target.value,
                    }))
                  }
                  value={draft.organizationId ?? ''}
                />
              </FormField>
            )}
            <FormField label="نقش‌ها">
              <div className="flex gap-2">
                {(['customer', 'passenger'] as CustomerRole[]).map((role) => (
                  <Button
                    disabled={readonly}
                    key={role}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        roles: current.roles.includes(role)
                          ? current.roles.filter((item) => item !== role)
                          : [...current.roles, role],
                      }))
                    }
                    type="button"
                    variant={
                      draft.roles.includes(role) ? 'secondary' : 'outline'
                    }
                  >
                    {role === 'customer' ? 'مشتری' : 'مسافر'}
                  </Button>
                ))}
              </div>
            </FormField>
          </div>
          {!readonly ? (
            <Button disabled={busy} type="submit">
              {mode === 'create' ? 'ایجاد مشتری' : 'ذخیره با کنترل نسخه'}
            </Button>
          ) : null}
        </form>

        {customer ? (
          <Tabs className="mt-6" defaultValue="contacts" dir="rtl">
            <TabsList className="flex w-full flex-wrap justify-start">
              <TabsTrigger value="contacts">تماس‌ها</TabsTrigger>
              <TabsTrigger value="addresses">نشانی‌ها</TabsTrigger>
              <TabsTrigger value="consents">رضایت</TabsTrigger>
              <TabsTrigger value="companions">همراهان</TabsTrigger>
              <TabsTrigger value="duplicates">موارد مشابه</TabsTrigger>
            </TabsList>
            <TabsContent className="space-y-3" value="contacts">
              {customer.contacts.map((item) => {
                const revealed = revealedContacts.has(item.id);
                return (
                  <Card
                    className="flex items-center justify-between gap-3 p-3"
                    key={item.id}
                  >
                    <div>
                      <p className="font-bold" dir="ltr">
                        {contactDisplayValue(item, revealed)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        مقدار واقعی رمزگذاری شده و نمایش آن نیازمند دسترسی حساس
                        است.
                      </p>
                    </div>
                    {item.value ? (
                      <Button
                        aria-pressed={revealed}
                        onClick={() =>
                          setRevealedContacts((current) => {
                            const next = new Set(current);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          })
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Eye className="size-4" />
                        {revealed ? 'پنهان‌کردن' : 'نمایش کنترل‌شده'}
                      </Button>
                    ) : (
                      <Badge>فقط مقدار ماسک‌شده</Badge>
                    )}
                  </Card>
                );
              })}
              <div className="flex gap-2">
                <Input
                  onChange={(event) => setContact(event.target.value)}
                  placeholder="شماره یا ایمیل"
                  value={contact}
                />
                <Button
                  disabled={busy}
                  onClick={() => void addContact()}
                  type="button"
                >
                  افزودن
                </Button>
              </div>
            </TabsContent>
            <TabsContent className="space-y-3" value="addresses">
              {customer.addresses.map((item) => (
                <Card className="p-3" key={item.id}>
                  <p className="font-bold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.cityId ?? 'بدون مرجع شهر'}
                  </p>
                </Card>
              ))}
              <div className="flex gap-2">
                <Input
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="برچسب نشانی غیرحساس"
                  value={address}
                />
                <Button
                  disabled={busy}
                  onClick={() => void addAddress()}
                  type="button"
                >
                  افزودن
                </Button>
              </div>
            </TabsContent>
            <TabsContent className="space-y-3" value="consents">
              {customer.consents.map((item) => (
                <Card className="p-3" key={item.id}>
                  <p className="font-bold">
                    {item.status === 'granted'
                      ? 'رضایت ثبت‌شده'
                      : 'رضایت لغوشده'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.occurredAt).toLocaleString('fa-IR')} ·{' '}
                    {item.reason}
                  </p>
                </Card>
              ))}
              <div className="flex gap-2">
                <Button
                  disabled={busy}
                  onClick={() => void addConsent('granted')}
                  type="button"
                  variant="outline"
                >
                  ثبت رضایت
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => void addConsent('revoked')}
                  type="button"
                  variant="outline"
                >
                  لغو رضایت
                </Button>
              </div>
            </TabsContent>
            <TabsContent className="space-y-3" value="companions">
              {customer.companions.map((item) => (
                <Card className="p-3" key={item.id}>
                  <p className="font-bold">{item.relatedDisplayName}</p>
                  <p className="font-mono text-xs" dir="ltr">
                    {item.relatedCustomerId}
                  </p>
                </Card>
              ))}
              <div className="flex gap-2">
                <Input
                  onChange={(event) => setCompanionId(event.target.value)}
                  placeholder="UUID مشتری همراه"
                  value={companionId}
                />
                <Button
                  disabled={busy}
                  onClick={() => void addCompanion()}
                  type="button"
                >
                  افزودن
                </Button>
              </div>
            </TabsContent>
            <TabsContent className="space-y-3" value="duplicates">
              <Alert
                description="تشخیص فقط Candidate می‌سازد؛ Auto-merge و اجرای Merge تا بسته‌شدن DEC-OPEN-011 مسدود است."
                title="بررسی دستی"
                tone="warning"
              />
              <Button
                disabled={busy}
                onClick={() => void detectDuplicates()}
                type="button"
                variant="outline"
              >
                <AlertTriangle className="size-4" />
                تشخیص موارد مشابه
              </Button>
              {duplicates.map((candidate) => (
                <Card className="p-3" key={candidate.id}>
                  <p className="font-bold">
                    {candidate.candidateDisplayName} · امتیاز{' '}
                    {candidate.score.toLocaleString('fa-IR')}٪
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {candidate.reasons.join('، ')}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      onClick={() =>
                        void review(candidate, 'confirmed-distinct')
                      }
                      size="sm"
                      variant="outline"
                    >
                      متمایز هستند
                    </Button>
                    <Button
                      onClick={() => void review(candidate, 'merge-proposed')}
                      size="sm"
                      variant="outline"
                    >
                      ثبت پیشنهاد ادغام
                    </Button>
                  </div>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        ) : null}

        <div className="mt-6 flex justify-end">
          <DrawerClose asChild>
            <Button type="button" variant="ghost">
              بستن
            </Button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function CustomerWorkspace() {
  const [records, setRecords] = useState<readonly CustomerSummary[]>([]);
  const [requestState, setRequestState] = useState<RequestState>('loading');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CustomerListQuery['status']>('all');
  const [role, setRole] = useState<CustomerListQuery['role']>('all');
  const [sortBy, setSortBy] =
    useState<CustomerListQuery['sortBy']>('updatedAt');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [selected, setSelected] = useState<CustomerDetail | undefined>();
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRequestState('loading');
    try {
      const response = await customersApi.list({
        search,
        status,
        role,
        sortBy,
        sortDirection: sortBy === 'displayName' ? 'asc' : 'desc',
        page,
        pageSize,
      });
      setRecords(response.data);
      setTotal(response.meta.total);
      setRequestState('ready');
    } catch (error) {
      setRecords([]);
      setRequestState(
        error instanceof CustomersApiError && error.status === 403
          ? 'forbidden'
          : 'error',
      );
    }
  }, [page, role, search, sortBy, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function open(mode: FormMode, id?: string) {
    if (id) {
      try {
        setSelected((await customersApi.detail(id)).data);
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : 'دریافت Customer 360 ناموفق بود.',
        );
        return;
      }
    } else setSelected(undefined);
    setFormMode(mode);
  }

  async function refreshAfter(message: string) {
    setNotice(message);
    setFormMode(null);
    await load();
  }

  async function toggle(record: CustomerSummary) {
    try {
      await customersApi.status(record.id, {
        status: record.status === 'active' ? 'inactive' : 'active',
        version: record.version,
        reason: 'تغییر وضعیت از رابط مشتریان',
      });
      setNotice('وضعیت مشتری با Audit و کنترل نسخه تغییر کرد.');
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'تغییر وضعیت ناموفق بود.',
      );
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <Button onClick={() => void open('create')}>
            <Plus className="size-4" />
            ایجاد مشتری
          </Button>
        }
        description="Customer 360 پایدار با Permission، Branch Scope، Audit، Consent و Duplicate Candidate Review."
        eyebrow="CUSTOMER-001 · Phase B · PC-A"
        title="مشتریان و مسافران"
      />
      <Alert
        description="Persistence فعال است. تماس خام و مدارک هویتی ذخیره نمی‌شوند؛ Merge واقعی تا تصمیم قطعی محصول/امنیت مسدود است."
        title="Backend واقعی · حفاظت PII"
      />
      {notice ? <Alert description={notice} title="نتیجه عملیات" /> : null}
      <FilterBar className="grid sm:grid-cols-2 lg:grid-cols-4">
        <FormField id="customer-search-live" label="جست‌وجو">
          <div className="relative">
            <Search className="absolute end-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              className="pe-10"
              id="customer-search-live"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="نام یا تماس ماسک‌شده"
              value={search}
            />
          </div>
        </FormField>
        <FormField label="وضعیت">
          <Select
            onValueChange={(value) => {
              setStatus(value as CustomerListQuery['status']);
              setPage(1);
            }}
            value={status}
          >
            <SelectTrigger aria-label="فیلتر وضعیت">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              <SelectItem value="active">فعال</SelectItem>
              <SelectItem value="inactive">غیرفعال</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="نقش">
          <Select
            onValueChange={(value) => {
              setRole(value as CustomerListQuery['role']);
              setPage(1);
            }}
            value={role}
          >
            <SelectTrigger aria-label="فیلتر نقش">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              <SelectItem value="customer">مشتری</SelectItem>
              <SelectItem value="passenger">مسافر</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="مرتب‌سازی">
          <Select
            onValueChange={(value) =>
              setSortBy(value as CustomerListQuery['sortBy'])
            }
            value={sortBy}
          >
            <SelectTrigger aria-label="مرتب‌سازی">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt">آخرین تغییر</SelectItem>
              <SelectItem value="createdAt">تاریخ ایجاد</SelectItem>
              <SelectItem value="displayName">نام نمایشی</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </FilterBar>

      {requestState === 'loading' ? (
        <Card className="space-y-3 p-4">
          {[1, 2, 3].map((item) => (
            <Skeleton className="h-16 w-full" key={item} />
          ))}
        </Card>
      ) : requestState === 'forbidden' ? (
        <EmptyState
          description="مجوز customers.read برای مشاهده لازم است."
          icon={Ban}
          title="دسترسی مشتریان وجود ندارد"
        />
      ) : requestState === 'error' ? (
        <ErrorState
          action={
            <Button onClick={() => void load()} size="sm" variant="outline">
              <RefreshCw className="size-4" />
              تلاش دوباره
            </Button>
          }
          description="Session یا اتصال Backend را بررسی کنید."
          title="دریافت مشتریان ناموفق بود"
        />
      ) : records.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={() => void open('create')} size="sm">
              ایجاد مشتری
            </Button>
          }
          description="با فیلتر فعلی رکوردی پیدا نشد."
          icon={UsersRound}
          title="فهرست خالی است"
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[54rem] text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-4 text-start">مشتری</th>
                <th className="p-4 text-start">نقش</th>
                <th className="p-4 text-start">رضایت</th>
                <th className="p-4 text-start">نسخه</th>
                <th className="p-4 text-start">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr className="border-t border-border" key={record.id}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                        <UserRound className="size-5" />
                      </span>
                      <div>
                        <p className="font-bold">{record.displayName}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {record.maskedPrimaryContact ?? 'بدون تماس'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    {record.roles.map((item) => (
                      <Badge className="me-1" key={item}>
                        {item === 'customer' ? 'مشتری' : 'مسافر'}
                      </Badge>
                    ))}
                  </td>
                  <td className="p-4">
                    <Badge>
                      {record.currentConsentStatus === 'granted'
                        ? 'ثبت‌شده'
                        : record.currentConsentStatus === 'revoked'
                          ? 'لغوشده'
                          : 'ثبت‌نشده'}
                    </Badge>
                  </td>
                  <td className="p-4 font-mono">{record.version}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => void open('view', record.id)}
                        size="sm"
                        variant="outline"
                      >
                        <Eye className="size-4" />
                        مشاهده
                      </Button>
                      <Button
                        onClick={() => void open('edit', record.id)}
                        size="sm"
                        variant="outline"
                      >
                        <FilePenLine className="size-4" />
                        ویرایش
                      </Button>
                      <Button
                        onClick={() => void toggle(record)}
                        size="sm"
                        variant="ghost"
                      >
                        {record.status === 'active'
                          ? 'غیرفعال‌سازی'
                          : 'فعال‌سازی'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <div className="flex items-center justify-between gap-3">
        <PaginationShell
          currentPage={page}
          totalLabel={`${total.toLocaleString('fa-IR')} رکورد`}
        />
        <div className="flex gap-2">
          <Button
            disabled={page === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            size="sm"
            variant="outline"
          >
            قبلی
          </Button>
          <Button
            disabled={page * pageSize >= total}
            onClick={() => setPage((value) => value + 1)}
            size="sm"
            variant="outline"
          >
            بعدی
          </Button>
        </div>
      </div>
      <Card className="grid gap-3 p-4 sm:grid-cols-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <span className="text-sm">دسترسی حساس Backend-enforced</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" />
          <span className="text-sm">نشانی غیرحساس + City FK</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-primary" />
          <span className="text-sm">Audit و Optimistic Version</span>
        </div>
      </Card>
      {formMode ? (
        <CustomerDrawer
          key={`${formMode}-${selected?.id ?? 'new'}-${selected?.version ?? 0}`}
          mode={formMode}
          onClose={() => setFormMode(null)}
          onSaved={refreshAfter}
          {...(selected ? { customer: selected } : {})}
        />
      ) : null}
    </div>
  );
}
