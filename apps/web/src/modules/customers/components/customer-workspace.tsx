'use client';

import type {
  CustomerDetail,
  CustomerAddressType,
  CustomerConsentChannel,
  CustomerContactType,
  CustomerKind,
  CustomerListQuery,
  CustomerMutationRequest,
  CustomerRelationshipType,
  CustomerRole,
  CustomerSummary,
  DuplicateCandidate,
  MasterDataRecord,
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
  ConfirmDialog,
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
import { masterDataApi } from '@/modules/master-data/api/client';
import { customersApi, CustomersApiError } from '../api/client';
import { contactDisplayValue } from '../model/customer';
import { customerListFailureState } from './customer-workspace-state';

const pageSize = 25;
type RequestState =
  'loading' | 'ready' | 'error' | 'unauthorized' | 'forbidden';
type FormMode = 'create' | 'view' | 'edit';

const sensitiveReasons = [
  ['customer-verification', 'احراز مشتری'],
  ['support-request', 'درخواست پشتیبانی'],
  ['data-correction', 'اصلاح داده'],
] as const;

function listMasterData(
  resource: 'organizations' | 'acquaintance-methods' | 'countries' | 'cities',
) {
  return masterDataApi.list(resource, {
    search: '',
    status: 'active',
    sortBy: 'name',
    sortDirection: 'asc',
    page: 1,
    pageSize: 100,
  });
}

function customerCode(id: string) {
  return id.slice(0, 8).toUpperCase();
}

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
  onSaved: (message: string, detail: CustomerDetail) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CustomerMutationRequest>(() =>
    customerDraft(customer),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [masters, setMasters] = useState<{
    organizations: readonly MasterDataRecord[];
    acquaintanceMethods: readonly MasterDataRecord[];
    countries: readonly MasterDataRecord[];
    cities: readonly MasterDataRecord[];
  }>({
    organizations: [],
    acquaintanceMethods: [],
    countries: [],
    cities: [],
  });
  const [masterWarning, setMasterWarning] = useState<string | null>(null);
  const [contactType, setContactType] = useState<CustomerContactType>('phone');
  const [contactLabel, setContactLabel] = useState('اصلی');
  const [contact, setContact] = useState('');
  const [sensitiveReason, setSensitiveReason] = useState('');
  const [revealedDetail, setRevealedDetail] = useState<CustomerDetail | null>(
    null,
  );
  const [addressType, setAddressType] = useState<CustomerAddressType>('home');
  const [address, setAddress] = useState('');
  const [countryId, setCountryId] = useState('');
  const [cityId, setCityId] = useState('');
  const [companionSearch, setCompanionSearch] = useState('');
  const [companionOptions, setCompanionOptions] = useState<
    readonly CustomerSummary[]
  >([]);
  const [companionId, setCompanionId] = useState('');
  const [relationshipType, setRelationshipType] =
    useState<CustomerRelationshipType>('companion');
  const [consentChannel, setConsentChannel] =
    useState<CustomerConsentChannel>('all');
  const [consentSource, setConsentSource] = useState('staff-ui');
  const [consentReason, setConsentReason] = useState('');
  const [duplicates, setDuplicates] = useState<readonly DuplicateCandidate[]>(
    [],
  );
  const readonly = mode === 'view';
  const displayedCustomer = revealedDetail ?? customer;

  useEffect(() => {
    let active = true;
    void Promise.all([
      listMasterData('organizations'),
      listMasterData('acquaintance-methods'),
      listMasterData('countries'),
      listMasterData('cities'),
    ])
      .then(([organizations, acquaintanceMethods, countries, cities]) => {
        if (!active) return;
        setMasters({
          organizations: organizations.data,
          acquaintanceMethods: acquaintanceMethods.data,
          countries: countries.data,
          cities: cities.data,
        });
      })
      .catch(() => {
        if (active) {
          setMasterWarning(
            'اطلاعات پایه در دسترس نیست؛ انتخاب مرجع جدید موقتاً غیرفعال است.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!companionSearch.trim() || !customer) return;
    const timer = window.setTimeout(() => {
      void customersApi
        .list({
          search: companionSearch,
          status: 'active',
          role: 'all',
          sortBy: 'displayName',
          sortDirection: 'asc',
          page: 1,
          pageSize: 25,
        })
        .then((response) =>
          setCompanionOptions(
            response.data.filter((record) => record.id !== customer.id),
          ),
        )
        .catch(() => setCompanionOptions([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [companionSearch, customer]);

  async function perform(
    operation: () => Promise<{ data: CustomerDetail }>,
    success: string,
  ) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await operation();
      setRevealedDetail(null);
      await onSaved(success, response.data);
    } catch (error) {
      setMessage(
        error instanceof CustomersApiError && error.status === 409
          ? 'نسخه رکورد تغییر کرده است؛ داده تازه دریافت شد.'
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
          type: contactType,
          value: contact,
          label: contactLabel.trim() || null,
          isPrimary: customer.contacts.length === 0,
          version: customer.version,
        }),
      'تماس به‌صورت fingerprint و مقدار ماسک‌شده ذخیره شد.',
    );
  }

  async function revealSensitive() {
    if (!customer || !sensitiveReason) {
      setMessage('برای نمایش داده حساس، دلیل مجاز را انتخاب کنید.');
      return;
    }
    setBusy(true);
    try {
      const response = await customersApi.detail(customer.id, sensitiveReason);
      setRevealedDetail(response.data);
      setMessage(
        'نمایش حساس برای همین مشاهده فعال شد و دلیل آن در Audit ثبت شده است.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'نمایش داده حساس ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function addAddress() {
    if (!customer || !address.trim()) return;
    await perform(
      () =>
        customersApi.addAddress(customer.id, {
          type: addressType,
          label: address,
          cityId: cityId || null,
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
          channel: consentChannel,
          status,
          source: consentSource.trim(),
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
          relationshipType,
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
    setBusy(true);
    try {
      await customersApi.reviewDuplicate(candidate.id, {
        status,
        reason:
          status === 'confirmed-distinct'
            ? 'بررسی دستی: دو شخص متمایز هستند'
            : 'پیشنهاد ادغام پس از بررسی دستی',
        version: candidate.version,
      });
      setMessage(
        status === 'merge-proposed'
          ? 'پیشنهاد ثبت شد؛ اجرای Merge تا تصمیم محصول/امنیت مسدود است.'
          : 'تمایز دو رکورد ثبت شد.',
      );
      const response = await customersApi.detectDuplicates(
        candidate.sourceCustomerId,
      );
      setDuplicates(response.data);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'ثبت نتیجه بررسی ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
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
        <div aria-live="polite" role="status">
          {message ? (
            <Alert
              className="mt-4"
              description={message}
              title="نتیجه عملیات"
            />
          ) : null}
          {masterWarning ? (
            <Alert
              className="mt-4"
              description={masterWarning}
              title="اطلاعات پایه"
              tone="warning"
            />
          ) : null}
        </div>

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
              <FormField label="سازمان مرجع" required>
                <Select
                  disabled={readonly || masters.organizations.length === 0}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      organizationId: value,
                    }))
                  }
                  value={draft.organizationId ?? ''}
                >
                  <SelectTrigger aria-label="سازمان مرجع">
                    <SelectValue placeholder="انتخاب از اطلاعات پایه" />
                  </SelectTrigger>
                  <SelectContent>
                    {masters.organizations.map((record) => (
                      <SelectItem key={record.id} value={record.id}>
                        {record.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
            <FormField label="نحوه آشنایی">
              <Select
                disabled={readonly || masters.acquaintanceMethods.length === 0}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    acquaintanceMethodId:
                      value === 'not-selected' ? null : value,
                  }))
                }
                value={draft.acquaintanceMethodId ?? 'not-selected'}
              >
                <SelectTrigger aria-label="نحوه آشنایی">
                  <SelectValue placeholder="انتخاب از اطلاعات پایه" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not-selected">ثبت نشده</SelectItem>
                  {masters.acquaintanceMethods.map((record) => (
                    <SelectItem key={record.id} value={record.id}>
                      {record.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
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
          <Tabs className="mt-6" defaultValue="overview" dir="rtl">
            <TabsList className="flex w-full flex-wrap justify-start">
              <TabsTrigger value="overview">نمای کلی</TabsTrigger>
              <TabsTrigger value="contacts">تماس‌ها</TabsTrigger>
              <TabsTrigger value="addresses">نشانی‌ها</TabsTrigger>
              <TabsTrigger value="consents">رضایت</TabsTrigger>
              <TabsTrigger value="companions">همراهان</TabsTrigger>
              <TabsTrigger value="status-history">تاریخچه وضعیت</TabsTrigger>
              <TabsTrigger value="duplicates">موارد مشابه</TabsTrigger>
              <TabsTrigger value="activity">فعالیت‌ها</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
            </TabsList>
            <TabsContent className="space-y-3" value="overview">
              <Card className="grid gap-3 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">کد مشتری</p>
                  <p className="font-mono text-sm" dir="ltr">
                    {customer.id}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">وضعیت</p>
                  <Badge>
                    {customer.status === 'active' ? 'فعال' : 'غیرفعال'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">شعبه مالک</p>
                  <p className="font-mono text-sm" dir="ltr">
                    {customer.ownerBranchId}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">نسخه</p>
                  <p>{customer.version.toLocaleString('fa-IR')}</p>
                </div>
              </Card>
              <Alert
                description="نام لاتین، جنسیت، یادداشت و کد مستقل کسب‌وکاری در Schema و customers.v2 موجود نیستند و برای CUSTOMER-002B مسدود ثبت شده‌اند."
                title="قابلیت‌های نیازمند قرارداد"
                tone="warning"
              />
            </TabsContent>
            <TabsContent className="space-y-3" value="contacts">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <FormField label="دلیل نمایش داده حساس">
                  <Select
                    onValueChange={setSensitiveReason}
                    value={sensitiveReason}
                  >
                    <SelectTrigger aria-label="دلیل نمایش داده حساس">
                      <SelectValue placeholder="انتخاب دلیل مجاز" />
                    </SelectTrigger>
                    <SelectContent>
                      {sensitiveReasons.map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <Button
                  className="self-end"
                  disabled={busy || !sensitiveReason}
                  onClick={() => void revealSensitive()}
                  type="button"
                  variant="outline"
                >
                  <Eye className="size-4" />
                  نمایش کنترل‌شده
                </Button>
              </div>
              {displayedCustomer?.contacts.map((item) => (
                <Card
                  className="flex items-center justify-between gap-3 p-3"
                  key={item.id}
                >
                  <div>
                    <p className="font-bold" dir="ltr">
                      {contactDisplayValue(item, Boolean(revealedDetail))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.type === 'email' ? 'ایمیل' : 'تلفن'} ·{' '}
                      {item.label ?? 'بدون برچسب'}
                    </p>
                  </div>
                  <Badge>
                    {revealedDetail ? 'نمایش Audit‌شده' : 'ماسک‌شده'}
                  </Badge>
                </Card>
              ))}
              {!readonly ? (
                <Card className="grid gap-3 p-4 sm:grid-cols-3">
                  <FormField label="نوع تماس">
                    <Select
                      onValueChange={(value) =>
                        setContactType(value as CustomerContactType)
                      }
                      value={contactType}
                    >
                      <SelectTrigger aria-label="نوع تماس">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="phone">تلفن</SelectItem>
                        <SelectItem value="email">ایمیل</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField id="contact-label" label="برچسب">
                    <Input
                      id="contact-label"
                      onChange={(event) => setContactLabel(event.target.value)}
                      value={contactLabel}
                    />
                  </FormField>
                  <FormField id="contact-value" label="مقدار" required>
                    <Input
                      dir="ltr"
                      id="contact-value"
                      onChange={(event) => setContact(event.target.value)}
                      value={contact}
                    />
                  </FormField>
                  <Button
                    disabled={busy}
                    onClick={() => void addContact()}
                    type="button"
                  >
                    افزودن تماس
                  </Button>
                </Card>
              ) : null}
            </TabsContent>
            <TabsContent className="space-y-3" value="addresses">
              {customer.addresses.map((item) => (
                <Card className="p-3" key={item.id}>
                  <p className="font-bold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {masters.cities.find((record) => record.id === item.cityId)
                      ?.name ?? 'بدون مرجع شهر'}{' '}
                    · {item.type}
                  </p>
                </Card>
              ))}
              {!readonly ? (
                <Card className="grid gap-3 p-4 sm:grid-cols-2">
                  <FormField label="نوع نشانی">
                    <Select
                      onValueChange={(value) =>
                        setAddressType(value as CustomerAddressType)
                      }
                      value={addressType}
                    >
                      <SelectTrigger aria-label="نوع نشانی">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="home">منزل</SelectItem>
                        <SelectItem value="work">محل کار</SelectItem>
                        <SelectItem value="billing">صورتحساب</SelectItem>
                        <SelectItem value="other">سایر</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField id="address-label" label="برچسب نشانی" required>
                    <Input
                      id="address-label"
                      onChange={(event) => setAddress(event.target.value)}
                      value={address}
                    />
                  </FormField>
                  <FormField label="کشور">
                    <Select
                      onValueChange={(value) => {
                        setCountryId(value);
                        setCityId('');
                      }}
                      value={countryId}
                    >
                      <SelectTrigger aria-label="کشور نشانی">
                        <SelectValue placeholder="انتخاب کشور" />
                      </SelectTrigger>
                      <SelectContent>
                        {masters.countries.map((record) => (
                          <SelectItem key={record.id} value={record.id}>
                            {record.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="شهر">
                    <Select onValueChange={setCityId} value={cityId}>
                      <SelectTrigger aria-label="شهر نشانی">
                        <SelectValue placeholder="انتخاب شهر" />
                      </SelectTrigger>
                      <SelectContent>
                        {masters.cities
                          .filter(
                            (record) =>
                              !countryId ||
                              String(record.attributes.countryId ?? '') ===
                                countryId,
                          )
                          .map((record) => (
                            <SelectItem key={record.id} value={record.id}>
                              {record.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <Button
                    disabled={busy}
                    onClick={() => void addAddress()}
                    type="button"
                  >
                    افزودن نشانی
                  </Button>
                </Card>
              ) : null}
              <Alert
                description="Schema فعلی فقط برچسب غیرحساس و City FK را نگه می‌دارد؛ متن کامل نشانی و Masking برای CUSTOMER-002B مسدود است."
                title="حفاظت نشانی"
                tone="warning"
              />
            </TabsContent>
            <TabsContent className="space-y-3" value="consents">
              {customer.consents.map((item) => (
                <Card className="p-3" key={item.id}>
                  <p className="font-bold">
                    {item.status === 'granted'
                      ? 'رضایت ثبت‌شده'
                      : 'رضایت لغوشده'}{' '}
                    · {item.channel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.occurredAt).toLocaleString('fa-IR')} ·{' '}
                    {item.source} · {item.reason}
                  </p>
                </Card>
              ))}
              {!readonly ? (
                <Card className="grid gap-3 p-4 sm:grid-cols-3">
                  <FormField label="کانال">
                    <Select
                      onValueChange={(value) =>
                        setConsentChannel(value as CustomerConsentChannel)
                      }
                      value={consentChannel}
                    >
                      <SelectTrigger aria-label="کانال رضایت">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">همه</SelectItem>
                        <SelectItem value="sms">پیامک</SelectItem>
                        <SelectItem value="email">ایمیل</SelectItem>
                        <SelectItem value="phone">تلفن</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField id="consent-source" label="منبع" required>
                    <Input
                      id="consent-source"
                      onChange={(event) => setConsentSource(event.target.value)}
                      value={consentSource}
                    />
                  </FormField>
                  <FormField id="consent-reason" label="دلیل" required>
                    <Input
                      id="consent-reason"
                      onChange={(event) => setConsentReason(event.target.value)}
                      value={consentReason}
                    />
                  </FormField>
                  <div className="flex gap-2 sm:col-span-3">
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
                    <Button
                      disabled
                      size="sm"
                      title="Merge واقعی تا تصمیم امنیت و محصول مسدود است"
                      variant="ghost"
                    >
                      اجرای Merge
                    </Button>
                  </div>
                </Card>
              ) : null}
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
              {!readonly ? (
                <Card className="grid gap-3 p-4 sm:grid-cols-2">
                  <FormField id="companion-search" label="جست‌وجوی مشتری همراه">
                    <Input
                      id="companion-search"
                      onChange={(event) =>
                        setCompanionSearch(event.target.value)
                      }
                      placeholder="نام، تماس ماسک‌شده یا کد کامل"
                      value={companionSearch}
                    />
                  </FormField>
                  <FormField label="نوع رابطه">
                    <Select
                      onValueChange={(value) =>
                        setRelationshipType(value as CustomerRelationshipType)
                      }
                      value={relationshipType}
                    >
                      <SelectTrigger aria-label="نوع رابطه همراه">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="family">خانواده</SelectItem>
                        <SelectItem value="companion">همراه</SelectItem>
                        <SelectItem value="guardian">سرپرست</SelectItem>
                        <SelectItem value="dependent">تحت تکفل</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="انتخاب مشتری">
                    <Select onValueChange={setCompanionId} value={companionId}>
                      <SelectTrigger aria-label="انتخاب مشتری همراه">
                        <SelectValue placeholder="انتخاب از نتایج" />
                      </SelectTrigger>
                      <SelectContent>
                        {(companionSearch.trim() ? companionOptions : []).map(
                          (record) => (
                            <SelectItem key={record.id} value={record.id}>
                              {record.displayName} · {customerCode(record.id)}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <Button
                    disabled={busy || !companionId}
                    onClick={() => void addCompanion()}
                    type="button"
                  >
                    ثبت رابطه
                  </Button>
                </Card>
              ) : null}
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
                      disabled={busy || readonly}
                      onClick={() =>
                        void review(candidate, 'confirmed-distinct')
                      }
                      size="sm"
                      variant="outline"
                    >
                      متمایز هستند
                    </Button>
                    <Button
                      disabled={busy || readonly}
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
            <TabsContent value="status-history">
              <Alert
                description="تغییر وضعیت در Backend با دلیل، Actor و UTC ثبت می‌شود؛ customers.v2 تاریخچه را برنمی‌گرداند."
                title="BLOCKED_FOR_CUSTOMER_002B"
                tone="warning"
              />
            </TabsContent>
            <TabsContent value="activity">
              <Alert
                description="قرارداد عمومی Customers هنوز Timeline بین‌ماژولی را ارائه نمی‌کند؛ داده ساختگی نمایش داده نمی‌شود."
                title="BLOCKED_FOR_CUSTOMER_002B"
                tone="warning"
              />
            </TabsContent>
            <TabsContent value="audit">
              <Alert
                description="Audit در Backend ثبت می‌شود، اما Endpoint خواندن Audit در قرارداد عمومی فعلی وجود ندارد."
                title="BLOCKED_FOR_CUSTOMER_002B"
                tone="warning"
              />
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
      setRequestState(customerListFailureState(error));
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
        description="Customer 360 عملیاتی با Permission، Branch Scope، Audit، Consent و Duplicate Candidate Review."
        eyebrow="CUSTOMER-002A · PC-A"
        title="مشتریان و مسافران"
      />
      <Alert
        description="Persistence فعال است. تماس در حالت عادی فقط ماسک‌شده نمایش داده می‌شود؛ مدرک هویتی ذخیره نمی‌شود و Merge واقعی مسدود است."
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
              placeholder="نام، تماس ماسک‌شده یا کد کامل مشتری"
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
      <Alert
        description="Branch Scope در Backend اعمال می‌شود و مستقل از Legal Entity است. فیلتر نوع مشتری و انتخاب Branch در customers.v2 وجود ندارند و برای CUSTOMER-002B مسدودند."
        title="مرز فیلترها"
        tone="warning"
      />

      {requestState === 'loading' ? (
        <Card className="space-y-3 p-4">
          {[1, 2, 3].map((item) => (
            <Skeleton className="h-16 w-full" key={item} />
          ))}
        </Card>
      ) : requestState === 'unauthorized' ? (
        <ErrorState
          action={
            <Button asChild size="sm">
              <a href="/login?next=%2Fcustomers">ورود دوباره</a>
            </Button>
          }
          description="نشست معتبر نیست؛ دوباره وارد شوید."
          title="نیاز به ورود دوباره"
        />
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
          <table className="w-full min-w-[64rem] text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-4 text-start">مشتری</th>
                <th className="p-4 text-start">کد</th>
                <th className="p-4 text-start">وضعیت و نقش</th>
                <th className="p-4 text-start">رضایت</th>
                <th className="p-4 text-start">آخرین تغییر</th>
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
                  <td className="p-4 font-mono" dir="ltr" title={record.id}>
                    {customerCode(record.id)}
                  </td>
                  <td className="p-4">
                    <Badge className="me-1">
                      {record.status === 'active' ? 'فعال' : 'غیرفعال'}
                    </Badge>
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
                  <td className="p-4">
                    {new Date(record.updatedAt).toLocaleDateString('fa-IR')}
                  </td>
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
                      <ConfirmDialog
                        description="این تغییر با دلیل استاندارد، زمان UTC و Actor در Audit ثبت می‌شود."
                        onConfirm={() => void toggle(record)}
                        title={
                          record.status === 'active'
                            ? 'غیرفعال‌سازی مشتری'
                            : 'فعال‌سازی مشتری'
                        }
                        trigger={
                          <Button size="sm" variant="ghost">
                            {record.status === 'active'
                              ? 'غیرفعال‌سازی'
                              : 'فعال‌سازی'}
                          </Button>
                        }
                      />
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
