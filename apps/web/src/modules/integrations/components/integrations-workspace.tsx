'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  canViewScreen,
  canViewIntegrationSection,
  visibleIntegrationSections,
  type AuthenticatedActor,
  type BranchReference,
  type IntegrationExistingAdapterV1,
  type IntegrationRegistryV1,
  type IntegrationRegistryWriteV1,
  type IntegrationSystemConfigV1,
} from '@nora/contracts';
import {
  Activity,
  ArrowLeft,
  Building2,
  Cable,
  ChevronLeft,
  Globe2,
  Plus,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui/surfaces';
import { useAccessActor } from '@/modules/iam/access-context';
import { integrationsApi, IntegrationsApiError } from '../api/client';
import {
  catalogueSystems,
  domainLabels,
  lifecycleLabels,
  systemSalesState,
  type IntegrationSection,
} from '../model';
import { CatalogueEditor, type CatalogueEdit } from './catalogue-editor';
import { BrandsDashboard } from './brands-dashboard';
import { IntegrationNavigation } from './integration-navigation';
import { ConnectionReadiness } from './connection-readiness';
import { NiyayeshData } from './niyayesh-data';
import { SiteRegistrationDialog } from './site-registration-dialog';
import {
  authenticationLabels,
  environmentLabels,
  protocolLabels,
} from '../site-registration';

function errorMessage(error: unknown) {
  if (error instanceof IntegrationsApiError) {
    if (error.status === 401) return 'برای ادامه باید وارد سامانه شوید.';
    if (error.status === 403)
      return 'مجوز سامانه یا شعبه برای این عملیات وجود ندارد.';
    if (error.status === 409)
      return 'فهرست هم‌زمان تغییر کرده است؛ فرم را ببندید و دوباره بارگذاری کنید.';
  }
  return error instanceof Error
    ? error.message
    : 'ارتباط با مرکز یکپارچه‌سازی برقرار نشد.';
}

export function IntegrationsWorkspace() {
  const actor = useAccessActor();
  if (!actor) return <Skeleton className="h-96" />;
  if (
    !canViewScreen(actor.permissions, 'integrations.home') ||
    !visibleIntegrationSections(actor.permissions).length
  )
    return (
      <Alert
        title="دسترسی مجاز نیست"
        description="مجوز مشاهده یکپارچه‌سازی‌ها را ندارید."
        tone="error"
      />
    );
  const context = [
    actor.userId,
    [...actor.branchIds].sort().join(','),
    [...actor.permissions].sort().join(','),
  ].join('|');
  return <IntegrationWorkspaceBody key={context} actor={actor} />;
}

export function IntegrationWorkspaceBody({
  actor,
}: {
  actor: AuthenticatedActor;
}) {
  const [branches, setBranches] = useState<BranchReference[]>([]);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [branchId, setBranchId] = useState('');
  const [data, setData] = useState<IntegrationRegistryV1 | null>(null);
  const [adapters, setAdapters] = useState<IntegrationExistingAdapterV1[]>([]);
  const allowedSections = visibleIntegrationSections(actor.permissions);
  const [section, setSection] = useState<IntegrationSection>(
    () => allowedSections[0] ?? 'brands',
  );
  const [managingCatalogue, setManagingCatalogue] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<CatalogueEdit | null>(null);
  const [siteForm, setSiteForm] = useState<{
    system?: IntegrationSystemConfigV1;
  } | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState('');
  const [listedOnly, setListedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const loadSequence = useRef(0);

  const authorizedBranchIds = actor.branchIds.join(',');
  useEffect(() => {
    let active = true;
    void integrationsApi
      .branches()
      .then((rows) => {
        if (!active) return;
        const allowed = rows.filter((row) =>
          authorizedBranchIds.split(',').includes(row.id),
        );
        setBranches(allowed);
        setBranchId(allowed[0]?.id ?? '');
        setBranchesLoaded(true);
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [authorizedBranchIds]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!branchId) return;
      const sequence = ++loadSequence.current;
      setLoading(true);
      setError('');
      try {
        const [registry, adapters] = await Promise.all([
          integrationsApi.read(branchId, signal, section),
          canViewIntegrationSection(actor.permissions, 'connections')
            ? integrationsApi.adapters(signal)
            : Promise.resolve([]),
        ]);
        if (signal?.aborted || sequence !== loadSequence.current) return;
        setData(registry);
        setAdapters(adapters);
      } catch (cause) {
        if (!signal?.aborted && sequence === loadSequence.current)
          setError(errorMessage(cause));
      } finally {
        if (!signal?.aborted && sequence === loadSequence.current)
          setLoading(false);
      }
    },
    [branchId, section, actor.permissions],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      loadSequence.current += 1;
    };
  }, [load]);

  async function persist(input?: IntegrationRegistryWriteV1) {
    setBusy(true);
    setError('');
    try {
      const next = input
        ? await integrationsApi.write(branchId, input)
        : await integrationsApi.initialize(branchId);
      setData(next);
      setEdit(null);
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function save(input?: IntegrationRegistryWriteV1) {
    await persist(input);
  }
  function openSite(system?: IntegrationSystemConfigV1) {
    setError('');
    setSiteForm(system ? { system } : {});
  }
  const system = data?.systems.find((row) => row.id === selectedSystem);
  function changeSection(next: IntegrationSection) {
    if (!allowedSections.includes(next)) {
      setError('مجوز مشاهده این بخش یکپارچه‌سازی را ندارید.');
      return;
    }
    if (next !== section) {
      loadSequence.current += 1;
      setData(null);
    }
    setSelectedSystem(null);
    setManagingCatalogue(false);
    setSection(next);
    setListedOnly(false);
    setBrandFilter('');
    setSearch('');
  }
  return (
    <div dir="rtl" className="grid gap-5">
      <PageHeader
        title="یکپارچه‌سازی‌ها"
        actions={
          <div className="flex items-center gap-2">
            <NativeSearchSelect
              aria-label="شعبه مجاز"
              value={branchId}
              disabled={busy || !!edit || !!siteForm}
              onChange={(event) => {
                loadSequence.current += 1;
                setData(null);
                setSelectedSystem(null);
                setManagingCatalogue(false);
                setBrandFilter('');
                setBranchId(event.target.value);
              }}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </NativeSearchSelect>
            <Button
              aria-label="بارگذاری دوباره"
              variant="outline"
              type="button"
              disabled={!branchId || busy || loading || !!edit}
              onClick={() => void load()}
            >
              <RefreshCw className="size-4" />
            </Button>
            {data?.canManage ? (
              <Button
                type="button"
                disabled={busy || !!edit || !!siteForm}
                onClick={() => openSite()}
              >
                <Plus className="size-4" />
                افزودن سایت
              </Button>
            ) : null}
          </div>
        }
      />
      <p className="text-sm leading-7 text-muted-foreground">
        مرکز برندها، سامانه‌ها و اتصال‌های بیرونی مجموعه
      </p>
      <IntegrationNavigation
        section={section}
        disabled={!!edit || !!siteForm || busy}
        onChange={changeSection}
        allowedSections={allowedSections}
      />
      {error ? (
        <Alert title="عملیات کامل نشد" description={error} tone="error" />
      ) : null}
      {!branchId ? (
        error ? null : branchesLoaded && branches.length === 0 ? (
          <EmptyState
            title="شعبه مجاز تعریف نشده است"
            description="برای مدیریت این بخش به دسترسی یک شعبه نیاز دارید."
          />
        ) : (
          <Skeleton className="h-72" />
        )
      ) : null}
      {branchId && !data && !error ? <Skeleton className="h-72" /> : null}
      {data ? (
        <>
          {siteForm ? (
            <SiteRegistrationDialog
              data={data}
              {...(siteForm.system ? { system: siteForm.system } : {})}
              busy={busy}
              error={error}
              onClose={() => setSiteForm(null)}
              onSave={async (input, id) => {
                if (await persist(input)) {
                  setSiteForm(null);
                  setSelectedSystem(id);
                  setManagingCatalogue(false);
                }
              }}
            />
          ) : null}
          {!data.initialized ? (
            <Alert
              title="فهرست اولیه هنوز ذخیره نشده است"
              description="جهان باستان، نیایش سیر، قسطی روو و جهان آکادمی، گزینه‌های اولیه قابل ویرایش هستند."
            >
              {data.canManage ? (
                <Button
                  className="mt-3"
                  disabled={busy}
                  onClick={() => void save()}
                  type="button"
                >
                  ایجاد فهرست اولیه
                </Button>
              ) : (
                <p className="mt-2 text-sm">
                  ایجاد فهرست به تیک تنظیمات اتصال و دسترسی، مجوز مدیریت تنظیمات
                  و مجوز ویرایش فهرست در مدیریت کاربران نیاز دارد.
                </p>
              )}
            </Alert>
          ) : null}
          {edit ? (
            <CatalogueEditor
              key={`${edit.kind}:${edit.record ? ('id' in edit.record ? edit.record.id : edit.record.code) : 'new'}`}
              edit={edit}
              registry={data}
              busy={busy}
              onCancel={() => setEdit(null)}
              onSave={save}
            />
          ) : null}
          {edit ? null : system ? (
            <SystemDetail
              key={system.id}
              branchId={branchId}
              system={system}
              data={data}
              allowedSections={allowedSections}
              onBack={() => setSelectedSystem(null)}
              onEdit={() => setEdit({ kind: 'system', record: system })}
              onSetup={() => openSite(system)}
            />
          ) : (
            <>
              {section === 'connections' ? (
                <NiyayeshData key={branchId} branchId={branchId} />
              ) : null}
              {section === 'overview' ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      ['برندهای در فهرست', data.counts?.brands, 'brands'],
                      ['سامانه‌های در فهرست', data.counts?.systems, 'brands'],
                      [
                        'سامانه‌های منتظر اتصال',
                        data.counts?.awaitingConnection,
                        'connections',
                      ],
                    ].map(([label, count, target]) => (
                      <button
                        type="button"
                        key={String(label)}
                        disabled={
                          !allowedSections.includes(
                            target as IntegrationSection,
                          )
                        }
                        className="rounded-2xl border border-border bg-surface p-5 text-start shadow-sm hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                        onClick={() => {
                          changeSection(target as IntegrationSection);
                          setListedOnly(true);
                        }}
                      >
                        <span className="text-sm text-muted-foreground">
                          {label}
                        </span>
                        <strong className="my-3 block text-3xl">
                          {typeof count === 'number'
                            ? count.toLocaleString('fa-IR')
                            : 'داده موجود نیست'}
                        </strong>
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          مشاهده جزئیات
                          <ChevronLeft className="size-3" />
                        </span>
                      </button>
                    ))}
                  </div>
                  <Card className="grid gap-4 p-5 sm:grid-cols-2">
                    <div>
                      <h2 className="font-bold">عملیات منتظر اقدام</h2>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        مشخصات اتصال، دسترسی بیرونی و مستندات API سامانه‌ها هنوز
                        ارائه نشده است.
                      </p>
                      <Button
                        variant="outline"
                        className="mt-3"
                        type="button"
                        disabled={!allowedSections.includes('connections')}
                        onClick={() => changeSection('connections')}
                      >
                        بررسی اتصال‌ها
                      </Button>
                    </div>
                    <div>
                      <h2 className="font-bold">روند و مقایسه عملکرد</h2>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        داده موجود نیست؛ پس از اتصال منبع معتبر، روند و مقایسه
                        هر سامانه نمایش داده می‌شود.
                      </p>
                      <Badge className="mt-3">
                        آکادمی از فروش مستقیم سفر جداست
                      </Badge>
                    </div>
                  </Card>
                </>
              ) : null}
              {section === 'brands' && !managingCatalogue ? (
                <BrandsDashboard
                  key={data.branchId}
                  data={data}
                  onOpen={setSelectedSystem}
                  onSection={changeSection}
                  allowedSections={allowedSections}
                  onManage={() => setManagingCatalogue(true)}
                  {...(data.canManage ? { onCreate: () => openSite() } : {})}
                />
              ) : null}
              {section === 'brands' && managingCatalogue ? (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">
                      مدیریت فهرست برندها و سامانه‌ها
                    </h2>
                    <Button
                      variant="outline"
                      onClick={() => setManagingCatalogue(false)}
                    >
                      بازگشت به نمای برندها
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-48 flex-1">
                      <FormField
                        id="integration-search"
                        label="جست‌وجوی سامانه"
                      >
                        <Input
                          id="integration-search"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                        />
                      </FormField>
                    </div>
                    <div className="min-w-48">
                      <FormField id="integration-filter" label="فیلتر برند">
                        <NativeSearchSelect
                          id="integration-filter"
                          aria-label="فیلتر برند"
                          value={brandFilter}
                          onChange={(event) =>
                            setBrandFilter(event.target.value)
                          }
                        >
                          <option value="">همه برندها</option>
                          {data.brands.map((brand) => (
                            <option key={brand.id} value={brand.id}>
                              {brand.name}
                            </option>
                          ))}
                        </NativeSearchSelect>
                      </FormField>
                    </div>
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={listedOnly}
                        onChange={(event) =>
                          setListedOnly(event.target.checked)
                        }
                      />
                      فقط موارد در فهرست
                    </label>
                    {data.initialized && data.canManage ? (
                      <>
                        <Button
                          variant="outline"
                          type="button"
                          disabled={!!edit}
                          onClick={() => setEdit({ kind: 'brand' })}
                        >
                          افزودن برند
                        </Button>
                        <Button
                          type="button"
                          disabled={!!edit || !data.brands.length}
                          onClick={() => openSite()}
                        >
                          افزودن سامانه
                        </Button>
                      </>
                    ) : null}
                  </div>
                  <div className="grid gap-5 lg:grid-cols-2">
                    {data.brands
                      .filter(
                        (brand) =>
                          (!brandFilter || brand.id === brandFilter) &&
                          (!listedOnly || brand.lifecycle === 'ENABLED'),
                      )
                      .map((brand) => (
                        <div
                          key={brand.id}
                          className="grid content-start gap-3"
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <Building2 className="size-5 text-primary" />
                            <h2 className="font-bold">{brand.name}</h2>
                            <Badge>{lifecycleLabels[brand.lifecycle]}</Badge>
                            {data.canManage ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={!!edit}
                                onClick={() =>
                                  setEdit({ kind: 'brand', record: brand })
                                }
                              >
                                ویرایش برند
                              </Button>
                            ) : null}
                          </div>
                          <div className="grid gap-4">
                            {catalogueSystems(data, brand.id, listedOnly)
                              .filter((row) =>
                                `${row.name} ${row.code} ${row.kind}`
                                  .toLowerCase()
                                  .includes(search.trim().toLowerCase()),
                              )
                              .map((row) => (
                                <SystemCard
                                  key={row.id}
                                  system={row}
                                  onOpen={() => setSelectedSystem(row.id)}
                                />
                              ))}
                          </div>
                          {!catalogueSystems(data, brand.id).length ? (
                            <p className="text-sm text-muted-foreground">
                              سامانه‌ای برای این برند ثبت نشده است.
                            </p>
                          ) : null}
                        </div>
                      ))}
                  </div>
                  {data.brands.length > 0 &&
                  !catalogueSystems(
                    data,
                    brandFilter || undefined,
                    listedOnly,
                  ).some((row) =>
                    `${row.name} ${row.code} ${row.kind}`
                      .toLowerCase()
                      .includes(search.trim().toLowerCase()),
                  ) ? (
                    <EmptyState
                      title="نتیجه‌ای برای این فیلتر پیدا نشد"
                      description="عبارت جست‌وجو یا فیلتر برند را تغییر دهید."
                    />
                  ) : null}
                  {!data.brands.length ? (
                    <EmptyState
                      title="برندی ثبت نشده است"
                      description="پس از ایجاد فهرست، برند و سامانه جدید را اضافه کنید."
                    />
                  ) : null}
                </>
              ) : null}
              {section === 'connections' ? (
                <>
                  <ConnectionReadiness />
                  <h2 className="text-lg font-bold">مسیرهای تخصصی موجود</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {adapters.map((adapter) => (
                      <Card key={adapter.code} className="p-5">
                        <Cable className="mb-3 size-6 text-primary" />
                        <h2 className="font-bold">{adapter.title}</h2>
                        <Badge className="mt-3">
                          مسیر موجود؛ اتصال زنده تأیید نشده
                        </Badge>
                        <p className="mt-3 text-sm text-muted-foreground">
                          {adapter.owner === 'Integrations'
                            ? 'ارسال سفارش و دریافت پیام امضاشده تأمین‌کننده'
                            : 'ثبت تیکت و استعلام وضعیت از سایت‌ها'}
                        </p>
                      </Card>
                    ))}
                  </div>
                  <SystemList
                    data={data}
                    onOpen={setSelectedSystem}
                    listedOnly={listedOnly}
                  />
                </>
              ) : null}
              {section === 'events' ? (
                <EmptyState
                  title="دریافت رویداد عمومی فعال نشده است"
                  description="اتصال هر سامانه به دریافت امضاشده، کنترل تکرار و سابقه تحویل نیاز دارد. مسیر موجود پیام تأمین‌کننده مستقل حفظ شده است."
                />
              ) : null}
              {section === 'mapping' ? (
                <>
                  <Card className="p-5">
                    <h2 className="font-bold">
                      گردش داده بین سامانه و ماژول مسئول
                    </h2>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                      <Badge>سامانه مبدأ</Badge>
                      <ArrowLeft className="size-4" />
                      <Badge>اعتبارسنجی و نگاشت</Badge>
                      <ArrowLeft className="size-4" />
                      <Badge>قرارداد عمومی ماژول مسئول</Badge>
                    </div>
                  </Card>
                  <EmptyState
                    title="نگاشت خارجی ثبت نشده است"
                    description="شناسه‌های مشتری، قرارداد، رزرو و پرداخت پس از دریافت قرارداد معتبر منبع نگاشت می‌شوند؛ مالکیت داده نزد ماژول مسئول باقی می‌ماند."
                  />
                </>
              ) : null}
              {section === 'sync' ? (
                <EmptyState
                  title="همگام‌سازی پیکربندی نشده است"
                  description="منبع داده، جهت انتقال، زمان‌بندی و نقطه ادامه باید برای هر اتصال مشخص شود. هنوز اجرایی برای نمایش وجود ندارد."
                />
              ) : null}
              {section === 'health' ? (
                <>
                  <Alert
                    title="سلامت اتصال هنوز سنجیده نشده است"
                    description="آماده بودن ساختار به معنی برقراری اتصال نیست؛ آزمون سلامت پس از پیکربندی واقعی فعال می‌شود."
                  />
                  <SystemList data={data} onOpen={setSelectedSystem} />
                </>
              ) : null}
              {section === 'logs' ? (
                <>
                  <Card className="p-5">
                    <h2 className="font-bold">آخرین تغییر ثبت‌شده تنظیمات</h2>
                    {data.lastChange ? (
                      <div className="mt-3 grid gap-2 text-sm">
                        <p>{data.lastChange.reason}</p>
                        <p className="text-muted-foreground">
                          {new Date(data.lastChange.occurredAt).toLocaleString(
                            'fa-IR',
                            { timeZone: 'Asia/Tehran' },
                          )}
                        </p>
                        <p className="text-muted-foreground">
                          نسخه فهرست: {data.version.toLocaleString('fa-IR')}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        تغییری ثبت نشده است.
                      </p>
                    )}
                  </Card>
                  <EmptyState
                    title="سابقه تحویل بیرونی در دسترس نیست"
                    description="سوابق تنظیمات با هر ذخیره حفظ می‌شوند؛ لاگ تحویل، تلاش مجدد و خطا پس از اتصال منبع واقعی اضافه می‌شود."
                  />
                </>
              ) : null}
              {section === 'settings' ? (
                <>
                  <Card className="grid gap-3 p-5">
                    <div className="flex items-center gap-2">
                      <Settings2 className="size-5 text-primary" />
                      <h2 className="font-bold">دسترسی و تنظیمات اتصال</h2>
                    </div>
                    <p className="text-sm leading-7 text-muted-foreground">
                      دسترسی با کاربر و شعبه مجاز RUBI کنترل می‌شود. مدیریت
                      خارجی و ورود یکپارچه پس از بررسی قابلیت واقعی سامانه تنظیم
                      می‌شوند.
                    </p>
                    <Badge className="w-fit">
                      مدیریت خارجی و SSO تنظیم نشده است
                    </Badge>
                  </Card>
                  <Card className="grid gap-4 p-5">
                    <div className="flex items-center justify-between">
                      <h2 className="font-bold">قابلیت‌های قابل تنظیم</h2>
                      {data.initialized && data.canManage ? (
                        <Button
                          type="button"
                          disabled={!!edit}
                          onClick={() => setEdit({ kind: 'capability' })}
                        >
                          افزودن قابلیت
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      این فهرست برنامه اتصال را مشخص می‌کند؛ پشتیبانی عملیاتی پس
                      از تأیید API ثبت می‌شود.
                    </p>
                    {data.capabilities.map((row) => (
                      <div
                        key={row.code}
                        className="flex flex-wrap items-center gap-3 border-t border-border pt-3"
                      >
                        <span className="flex-1">{row.name}</span>
                        <Badge>{lifecycleLabels[row.lifecycle]}</Badge>
                        {data.canManage ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!!edit}
                            onClick={() =>
                              setEdit({ kind: 'capability', record: row })
                            }
                          >
                            ویرایش قابلیت
                          </Button>
                        ) : null}
                      </div>
                    ))}
                    {!data.capabilities.length ? (
                      <p className="text-sm text-muted-foreground">
                        قابلیتی تعریف نشده است.
                      </p>
                    ) : null}
                  </Card>
                </>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

function SystemCard({
  system,
  onOpen,
}: {
  system: IntegrationSystemConfigV1;
  onOpen: () => void;
}) {
  return (
    <Card className="grid gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-2">
          <Globe2 className="size-6 text-primary" />
          <h3 className="font-bold">{system.name}</h3>
          <p className="text-sm text-muted-foreground">
            {system.kind} · {domainLabels[system.businessDomain]}
          </p>
        </div>
        <Badge>{lifecycleLabels[system.lifecycle]}</Badge>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-3 text-sm">
        <Activity className="size-4 text-muted-foreground" />
        {system.lifecycle === 'ENABLED'
          ? 'آماده اتصال'
          : lifecycleLabels[system.lifecycle]}
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">فروش مستقیم سفر</span>
        <span>{systemSalesState(system)}</span>
      </div>
      <Button variant="outline" type="button" onClick={onOpen}>
        مدیریت سامانه
        <ChevronLeft className="size-4" />
      </Button>
    </Card>
  );
}
function SystemList({
  data,
  onOpen,
  listedOnly = false,
}: {
  data: IntegrationRegistryV1;
  onOpen: (id: string) => void;
  listedOnly?: boolean;
}) {
  const systems = catalogueSystems(data, undefined, listedOnly);
  return systems.length ? (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {systems.map((system) => (
        <SystemCard
          key={system.id}
          system={system}
          onOpen={() => onOpen(system.id)}
        />
      ))}
    </div>
  ) : (
    <EmptyState
      title="سامانه‌ای ثبت نشده است"
      description="فهرست سامانه‌ها را از بخش برندها و سامانه‌ها ایجاد کنید."
    />
  );
}
function SystemDetail({
  branchId,
  system,
  data,
  onBack,
  onEdit,
  onSetup,
  allowedSections,
}: {
  branchId: string;
  system: IntegrationSystemConfigV1;
  data: IntegrationRegistryV1;
  onBack: () => void;
  onEdit: () => void;
  onSetup: () => void;
  allowedSections: readonly IntegrationSection[];
}) {
  const [area, setArea] = useState(
    allowedSections.includes('connections') ? 'data' : 'settings',
  );
  return (
    <Card className="grid gap-5 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Globe2 className="size-6 text-primary" />
        <div className="flex-1">
          <h2 className="text-xl font-bold">{system.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.brands.find((brand) => brand.id === system.brandId)?.name} ·{' '}
            {system.kind}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onBack}>
          بازگشت به فهرست
        </Button>
      </div>
      <nav aria-label="مدیریت سامانه" className="flex flex-wrap gap-2">
        {[
          ['data', 'آمار، اطلاعات و ورود فایل'],
          ['settings', 'مشخصات سامانه'],
          ['connection', 'اتصال'],
          ['sync', 'همگام‌سازی'],
          ['health', 'سلامت'],
          ['history', 'سوابق'],
        ]
          .filter(
            ([id]) =>
              id === 'settings' ||
              allowedSections.includes(
                (id === 'connection' || id === 'data'
                  ? 'connections'
                  : id === 'history'
                    ? 'logs'
                    : id) as IntegrationSection,
              ),
          )
          .map(([id, title]) => (
            <Button
              key={id}
              type="button"
              variant={area === id ? 'primary' : 'outline'}
              aria-pressed={area === id}
              onClick={() => setArea(id!)}
            >
              {title}
            </Button>
          ))}
      </nav>
      {area === 'data' ? (
        <NiyayeshData branchId={branchId} expectedSystemId={system.id} />
      ) : area === 'settings' ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge>{domainLabels[system.businessDomain]}</Badge>
            <Badge>{lifecycleLabels[system.lifecycle]}</Badge>
            {system.capabilityCodes.map((code) => (
              <Badge key={code}>
                {data.capabilities.find((row) => row.code === code)?.name}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            فروش مستقیم سفر: {systemSalesState(system)}
          </p>
          {data.canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={onSetup}>
                راه‌اندازی سایت
              </Button>
              <Button type="button" variant="outline" onClick={onEdit}>
                ویرایش سامانه
              </Button>
            </div>
          ) : null}
          {system.setup ? (
            <div className="grid gap-3 rounded-xl border border-border p-4 text-sm">
              <h3 className="font-bold">مشخصات راه‌اندازی</h3>
              {system.setup.websiteUrl ? (
                <p>
                  نشانی سایت:{' '}
                  <bdi className="break-all">{system.setup.websiteUrl}</bdi>
                </p>
              ) : null}
              <p>محیط اتصال: {environmentLabels[system.setup.environment]}</p>
              <p>روش ارتباط: {protocolLabels[system.setup.protocol]}</p>
              <p>
                روش احراز هویت:{' '}
                {authenticationLabels[system.setup.authentication]}
              </p>
              {system.setup.apiBaseUrl ? (
                <p>
                  نشانی پایه API:{' '}
                  <bdi className="break-all">{system.setup.apiBaseUrl}</bdi>
                </p>
              ) : null}
              {system.setup.documentationUrl ? (
                <p>
                  مستندات اتصال:{' '}
                  <bdi className="break-all">
                    {system.setup.documentationUrl}
                  </bdi>
                </p>
              ) : null}
              <Badge className="w-fit">ارتباط هنوز تأیید نشده است</Badge>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          title={
            area === 'health'
              ? 'سلامت سنجیده نشده است'
              : area === 'history'
                ? 'سابقه عملیاتی موجود نیست'
                : 'اتصال تنظیم نشده است'
          }
          description={
            area === 'history'
              ? 'سابقه تنظیمات در فهرست نسخه‌دار حفظ می‌شود؛ سابقه تحویل بیرونی پس از اتصال نمایش داده می‌شود.'
              : 'مشخصات و دسترسی واقعی سامانه در مرحله بعد اضافه می‌شود.'
          }
        />
      )}
    </Card>
  );
}
