'use client';

import type {
  CustomerActivityEntry,
  CustomerAuditEntry,
  CustomerDetail,
  CustomerAddressType,
  CustomerConsentChannel,
  CustomerContactType,
  CustomerListMetrics,
  CustomerListQuery,
  CustomerMutationRequest,
  CustomerRelationshipType,
  CustomerRole,
  CustomerSummary,
  CustomerStatusHistoryEntry,
  DuplicateCandidate,
  MasterDataRecord,
} from '@rubi/contracts';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Download,
  Eye,
  FilePenLine,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Upload,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
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
  Skeleton,
} from '@/components/ui/surfaces';
import { masterDataApi } from '@/modules/master-data/api/client';
import { customersApi, CustomersApiError } from '../api/client';
import { contactDisplayValue } from '../model/customer';
import { formatCustomerDate } from '../model/customer-calendar';
import {
  customerImportHeaders,
  downloadCustomerXlsx,
  parseCustomerXlsx,
} from '../model/customer-xlsx';
import {
  CustomerDateField,
  type CustomerCalendarMode,
} from './customer-date-field';
import {
  buildCustomerConsentRequest,
  customerListFailureState,
  fetchCustomerConflictSnapshot,
} from './customer-workspace-state';

const pageSize = 20;
const exportPageSize = 100;
const emptyMetrics: CustomerListMetrics = {
  totalCustomers: 0,
  totalPassengers: 0,
  newCustomersLastThreeMonths: 0,
  returningCustomerRate: null,
  returningCustomerRateStatus: 'awaiting-sales-public-contract',
};

type RequestState =
  'loading' | 'ready' | 'error' | 'unauthorized' | 'forbidden';
type FormMode = 'create' | 'view' | 'edit';
type CustomerTab =
  | 'overview'
  | 'dossier'
  | 'contacts'
  | 'addresses'
  | 'consents'
  | 'companions'
  | 'status-history'
  | 'duplicates'
  | 'activity'
  | 'audit';

const customerTabs: readonly CustomerTab[] = [
  'overview',
  'dossier',
  'contacts',
  'addresses',
  'consents',
  'companions',
  'status-history',
  'duplicates',
  'activity',
  'audit',
];

const travelDocumentFields = [
  'پاسپورت',
  'نام انگلیسی مطابق پاسپورت (اجباری)',
  'نام خانوادگی انگلیسی مطابق پاسپورت (اجباری)',
  'شماره پاسپورت',
  'کشور صادرکننده',
  'تاریخ صدور',
  'تاریخ انقضا',
  'ویزا',
  'مدارک هویتی',
  'هشدار انقضای مدارک',
] as const;

function customerRoleLabel(roles: readonly CustomerRole[]) {
  const customer = roles.includes('customer');
  const passenger = roles.includes('passenger');
  if (customer && passenger) return 'مشتری و مسافر';
  return passenger ? 'مسافر' : 'مشتری';
}

const connectedDossierSections = [
  ['درخواست‌ها', 'امور مشتریان'],
  ['قراردادها', 'فروش'],
  ['خدمات خریداری‌شده', 'فروش'],
  ['بلیط‌ها', 'رزرواسیون'],
  ['واچرها', 'رزرواسیون'],
  ['بیمه‌نامه‌ها', 'رزرواسیون'],
  ['پرداخت‌ها', 'مالی'],
  ['چک‌ها', 'مالی'],
  ['تیکت‌های پشتیبانی', 'امور مشتریان'],
  ['فایل‌ها و اسناد', 'اسناد'],
] as const;

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

function safeCustomerId(value: string | null) {
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}

interface NewCompanionDraft {
  key: number;
  source: 'new' | 'primaryCustomer';
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  email: string;
  organizationId: string;
  relationshipType: CustomerRelationshipType;
}

let companionDraftKey = 0;

function emptyCompanionDraft(): NewCompanionDraft {
  companionDraftKey += 1;
  return {
    key: companionDraftKey,
    source: 'new',
    firstName: '',
    lastName: '',
    birthDate: '',
    phone: '',
    email: '',
    organizationId: '',
    relationshipType: 'companion',
  };
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
  customer: initialCustomer,
  activeTab,
  onTabChange,
  onClose,
  onSaved,
  calendarMode,
  onCalendarModeChange,
}: {
  mode: FormMode;
  customer?: CustomerDetail;
  activeTab: CustomerTab;
  onTabChange: (tab: CustomerTab) => void;
  onClose: () => void;
  onSaved: (message: string, detail: CustomerDetail) => Promise<void>;
  calendarMode: CustomerCalendarMode;
  onCalendarModeChange: (mode: CustomerCalendarMode) => void;
}) {
  const [draft, setDraft] = useState<CustomerMutationRequest>(() =>
    customerDraft(initialCustomer),
  );
  const [customer, setCustomer] = useState<CustomerDetail | undefined>(
    initialCustomer,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [conflictRefreshPending, setConflictRefreshPending] = useState(false);
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
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [newCompanions, setNewCompanions] = useState<NewCompanionDraft[]>([]);
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
  const [statusHistory, setStatusHistory] = useState<
    readonly CustomerStatusHistoryEntry[]
  >([]);
  const [activities, setActivities] = useState<
    readonly CustomerActivityEntry[]
  >([]);
  const [auditEvents, setAuditEvents] = useState<readonly CustomerAuditEntry[]>(
    [],
  );
  const [historyState, setHistoryState] = useState<RequestState>('loading');
  const [activityState, setActivityState] = useState<RequestState>('loading');
  const [auditState, setAuditState] = useState<RequestState>('loading');
  const readonly = mode === 'view';
  const displayedCustomer = revealedDetail ?? customer;

  const requestTimelines = useCallback(() => {
    if (!customer) return;
    void customersApi
      .statusHistory(customer.id)
      .then((response) => {
        setStatusHistory(response.data);
        setHistoryState('ready');
      })
      .catch((error: unknown) =>
        setHistoryState(
          error instanceof CustomersApiError && error.status === 403
            ? 'forbidden'
            : 'error',
        ),
      );
    void customersApi
      .activity(customer.id)
      .then((response) => {
        setActivities(response.data);
        setActivityState('ready');
      })
      .catch((error: unknown) =>
        setActivityState(
          error instanceof CustomersApiError && error.status === 403
            ? 'forbidden'
            : 'error',
        ),
      );
    void customersApi
      .audit(customer.id)
      .then((response) => {
        setAuditEvents(response.data);
        setAuditState('ready');
      })
      .catch((error: unknown) =>
        setAuditState(
          error instanceof CustomersApiError && error.status === 403
            ? 'forbidden'
            : 'error',
        ),
      );
  }, [customer]);

  useEffect(() => {
    requestTimelines();
  }, [requestTimelines]);

  const loadTimelines = useCallback(() => {
    setHistoryState('loading');
    setActivityState('loading');
    setAuditState('loading');
    requestTimelines();
  }, [requestTimelines]);

  useEffect(() => {
    if (!revealedDetail) return;
    const remask = () => {
      setRevealedDetail(null);
      setSensitiveReason('');
    };
    const timer = window.setTimeout(remask, 60_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') remask();
    };
    window.addEventListener('blur', remask);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('blur', remask);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [revealedDetail]);

  async function refreshAfterConflict(customerId: string) {
    const result = await fetchCustomerConflictSnapshot(
      customerId,
      draft,
      async (id) => (await customersApi.detail(id)).data,
    );
    setMessage(result.message);
    if (result.status === 'refreshed') {
      setCustomer(result.customer);
      setRevealedDetail(null);
      setConflictRefreshPending(false);
      return;
    }
    setConflictRefreshPending(true);
  }

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
          kind: 'person',
          status: 'active',
          role: 'all',
          branchId: 'all',
          acquaintanceMethodId: 'all',
          createdFrom: null,
          createdTo: null,
          updatedFrom: null,
          updatedTo: null,
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
      if (
        error instanceof CustomersApiError &&
        error.status === 409 &&
        customer
      ) {
        await refreshAfterConflict(customer.id);
      } else {
        setMessage(
          error instanceof Error ? error.message : 'عملیات ناموفق بود.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const primaryCustomerIsPassenger =
      mode === 'create' && newCompanions[0]?.source === 'primaryCustomer';
    const submittedDraft: CustomerMutationRequest = {
      ...draft,
      displayName:
        draft.kind === 'person'
          ? `${draft.firstName?.trim() ?? ''} ${draft.lastName?.trim() ?? ''}`.trim()
          : draft.displayName,
      roles: primaryCustomerIsPassenger
        ? Array.from(new Set([...draft.roles, 'passenger' as const]))
        : draft.roles,
    };
    if (customer) {
      await perform(
        () =>
          customersApi.update(customer.id, {
            ...submittedDraft,
            version: customer.version,
          }),
        'مشتری با موفقیت ویرایش شد.',
      );
    } else {
      setBusy(true);
      setMessage(null);
      try {
        let createdCustomer = (await customersApi.create(submittedDraft)).data;
        if (primaryPhone.trim()) {
          createdCustomer = (
            await customersApi.addContact(createdCustomer.id, {
              type: 'phone',
              value: primaryPhone.trim(),
              label: 'اصلی',
              isPrimary: true,
              version: createdCustomer.version,
            })
          ).data;
        }
        if (primaryEmail.trim()) {
          createdCustomer = (
            await customersApi.addContact(createdCustomer.id, {
              type: 'email',
              value: primaryEmail.trim().toLowerCase(),
              label: 'اصلی',
              isPrimary: !primaryPhone.trim(),
              version: createdCustomer.version,
            })
          ).data;
        }

        for (const companion of newCompanions) {
          if (companion.source === 'primaryCustomer') continue;
          let createdCompanion = (
            await customersApi.create({
              kind: 'person',
              firstName: companion.firstName.trim(),
              lastName: companion.lastName.trim(),
              displayName:
                `${companion.firstName.trim()} ${companion.lastName.trim()}`.trim(),
              organizationId: companion.organizationId || null,
              birthDate: companion.birthDate || null,
              roles: ['passenger'],
              acquaintanceMethodId: null,
            })
          ).data;
          const passengerId = createdCompanion.id;
          if (companion.phone.trim()) {
            createdCompanion = (
              await customersApi.addContact(createdCompanion.id, {
                type: 'phone',
                value: companion.phone.trim(),
                label: 'اصلی',
                isPrimary: true,
                version: createdCompanion.version,
              })
            ).data;
          }
          if (companion.email.trim()) {
            await customersApi.addContact(createdCompanion.id, {
              type: 'email',
              value: companion.email.trim().toLowerCase(),
              label: 'اصلی',
              isPrimary: !companion.phone.trim(),
              version: createdCompanion.version,
            });
          }
          createdCustomer = (
            await customersApi.addCompanion(createdCustomer.id, {
              relatedCustomerId: passengerId,
              relationshipType: companion.relationshipType,
              version: createdCustomer.version,
            })
          ).data;
        }

        const addedCompanionCount = newCompanions.filter(
          (companion) => companion.source === 'new',
        ).length;
        await onSaved(
          primaryCustomerIsPassenger && addedCompanionCount
            ? `مشتری به‌عنوان مسافر و ${addedCompanionCount.toLocaleString('fa-IR')} همراه ثبت شدند.`
            : primaryCustomerIsPassenger
              ? 'مشتری بدون ایجاد رکورد تکراری به‌عنوان مسافر ثبت شد.'
              : addedCompanionCount
                ? `مشتری و ${addedCompanionCount.toLocaleString('fa-IR')} مسافر همراه ثبت شدند.`
                : 'مشتری با موفقیت ایجاد شد.',
          createdCustomer,
        );
      } catch (error) {
        setMessage(
          `${error instanceof Error ? error.message : 'عملیات ناموفق بود.'} اگر بخشی از ثبت انجام شده، پیش از تلاش دوباره فهرست را بررسی کنید.`,
        );
      } finally {
        setBusy(false);
      }
    }
  }

  function resizeCompanions(count: number) {
    const safeCount = Math.max(0, Math.min(9, count));
    setNewCompanions((current) =>
      safeCount > current.length
        ? [
            ...current,
            ...Array.from(
              { length: safeCount - current.length },
              emptyCompanionDraft,
            ),
          ]
        : current.slice(0, safeCount),
    );
  }

  function updateCompanion(
    index: number,
    patch: Partial<Omit<NewCompanionDraft, 'key'>>,
  ) {
    setNewCompanions((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function handleEnterNavigation(event: KeyboardEvent<HTMLFormElement>) {
    if (
      mode !== 'create' ||
      event.key !== 'Enter' ||
      !(event.target instanceof HTMLInputElement)
    )
      return;
    event.preventDefault();
    const inputs = Array.from(
      event.currentTarget.querySelectorAll<HTMLInputElement>(
        'input:not([disabled])',
      ),
    ).filter((input) => input.type !== 'hidden');
    const currentIndex = inputs.indexOf(event.target);
    const nextInput = inputs[currentIndex + 1];
    if (nextInput) nextInput.focus();
    else event.currentTarget.requestSubmit();
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
      requestTimelines();
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
    const result = buildCustomerConsentRequest({
      status,
      channel: consentChannel,
      source: consentSource,
      reason: consentReason,
      version: customer.version,
    });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    await perform(
      () => customersApi.addConsent(customer.id, result.request),
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
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="start-auto left-1/2 max-h-[calc(100dvh-2rem)] max-w-[60rem] overflow-x-hidden overflow-y-auto p-6">
        <DialogTitle>
          {mode === 'create'
            ? 'ایجاد مشتری'
            : mode === 'edit'
              ? `ویرایش پرونده ${customerRoleLabel(draft.roles)}`
              : `پرونده ۳۶۰ درجه ${customerRoleLabel(draft.roles)}`}
        </DialogTitle>
        <DialogDescription>
          {mode === 'create'
            ? 'اطلاعات مشتری و مسافران همراه را وارد کنید.'
            : `اطلاعات کامل این ${customerRoleLabel(draft.roles)} را مشاهده و مدیریت کنید.`}
        </DialogDescription>
        <div aria-live="polite" role="status">
          {message ? (
            <Alert
              className="mt-4"
              description={message}
              title="نتیجه عملیات"
            />
          ) : null}
          {conflictRefreshPending && customer ? (
            <Button
              className="mt-3"
              disabled={busy}
              onClick={() => void refreshAfterConflict(customer.id)}
              size="sm"
              type="button"
              variant="outline"
            >
              تلاش دوباره برای دریافت نسخه جدید
            </Button>
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

        <form
          className="mt-5 space-y-4"
          onKeyDown={handleEnterNavigation}
          onSubmit={submit}
        >
          {mode === 'create' ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>۱ · اطلاعات مشتری حقیقی</Badge>
                <Badge>۲ · مسافران همراه</Badge>
                <span className="text-xs text-muted-foreground">
                  Enter شما را به ورودی بعدی می‌برد.
                </span>
              </div>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="نوع پرونده">
              <div className="flex h-11 items-center rounded-xl border border-primary/25 bg-primary/5 px-3">
                <Badge>
                  {draft.kind === 'person'
                    ? customerRoleLabel(draft.roles)
                    : 'رکورد سازمانی قدیمی'}
                </Badge>
              </div>
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
                    required
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
                    required
                    value={draft.lastName ?? ''}
                  />
                </FormField>
                <CustomerDateField
                  disabled={readonly}
                  id="customer-birth-date"
                  label="تاریخ تولد"
                  mode={calendarMode}
                  onModeChange={onCalendarModeChange}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      birthDate: value || null,
                    }))
                  }
                  value={draft.birthDate ?? ''}
                />
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
            <FormField label="نقش">
              {mode === 'create' ? (
                <div className="flex h-11 items-center rounded-xl border border-primary/25 bg-primary/5 px-3">
                  <Badge>مشتری</Badge>
                </div>
              ) : (
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
              )}
            </FormField>
            {mode === 'create' ? (
              <>
                <FormField
                  description="در فهرست فقط به‌صورت Masked نمایش داده می‌شود."
                  id="customer-primary-phone"
                  label="شماره تماس اصلی"
                >
                  <Input
                    dir="ltr"
                    id="customer-primary-phone"
                    inputMode="tel"
                    onChange={(event) => setPrimaryPhone(event.target.value)}
                    pattern="\+?[0-9]{10,15}"
                    placeholder="09xxxxxxxxx"
                    type="tel"
                    value={primaryPhone}
                  />
                </FormField>
                <FormField
                  description="اختیاری و در نمایش عادی Masked"
                  id="customer-primary-email"
                  label="ایمیل مشتری"
                >
                  <Input
                    autoComplete="email"
                    dir="ltr"
                    id="customer-primary-email"
                    inputMode="email"
                    onChange={(event) => setPrimaryEmail(event.target.value)}
                    placeholder="customer@example.com"
                    type="email"
                    value={primaryEmail}
                  />
                </FormField>
              </>
            ) : null}
          </div>
          {mode === 'create' ? (
            <Card className="space-y-4 border-primary/20 bg-primary/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold">مسافران همراه</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    برای مسافر شماره ۱ می‌توانید اطلاعات همین مشتری را استفاده
                    کنید تا دوباره وارد نشود.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    aria-label="کم‌کردن تعداد مسافران"
                    disabled={newCompanions.length === 0}
                    onClick={() => resizeCompanions(newCompanions.length - 1)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    −
                  </Button>
                  <Input
                    aria-label="تعداد مسافران همراه"
                    className="w-20 text-center"
                    max={9}
                    min={0}
                    onChange={(event) =>
                      resizeCompanions(Number(event.target.value))
                    }
                    type="number"
                    value={newCompanions.length}
                  />
                  <Button
                    aria-label="اضافه‌کردن مسافر"
                    disabled={newCompanions.length === 9}
                    onClick={() => resizeCompanions(newCompanions.length + 1)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
              {newCompanions.length === 0 ? (
                <EmptyState
                  description="در صورت وجود همراه، تعداد مسافران را افزایش دهید."
                  title="بدون مسافر همراه"
                />
              ) : (
                <div className="space-y-3">
                  {newCompanions.map((companion, index) => (
                    <Card
                      className="grid gap-3 p-4 sm:grid-cols-2"
                      key={companion.key}
                    >
                      <div className="flex items-center justify-between sm:col-span-2">
                        <p className="font-bold">
                          مسافر همراه {(index + 1).toLocaleString('fa-IR')}
                        </p>
                        <Button
                          onClick={() =>
                            setNewCompanions((current) =>
                              current.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          حذف
                        </Button>
                      </div>
                      {index === 0 ? (
                        <FormField label="روش افزودن مسافر">
                          <Select
                            onValueChange={(value) =>
                              updateCompanion(index, {
                                source: value as 'new' | 'primaryCustomer',
                              })
                            }
                            value={companion.source}
                          >
                            <SelectTrigger aria-label="روش افزودن مسافر 1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">
                                ثبت مسافر جدید
                              </SelectItem>
                              <SelectItem value="primaryCustomer">
                                انتخاب همین مشتری به‌عنوان مسافر
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormField>
                      ) : null}
                      {companion.source === 'primaryCustomer' ? (
                        <>
                          <FormField
                            id={`companion-${companion.key}-first-name`}
                            label="نام"
                          >
                            <Input
                              disabled
                              id={`companion-${companion.key}-first-name`}
                              value={draft.firstName ?? ''}
                            />
                          </FormField>
                          <FormField
                            id={`companion-${companion.key}-last-name`}
                            label="نام خانوادگی"
                          >
                            <Input
                              disabled
                              id={`companion-${companion.key}-last-name`}
                              value={draft.lastName ?? ''}
                            />
                          </FormField>
                          <CustomerDateField
                            disabled
                            id={`companion-${companion.key}-birth-date`}
                            label="تاریخ تولد"
                            mode={calendarMode}
                            onModeChange={onCalendarModeChange}
                            onChange={() => undefined}
                            value={draft.birthDate ?? ''}
                          />
                          <FormField label="شماره تماس اصلی">
                            <Input disabled dir="ltr" value={primaryPhone} />
                          </FormField>
                          <FormField label="ایمیل مشتری">
                            <Input disabled dir="ltr" value={primaryEmail} />
                          </FormField>
                          <Alert
                            className="sm:col-span-2"
                            description="اطلاعات بالای فرم خودکار استفاده می‌شود و همین رکورد مشتری، بدون ساخت رکورد تکراری، نقش مسافر هم می‌گیرد."
                            title="بدون ورود دوباره اطلاعات"
                          />
                        </>
                      ) : (
                        <>
                          <FormField
                            id={`companion-${companion.key}-first-name`}
                            label="نام"
                            required
                          >
                            <Input
                              id={`companion-${companion.key}-first-name`}
                              onChange={(event) =>
                                updateCompanion(index, {
                                  firstName: event.target.value,
                                })
                              }
                              required
                              value={companion.firstName}
                            />
                          </FormField>
                          <FormField
                            id={`companion-${companion.key}-last-name`}
                            label="نام خانوادگی"
                            required
                          >
                            <Input
                              id={`companion-${companion.key}-last-name`}
                              onChange={(event) =>
                                updateCompanion(index, {
                                  lastName: event.target.value,
                                })
                              }
                              required
                              value={companion.lastName}
                            />
                          </FormField>
                          <div className="border-t border-border pt-3 sm:col-span-2">
                            <p className="font-semibold">
                              اطلاعات تکمیلی مسافر
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              این اطلاعات همراه پرونده واقعی مسافر ذخیره می‌شود.
                            </p>
                          </div>
                          <CustomerDateField
                            id={`companion-${companion.key}-birth-date`}
                            label="تاریخ تولد"
                            mode={calendarMode}
                            onModeChange={onCalendarModeChange}
                            onChange={(value) =>
                              updateCompanion(index, { birthDate: value })
                            }
                            value={companion.birthDate}
                          />
                          <FormField
                            description="اختیاری و در نمایش عادی Masked"
                            id={`companion-${companion.key}-phone`}
                            label="شماره تماس"
                          >
                            <Input
                              dir="ltr"
                              id={`companion-${companion.key}-phone`}
                              inputMode="tel"
                              onChange={(event) =>
                                updateCompanion(index, {
                                  phone: event.target.value,
                                })
                              }
                              pattern="\+?[0-9]{10,15}"
                              placeholder="09xxxxxxxxx"
                              type="tel"
                              value={companion.phone}
                            />
                          </FormField>
                          <FormField
                            description="اختیاری و در نمایش عادی Masked"
                            id={`companion-${companion.key}-email`}
                            label="ایمیل مسافر"
                          >
                            <Input
                              autoComplete="email"
                              dir="ltr"
                              id={`companion-${companion.key}-email`}
                              inputMode="email"
                              onChange={(event) =>
                                updateCompanion(index, {
                                  email: event.target.value,
                                })
                              }
                              placeholder="passenger@example.com"
                              type="email"
                              value={companion.email}
                            />
                          </FormField>
                          <FormField label="سازمان مسافر">
                            <Select
                              onValueChange={(value) =>
                                updateCompanion(index, {
                                  organizationId:
                                    value === 'not-selected' ? '' : value,
                                })
                              }
                              value={companion.organizationId || 'not-selected'}
                            >
                              <SelectTrigger
                                aria-label={`سازمان مسافر ${index + 1}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="not-selected">
                                  مسافر شخصی
                                </SelectItem>
                                {masters.organizations.map((organization) => (
                                  <SelectItem
                                    key={organization.id}
                                    value={organization.id}
                                  >
                                    {organization.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormField>
                        </>
                      )}
                      <FormField label="رابطه با مشتری">
                        <Select
                          onValueChange={(value) =>
                            updateCompanion(index, {
                              relationshipType:
                                value as CustomerRelationshipType,
                            })
                          }
                          value={companion.relationshipType}
                        >
                          <SelectTrigger
                            aria-label={`نوع رابطه مسافر ${index + 1}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="family">خانواده</SelectItem>
                            <SelectItem value="companion">
                              همراه مشتری (پیش‌فرض)
                            </SelectItem>
                            <SelectItem value="guardian">سرپرست</SelectItem>
                            <SelectItem value="dependent">تحت تکفل</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormField>
                      <Alert
                        className="sm:col-span-2"
                        description="نام و نام خانوادگی انگلیسی، شماره پاسپورت، کشور صادرکننده و تاریخ‌های صدور/انقضا پس از فعال‌شدن نگهداری امن مدارک در همین بخش قابل ثبت خواهند بود."
                        title="مدارک سفر مسافر"
                        tone="warning"
                      />
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          ) : null}
          {!readonly ? (
            <Button className="w-full sm:w-auto" disabled={busy} type="submit">
              {mode === 'create'
                ? newCompanions.length
                  ? 'ثبت مشتری و مسافران همراه'
                  : 'ثبت مشتری'
                : 'ذخیره با کنترل نسخه'}
            </Button>
          ) : null}
        </form>

        {customer ? (
          <Tabs
            className="mt-6"
            dir="rtl"
            onValueChange={(value) => {
              const tab = value as CustomerTab;
              if (tab !== 'contacts') {
                setRevealedDetail(null);
                setSensitiveReason('');
              }
              onTabChange(tab);
            }}
            value={activeTab}
          >
            <TabsList className="flex w-full flex-wrap justify-start">
              <TabsTrigger value="overview">نمای کلی</TabsTrigger>
              <TabsTrigger value="dossier">پرونده ۳۶۰ درجه</TabsTrigger>
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
                  <p className="text-xs text-muted-foreground">وضعیت</p>
                  <Badge>
                    {customer.status === 'active' ? 'فعال' : 'غیرفعال'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">نوع پرونده</p>
                  <p className="text-sm">
                    {customer.roles.includes('passenger') &&
                    customer.organizationId
                      ? 'مسافر سازمانی'
                      : customer.roles.includes('passenger')
                        ? 'مسافر شخصی'
                        : 'مشتری حقیقی'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">تاریخ ایجاد</p>
                  <p>{formatCustomerDate(customer.createdAt, calendarMode)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">آخرین ویرایش</p>
                  <p>{formatCustomerDate(customer.updatedAt, calendarMode)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShoppingBag className="size-4 text-primary" />
                    آخرین تاریخ خرید مشتری
                  </p>
                  <p className="mt-1 font-semibold">—</p>
                  <p className="text-xs text-muted-foreground">
                    در انتظار قرارداد عمومی Customer Purchase Summary از Sales
                  </p>
                </div>
              </Card>
              <Alert
                description="نام لاتین، جنسیت و یادداشت در Schema و customers.v2 موجود نیستند و برای CUSTOMER-002B مسدود ثبت شده‌اند."
                title="قابلیت‌های نیازمند قرارداد"
                tone="warning"
              />
            </TabsContent>
            <TabsContent className="space-y-4" value="dossier">
              <Card className="space-y-4 p-4">
                <div>
                  <p className="font-bold">مدارک سفر و هویتی</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    اطلاعات حساس مدارک فقط با نگهداری رمزنگاری‌شده، دسترسی مجاز
                    و ثبت مشاهده نمایش داده می‌شود.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {travelDocumentFields.map((field) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3"
                      key={field}
                    >
                      <span className="text-sm font-medium">{field}</span>
                      <Badge className="bg-muted text-muted-foreground">
                        در انتظار زیرساخت مدارک
                      </Badge>
                    </div>
                  ))}
                </div>
                <Alert
                  description="مدل امن پاسپورت، ویزا و هشدار انقضا هنوز در پایگاه داده مشتریان وجود ندارد؛ تا تکمیل آن هیچ شماره مدرک یا تاریخ ساختگی نمایش داده نمی‌شود."
                  title="حفاظت از مدارک مسافر"
                  tone="warning"
                />
              </Card>

              <Card className="space-y-4 p-4">
                <div>
                  <p className="font-bold">سوابق کامل پرونده</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    هر بخش پس از اتصال امن به سامانه مالک خود، اطلاعات واقعی
                    همین مشتری یا مسافر را نشان می‌دهد.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {connectedDossierSections.map(([label, owner]) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-xl border p-3"
                      key={label}
                    >
                      <div>
                        <p className="text-sm font-semibold">{label}</p>
                        <p className="text-xs text-muted-foreground">{owner}</p>
                      </div>
                      <Badge className="bg-muted text-muted-foreground">
                        در انتظار اتصال امن
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-bold">Timeline کامل فعالیت‌ها</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    اکنون {activities.length.toLocaleString('fa-IR')} فعالیت
                    واقعی از بخش مشتریان در دسترس است؛ رویدادهای سایر بخش‌ها پس
                    از اتصال امن به همین Timeline افزوده می‌شوند.
                  </p>
                </div>
                <Button
                  onClick={() => onTabChange('activity')}
                  type="button"
                  variant="outline"
                >
                  مشاهده Timeline
                </Button>
              </Card>
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
                      maxLength={500}
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
                      placeholder="نام یا تماس ماسک‌شده"
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
                              {record.displayName}
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
            <TabsContent className="space-y-3" value="status-history">
              {historyState === 'loading' ? (
                <Skeleton className="h-24 w-full" />
              ) : historyState === 'forbidden' ? (
                <EmptyState
                  description="مجوز مشاهده تاریخچه این مشتری وجود ندارد."
                  icon={Ban}
                  title="دسترسی محدود"
                />
              ) : historyState === 'error' ? (
                <ErrorState
                  action={
                    <Button onClick={() => void loadTimelines()} size="sm">
                      تلاش دوباره
                    </Button>
                  }
                  description="دریافت تاریخچه وضعیت ناموفق بود."
                  title="خطا در Timeline"
                />
              ) : statusHistory.length === 0 ? (
                <EmptyState
                  description="برای این مشتری تغییر وضعیتی ثبت نشده است."
                  title="تاریخچه وضعیت خالی است"
                />
              ) : (
                statusHistory.map((entry) => (
                  <Card className="p-3" key={entry.id}>
                    <p className="font-bold">
                      {entry.fromStatus === 'none'
                        ? 'ایجاد فعال'
                        : `${entry.fromStatus === 'active' ? 'فعال' : 'غیرفعال'} ← ${entry.toStatus === 'active' ? 'فعال' : 'غیرفعال'}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.reason} · {entry.actor.displayName} ·{' '}
                      {new Date(entry.occurredAt).toLocaleString('fa-IR')}
                    </p>
                  </Card>
                ))
              )}
            </TabsContent>
            <TabsContent className="space-y-3" value="activity">
              {activityState === 'loading' ? (
                <Skeleton className="h-24 w-full" />
              ) : activityState === 'forbidden' ? (
                <EmptyState
                  description="مجوز مشاهده Timeline این مشتری وجود ندارد."
                  icon={Ban}
                  title="دسترسی محدود"
                />
              ) : activityState === 'error' ? (
                <ErrorState
                  action={
                    <Button onClick={() => void loadTimelines()} size="sm">
                      تلاش دوباره
                    </Button>
                  }
                  description="دریافت فعالیت‌های واقعی Customers ناموفق بود."
                  title="خطا در Timeline"
                />
              ) : activities.length === 0 ? (
                <EmptyState
                  description="فعالیت واقعی قابل نمایش برای این مشتری وجود ندارد."
                  title="Timeline خالی است"
                />
              ) : (
                activities.map((entry) => (
                  <Card className="p-3" key={entry.id}>
                    <p className="font-bold">{entry.title}</p>
                    <p className="text-sm">{entry.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.actor.displayName} ·{' '}
                      {new Date(entry.occurredAt).toLocaleString('fa-IR')}
                    </p>
                  </Card>
                ))
              )}
              <Alert
                description="رویدادهای Lead/Ticket، Sales و Reservations فقط پس از ارائه قرارداد عمومی مالک همان ماژول قابل اضافه‌شدن‌اند؛ هیچ query مستقیم یا داده ساختگی استفاده نشده است."
                title="مرز Timeline بین‌ماژولی"
                tone="warning"
              />
            </TabsContent>
            <TabsContent className="space-y-3" value="audit">
              {auditState === 'loading' ? (
                <Skeleton className="h-24 w-full" />
              ) : auditState === 'forbidden' ? (
                <EmptyState
                  description="نمایش Audit به مجوز iam.audit.read نیاز دارد."
                  icon={Ban}
                  title="دسترسی Audit وجود ندارد"
                />
              ) : auditState === 'error' ? (
                <ErrorState
                  action={
                    <Button onClick={() => void loadTimelines()} size="sm">
                      تلاش دوباره
                    </Button>
                  }
                  description="دریافت Audit امن ناموفق بود."
                  title="خطا در Audit"
                />
              ) : auditEvents.length === 0 ? (
                <EmptyState
                  description="رخداد Audit قابل نمایش وجود ندارد."
                  title="Audit خالی است"
                />
              ) : (
                auditEvents.map((entry) => (
                  <Card className="p-3" key={entry.id}>
                    <p className="font-mono text-sm" dir="ltr">
                      {entry.action}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.actor.displayName} · {entry.reason ?? 'بدون دلیل'}{' '}
                      · {new Date(entry.occurredAt).toLocaleString('fa-IR')}
                    </p>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        ) : null}

        <div className="mt-6 flex justify-end">
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              بستن
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCustomerId = safeCustomerId(searchParams.get('customerId'));
  const initialTab = searchParams.get('tab');
  const [records, setRecords] = useState<readonly CustomerSummary[]>([]);
  const [metrics, setMetrics] = useState<CustomerListMetrics>(emptyMetrics);
  const [requestState, setRequestState] = useState<RequestState>('loading');
  const [search, setSearch] = useState('');
  const kind = 'person' as const;
  const [calendarMode, setCalendarMode] = useState<CustomerCalendarMode>(
    () =>
      (searchParams.get('calendar') === 'gregorian'
        ? 'gregorian'
        : 'persian') as CustomerCalendarMode,
  );
  const [status, setStatus] = useState<CustomerListQuery['status']>(() => {
    const value = searchParams.get('status');
    return value === 'active' || value === 'inactive' ? value : 'all';
  });
  const [role, setRole] = useState<CustomerListQuery['role']>(() => {
    const value = searchParams.get('role');
    return value === 'customer' || value === 'passenger' ? value : 'all';
  });
  const [acquaintanceMethodId, setAcquaintanceMethodId] = useState(
    () => searchParams.get('acquaintanceMethodId') ?? 'all',
  );
  const [acquaintanceMethods, setAcquaintanceMethods] = useState<
    readonly MasterDataRecord[]
  >([]);
  const [createdFrom, setCreatedFrom] = useState(
    () => searchParams.get('createdFrom') ?? '',
  );
  const [createdTo, setCreatedTo] = useState(
    () => searchParams.get('createdTo') ?? '',
  );
  const [sortBy, setSortBy] = useState<CustomerListQuery['sortBy']>(() => {
    const value = searchParams.get('sortBy');
    return value === 'displayName' || value === 'createdAt'
      ? value
      : 'updatedAt';
  });
  const [sortDirection, setSortDirection] = useState<
    CustomerListQuery['sortDirection']
  >(() => (searchParams.get('sortDirection') === 'asc' ? 'asc' : 'desc'));
  const [page, setPage] = useState(() =>
    Math.max(1, Number(searchParams.get('page')) || 1),
  );
  const [total, setTotal] = useState(0);
  const [formMode, setFormMode] = useState<FormMode | null>(() =>
    initialCustomerId ? 'view' : null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialCustomerId,
  );
  const [selected, setSelected] = useState<CustomerDetail | undefined>();
  const [activeTab, setActiveTab] = useState<CustomerTab>(() =>
    customerTabs.includes(initialTab as CustomerTab)
      ? (initialTab as CustomerTab)
      : 'overview',
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void listMasterData('acquaintance-methods')
      .then((response) => setAcquaintanceMethods(response.data))
      .catch(() => setAcquaintanceMethods([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('kind', kind);
    params.set('calendar', calendarMode);
    params.set('status', status);
    params.set('role', role);
    params.set('acquaintanceMethodId', acquaintanceMethodId);
    if (createdFrom) params.set('createdFrom', createdFrom);
    if (createdTo) params.set('createdTo', createdTo);
    params.set('sortBy', sortBy);
    params.set('sortDirection', sortDirection);
    params.set('page', String(page));
    if (selectedId) {
      params.set('customerId', selectedId);
      params.set('tab', activeTab);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [
    acquaintanceMethodId,
    activeTab,
    calendarMode,
    createdFrom,
    createdTo,
    kind,
    page,
    pathname,
    role,
    router,
    selectedId,
    sortBy,
    sortDirection,
    status,
  ]);

  const load = useCallback(async () => {
    setRequestState('loading');
    try {
      const response = await customersApi.list({
        search,
        kind,
        status,
        role,
        branchId: 'all',
        acquaintanceMethodId,
        createdFrom: createdFrom || null,
        createdTo: createdTo || null,
        sortBy,
        sortDirection,
        page,
        pageSize,
      });
      setRecords(response.data);
      setTotal(response.meta.total);
      setMetrics(response.meta.metrics);
      setRequestState('ready');
    } catch (error) {
      setRecords([]);
      setMetrics(emptyMetrics);
      setRequestState(customerListFailureState(error));
    }
  }, [
    acquaintanceMethodId,
    createdFrom,
    createdTo,
    kind,
    page,
    role,
    search,
    sortBy,
    sortDirection,
    status,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function open(mode: FormMode, id?: string) {
    if (id) {
      setSelected(undefined);
      setSelectedId(id);
      setActiveTab('overview');
      setFormMode(mode);
      try {
        setSelected((await customersApi.detail(id)).data);
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : 'دریافت Customer 360 ناموفق بود.',
        );
        setFormMode(null);
        setSelectedId(null);
        return;
      }
    } else {
      setSelected(undefined);
      setSelectedId(null);
    }
    setFormMode(mode);
  }

  useEffect(() => {
    if (!selectedId || selected?.id === selectedId) return;
    let active = true;
    void customersApi
      .detail(selectedId)
      .then((response) => {
        if (active) setSelected(response.data);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setNotice(
          error instanceof Error
            ? error.message
            : 'دریافت Deep Link مشتری ناموفق بود.',
        );
        setFormMode(null);
        setSelectedId(null);
      });
    return () => {
      active = false;
    };
  }, [selected, selectedId]);

  async function refreshAfter(message: string) {
    setNotice(message);
    setFormMode(null);
    setSelectedId(null);
    setSelected(undefined);
    await load();
  }

  async function toggle(record: CustomerSummary) {
    try {
      await customersApi.status(record.id, {
        status: record.status === 'active' ? 'inactive' : 'active',
        version: record.version,
        reason:
          record.status === 'active'
            ? 'manual-deactivation'
            : 'manual-activation',
      });
      setNotice('وضعیت مشتری با Audit و کنترل نسخه تغییر کرد.');
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'تغییر وضعیت ناموفق بود.',
      );
    }
  }

  async function exportFilteredCustomers() {
    setExporting(true);
    setNotice(null);
    try {
      const exportQuery = {
        search,
        kind,
        status,
        role,
        branchId: 'all' as const,
        acquaintanceMethodId,
        createdFrom: createdFrom || null,
        createdTo: createdTo || null,
        sortBy,
        sortDirection,
        page: 1,
        pageSize: exportPageSize,
      };
      const firstPage = await customersApi.list(exportQuery);
      const exportRecords = [...firstPage.data];
      const exportPageCount = Math.ceil(firstPage.meta.total / exportPageSize);
      for (let exportPage = 2; exportPage <= exportPageCount; exportPage += 1) {
        const response = await customersApi.list({
          ...exportQuery,
          page: exportPage,
        });
        exportRecords.push(...response.data);
      }
      const rows = exportRecords.map((record) => [
        record.displayName,
        record.maskedPrimaryContact ?? 'بدون تماس',
        record.status === 'active' ? 'فعال' : 'غیرفعال',
        record.roles
          .map((item) => (item === 'customer' ? 'مشتری' : 'مسافر'))
          .join('، '),
        record.currentConsentStatus === 'granted'
          ? 'ثبت‌شده'
          : record.currentConsentStatus === 'revoked'
            ? 'لغوشده'
            : 'ثبت‌نشده',
        formatCustomerDate(record.createdAt, calendarMode),
        formatCustomerDate(record.updatedAt, calendarMode),
      ]);
      downloadCustomerXlsx(
        `customers-${new Date().toISOString().slice(0, 10)}.xlsx`,
        [
          [
            'نام مشتری',
            'شماره تماس (ماسک‌شده)',
            'وضعیت',
            'نقش‌ها',
            'رضایت',
            'تاریخ ایجاد',
            'آخرین تغییر',
          ],
          ...rows,
        ],
      );
      setNotice(
        `خروجی XLSX همه ${exportRecords.length.toLocaleString('fa-IR')} رکورد مطابق فیلترهای فعال همراه با شماره تماس ماسک‌شده ساخته شد.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'ساخت خروجی کامل مشتریان ناموفق بود.',
      );
    } finally {
      setExporting(false);
    }
  }

  async function importCustomers(file: File) {
    setImporting(true);
    setNotice(null);
    try {
      const rows = await parseCustomerXlsx(file);
      let imported = 0;
      const failures: string[] = [];
      const warnings: string[] = [];
      setImportProgress({ completed: 0, total: rows.length });
      for (const [index, row] of rows.entries()) {
        const nameParts = row.name.split(/\s+/).filter(Boolean);
        if (nameParts.length < 2) {
          failures.push(
            `ردیف ${index + 2}: نام باید شامل نام و نام خانوادگی باشد.`,
          );
          continue;
        }
        if (row.phone && !/^\+?[0-9]{10,15}$/.test(row.phone)) {
          failures.push(`ردیف ${index + 2}: شماره تماس معتبر نیست.`);
          continue;
        }
        const emailIsValid =
          !row.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email);
        if (!emailIsValid)
          warnings.push(`ردیف ${index + 2}: ایمیل نامعتبر نادیده گرفته شد.`);
        if (row.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.birthDate)) {
          failures.push(`ردیف ${index + 2}: تاریخ باید YYYY-MM-DD باشد.`);
          continue;
        }
        const lastName = nameParts.at(-1)!;
        const firstName = nameParts.slice(0, -1).join(' ');
        try {
          let created = (
            await customersApi.create({
              kind: 'person',
              firstName,
              lastName,
              displayName: row.name,
              birthDate: row.birthDate || null,
              roles: ['customer'],
              acquaintanceMethodId: null,
            })
          ).data;
          if (row.phone) {
            created = (
              await customersApi.addContact(created.id, {
                type: 'phone',
                value: row.phone,
                label: 'اصلی',
                isPrimary: true,
                version: created.version,
              })
            ).data;
          }
          if (row.email && emailIsValid)
            await customersApi.addContact(created.id, {
              type: 'email',
              value: row.email.toLowerCase(),
              label: 'اصلی',
              isPrimary: !row.phone,
              version: created.version,
            });
          imported += 1;
        } catch (error) {
          if (error instanceof CustomersApiError && error.status === 401)
            throw new Error(
              `نشست ورود منقضی شد؛ عملیات پس از ${imported.toLocaleString('fa-IR')} ثبت متوقف شد. دوباره وارد شوید و فایل ادامه را استفاده کنید.`,
            );
          failures.push(
            `ردیف ${index + 2}: ${error instanceof Error ? error.message : 'ثبت ناموفق بود.'}`,
          );
        }
        if ((index + 1) % 10 === 0 || index === rows.length - 1)
          setImportProgress({ completed: index + 1, total: rows.length });
      }
      await load();
      setNotice(
        `${imported.toLocaleString('fa-IR')} مشتری وارد شد.${failures.length ? ` ${failures.length.toLocaleString('fa-IR')} ردیف خطا داشت: ${failures.slice(0, 3).join(' | ')}` : ''}${warnings.length ? ` ایمیل نامعتبر در ${warnings.length.toLocaleString('fa-IR')} ردیف نادیده گرفته شد.` : ''}`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'خواندن فایل XLSX ناموفق بود.',
      );
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="مشتریان و مسافران" />
      <section
        aria-label="شاخص‌های مشتریان"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Card className="border-blue-300/60 bg-gradient-to-br from-blue-500/20 via-blue-100/60 to-surface p-4 dark:via-blue-950/40">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">
              تعداد کل مشتریان
            </p>
            <UserRound className="size-5 text-primary" />
          </div>
          <p className="mt-3 text-3xl font-black">
            {requestState === 'loading'
              ? '…'
              : metrics.totalCustomers.toLocaleString('fa-IR')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            اشخاص حقیقی مطابق فیلترهای فعال
          </p>
        </Card>
        <Card className="border-cyan-300/60 bg-gradient-to-br from-cyan-500/20 via-cyan-100/60 to-surface p-4 dark:via-cyan-950/40">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">
              تعداد کل مسافران
            </p>
            <UsersRound className="size-5 text-primary" />
          </div>
          <p className="mt-3 text-3xl font-black">
            {requestState === 'loading'
              ? '…'
              : metrics.totalPassengers.toLocaleString('fa-IR')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            شخصی و سازمانی مطابق فیلترها
          </p>
        </Card>
        <Card className="border-emerald-300/60 bg-gradient-to-br from-emerald-500/20 via-emerald-100/60 to-surface p-4 dark:via-emerald-950/40">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">
              مشتریان جدید سه ماه اخیر
            </p>
            <TrendingUp className="size-5 text-primary" />
          </div>
          <p className="mt-3 text-3xl font-black">
            {requestState === 'loading'
              ? '…'
              : metrics.newCustomersLastThreeMonths.toLocaleString('fa-IR')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            بازه سه‌ماهه UTC و فیلترهای فعال
          </p>
        </Card>
        <Card className="border-amber-300/60 bg-gradient-to-br from-amber-500/20 via-amber-100/60 to-surface p-4 dark:via-amber-950/40">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">
              نرخ بازگشت مشتری
            </p>
            <ShoppingBag className="size-5 text-primary" />
          </div>
          <p className="mt-3 text-3xl font-black">
            {metrics.returningCustomerRate === null
              ? '—'
              : `${metrics.returningCustomerRate.toLocaleString('fa-IR')}٪`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            در انتظار قرارداد عمومی خرید از Sales
          </p>
        </Card>
      </section>
      <Card className="flex flex-col gap-4 border-primary/25 bg-primary/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-bold">ثبت مشتری و مسافران همراه</p>
          <p className="mt-1 text-sm text-muted-foreground">
            اطلاعات مشتری، شماره تماس و همراهان را در یک جریان مرحله‌ای وارد
            کنید.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={records.length === 0 || exporting}
            onClick={() => void exportFilteredCustomers()}
            size="lg"
            variant="outline"
          >
            <Download className="size-4" />
            {exporting ? 'در حال ساخت خروجی کامل…' : 'خروجی Excel'}
          </Button>
          <Button
            onClick={() =>
              downloadCustomerXlsx('customer-import-template.xlsx', [
                customerImportHeaders,
              ])
            }
            size="lg"
            variant="outline"
          >
            <Download className="size-4" />
            دانلود قالب ورود
          </Button>
          <Button
            disabled={importing}
            onClick={() => importInputRef.current?.click()}
            size="lg"
            type="button"
            variant="outline"
          >
            <Upload className="size-4" />
            {importing && importProgress
              ? `در حال ورود ${importProgress.completed.toLocaleString('fa-IR')} از ${importProgress.total.toLocaleString('fa-IR')}`
              : importing
                ? 'در حال آماده‌سازی…'
                : 'ورود از Excel'}
          </Button>
          <input
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={importing}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void importCustomers(file);
              event.currentTarget.value = '';
            }}
            ref={importInputRef}
            tabIndex={-1}
            type="file"
          />
          <Button onClick={() => void open('create')} size="lg">
            <Plus className="size-4" />
            بازکردن فرم ثبت
          </Button>
        </div>
      </Card>
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
        <FormField label="نحوه آشنایی">
          <Select
            onValueChange={(value) => {
              setAcquaintanceMethodId(value);
              setPage(1);
            }}
            value={acquaintanceMethodId}
          >
            <SelectTrigger aria-label="فیلتر نحوه آشنایی">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه روش‌ها</SelectItem>
              {acquaintanceMethods.map((record) => (
                <SelectItem key={record.id} value={record.id}>
                  {record.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <CustomerDateField
          id="customer-created-from"
          label="ایجاد از تاریخ"
          mode={calendarMode}
          onModeChange={setCalendarMode}
          onChange={(value) => {
            setCreatedFrom(value);
            setPage(1);
          }}
          value={createdFrom}
        />
        <CustomerDateField
          id="customer-created-to"
          label="ایجاد تا تاریخ"
          mode={calendarMode}
          onModeChange={setCalendarMode}
          onChange={(value) => {
            setCreatedTo(value);
            setPage(1);
          }}
          value={createdTo}
        />
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
        <FormField label="جهت مرتب‌سازی">
          <Select
            onValueChange={(value) => {
              setSortDirection(value as CustomerListQuery['sortDirection']);
              setPage(1);
            }}
            value={sortDirection}
          >
            <SelectTrigger aria-label="جهت مرتب‌سازی">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">نزولی</SelectItem>
              <SelectItem value="asc">صعودی</SelectItem>
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
                <th className="p-4 text-start">مشتری یا مسافر</th>
                <th className="p-4 text-start">شماره همراه (ماسک‌شده)</th>
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
                    <button
                      aria-label={`بازکردن پرونده ۳۶۰ ${customerRoleLabel(record.roles)} ${record.displayName}`}
                      className="group flex items-center gap-3 rounded-xl text-start outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={() => void open('view', record.id)}
                      type="button"
                    >
                      <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                        <UserRound className="size-5" />
                      </span>
                      <div>
                        <p className="font-bold text-primary group-hover:underline">
                          {record.displayName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          بازکردن پرونده ۳۶۰ {customerRoleLabel(record.roles)}
                        </p>
                      </div>
                    </button>
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-muted-foreground" dir="ltr">
                      {record.maskedPrimaryContact ?? 'بدون تماس'}
                    </span>
                  </td>
                  <td className="p-4">
                    <Badge className="me-1">
                      {record.status === 'active' ? 'فعال' : 'غیرفعال'}
                    </Badge>
                    {record.roles.map((item) => (
                      <Badge className="me-1" key={item}>
                        {item === 'customer'
                          ? 'مشتری'
                          : record.organizationId
                            ? 'مسافر سازمانی'
                            : 'مسافر شخصی'}
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
                    {formatCustomerDate(record.updatedAt, calendarMode)}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => void open('view', record.id)}
                        size="sm"
                        variant="outline"
                      >
                        <Eye className="size-4" />
                        پرونده ۳۶۰
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
                            ? 'غیرفعال‌سازی پرونده شخص'
                            : 'فعال‌سازی پرونده شخص'
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          صفحه {page.toLocaleString('fa-IR')} از{' '}
          {Math.max(1, Math.ceil(total / pageSize)).toLocaleString('fa-IR')} ·{' '}
          {total.toLocaleString('fa-IR')} نفر ·{' '}
          {pageSize.toLocaleString('fa-IR')} نفر در هر صفحه
        </p>
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
      {formMode && (formMode === 'create' || selected) ? (
        <CustomerDrawer
          activeTab={activeTab}
          calendarMode={calendarMode}
          key={`${formMode}-${selected?.id ?? 'new'}-${selected?.version ?? 0}`}
          mode={formMode}
          onClose={() => {
            setFormMode(null);
            setSelectedId(null);
            setSelected(undefined);
            setActiveTab('overview');
          }}
          onCalendarModeChange={setCalendarMode}
          onSaved={refreshAfter}
          onTabChange={setActiveTab}
          {...(selected ? { customer: selected } : {})}
        />
      ) : formMode ? (
        <Dialog open>
          <DialogContent className="start-auto left-1/2 max-w-[60rem] overflow-hidden p-6">
            <DialogTitle>در حال دریافت اطلاعات مشتری</DialogTitle>
            <DialogDescription>
              اطلاعات مجاز Customer 360 در حال بارگذاری است.
            </DialogDescription>
            <div
              aria-label="در حال دریافت Customer 360"
              className="mt-5 space-y-3"
            >
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-40 w-full" />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
