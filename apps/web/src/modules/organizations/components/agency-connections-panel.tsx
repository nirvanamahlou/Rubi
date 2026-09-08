'use client';

import type {
  B2bAgencyWorkspaceV1,
  BranchReference,
  MasterDataRecord,
  IamPermissionCode,
} from '@rubi/contracts';
import { CreditCard, FileText, MapPin, Percent, RefreshCw } from 'lucide-react';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/form-controls';
import { Alert, Badge, Card, Skeleton } from '@/components/ui/surfaces';
import { masterDataApi } from '@/modules/master-data/api/client';
import { agencyClient, B2bApiError } from '../api/agency-client';
import { moneyLabel, agreementLabel } from '../model/presentation';

function value(form: FormData, key: string) {
  return String(form.get(key) ?? '').trim();
}

function optionLabel(record: MasterDataRecord) {
  return `${record.name} (${record.code})`;
}

function formatMoney(amount: string, currencyCode: string) {
  return moneyLabel(amount, currencyCode);
}

export function AgencyConnectionsPanel({
  organizationId,
}: {
  organizationId: string;
}) {
  const [branches, setBranches] = useState<readonly BranchReference[]>([]);
  const [branchId, setBranchId] = useState('');
  const [workspace, setWorkspace] = useState<B2bAgencyWorkspaceV1>();
  const [countries, setCountries] = useState<readonly MasterDataRecord[]>([]);
  const [cities, setCities] = useState<readonly MasterDataRecord[]>([]);
  const [countryId, setCountryId] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [permissions, setPermissions] = useState<readonly IamPermissionCode[]>(
    [],
  );
  const requestId = useRef(0);
  const activeBranchRef = useRef('');
  const invalidateRequests = useCallback(() => {
    ++requestId.current;
  }, []);
  const [section, setSection] = useState('overview');

  const load = useCallback(
    async (requestedBranch?: string) => {
      const current = ++requestId.current;
      setLoading(true);
      setError(undefined);
      try {
        const session = await agencyClient.session();
        if (current !== requestId.current) return;
        const availableBranches = session.branches;
        setPermissions(session.permissions);
        const activeBranch =
          requestedBranch ||
          activeBranchRef.current ||
          availableBranches[0]?.id ||
          '';
        if (!activeBranch)
          throw new Error('هیچ شعبه مجازی برای کاربر وجود ندارد.');
        setBranches(availableBranches);
        setBranchId(activeBranch);
        activeBranchRef.current = activeBranch;
        const response = await agencyClient.workspace(
          organizationId,
          activeBranch,
        );
        if (current !== requestId.current) return;
        setWorkspace(response.data);
      } catch (caught) {
        if (current !== requestId.current) return;
        setWorkspace(undefined);
        setError(
          caught instanceof B2bApiError && caught.status === 401
            ? 'نشست شما معتبر نیست؛ دوباره وارد سامانه شوید.'
            : caught instanceof B2bApiError && caught.status === 403
              ? 'مجوز مشاهده پرونده تجاری یا دسترسی به این شعبه را ندارید.'
              : caught instanceof Error
                ? caught.message
                : 'دریافت اتصال‌های عملیاتی آژانس ناموفق بود.',
        );
      } finally {
        if (current === requestId.current) setLoading(false);
      }
    },
    [organizationId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      invalidateRequests();
    };
  }, [load, invalidateRequests]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      masterDataApi.list('countries', {
        search: '',
        status: 'active',
        sortBy: 'name',
        sortDirection: 'asc',
        page: 1,
        pageSize: 100,
      }),
      masterDataApi.list('cities', {
        search: '',
        status: 'active',
        sortBy: 'name',
        sortDirection: 'asc',
        page: 1,
        pageSize: 100,
      }),
    ])
      .then(([countryResponse, cityResponse]) => {
        if (cancelled) return;
        setCountries(countryResponse.data);
        setCities(cityResponse.data);
        setCountryId(countryResponse.data[0]?.id ?? '');
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : 'دریافت فهرست کشور و شهر ناموفق بود.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const matchingCities = useMemo(
    () =>
      cities.filter(
        (city) => String(city.attributes.countryId ?? '') === countryId,
      ),
    [cities, countryId],
  );

  async function mutate(action: () => Promise<unknown>, success: string) {
    setPending(true);
    setError(undefined);
    try {
      await action();
      setMessage(success);
      await load(branchId);
    } catch (caught) {
      setError(
        caught instanceof B2bApiError &&
          caught.status === 409 &&
          (caught.code === 'CONFLICT' ||
            caught.code?.includes('VERSION_CONFLICT'))
          ? 'اطلاعات هم‌زمان تغییر کرده است. ورودی‌های شما حفظ شده‌اند؛ پیش از تلاش دوباره نسخه جدید را بررسی کنید.'
          : caught instanceof Error
            ? caught.message
            : 'ثبت اطلاعات ناموفق بود.',
      );
    } finally {
      setPending(false);
    }
  }

  async function submitAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      () =>
        masterDataApi.createOrganizationAddress(organizationId, {
          countryId: value(form, 'countryId'),
          cityId: value(form, 'cityId'),
          label: value(form, 'label'),
          postalCode: value(form, 'postalCode') || null,
          addressLine: value(form, 'addressLine'),
          isPrimary: true,
          displayOrder: 0,
          isActive: true,
        }),
      'آدرس پایه آژانس ثبت شد.',
    );
  }

  async function submitAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      () =>
        agencyClient.createAgreement(organizationId, {
          branchId,
          title: value(form, 'title'),
          startsAt: value(form, 'startsAt'),
          endsAt: value(form, 'endsAt') || null,
          status: 'DRAFT',
          notes: value(form, 'notes') || null,
        }),
      'قرارداد تجاری آژانس ثبت شد.',
    );
  }

  async function submitCredit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      () =>
        agencyClient.upsertCreditPolicy(organizationId, {
          branchId,
          creditLimit: value(form, 'creditLimit'),
          currencyCode: value(form, 'currencyCode').toUpperCase(),
          effectiveFrom: value(form, 'effectiveFrom'),
          expiresAt: value(form, 'expiresAt') || null,
          isActive: true,
          ...(workspace?.creditPolicy
            ? { version: workspace.creditPolicy.version }
            : {}),
        }),
      'سیاست اعتبار آژانس ثبت شد.',
    );
  }

  async function submitRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const kind = value(form, 'kind') as
      'FIXED_AMOUNT' | 'DISCOUNT_PERCENT' | 'COMMISSION_PERCENT';
    await mutate(
      () =>
        agencyClient.createAgreedRate(organizationId, {
          branchId,
          serviceReference: value(form, 'serviceReference'),
          title: value(form, 'rateTitle'),
          kind,
          value: value(form, 'rateValue'),
          currencyCode:
            kind === 'FIXED_AMOUNT'
              ? value(form, 'rateCurrencyCode').toUpperCase()
              : null,
          validFrom: value(form, 'validFrom'),
          validTo: value(form, 'validTo') || null,
        }),
      'نرخ توافقی آژانس ثبت شد.',
    );
  }

  if (loading)
    return (
      <div className="space-y-3" aria-label="در حال بارگذاری پروفایل عملیاتی">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1 space-y-2">
          <span className="text-sm font-bold">شعبه عملیاتی</span>
          <select
            className="h-11 w-full rounded-xl border border-input bg-surface px-3"
            disabled={pending}
            onChange={(event) => void load(event.target.value)}
            value={branchId}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          onClick={() => void load(branchId)}
          disabled={pending}
          type="button"
          variant="outline"
        >
          <RefreshCw className="size-4" /> تازه‌سازی پرونده
        </Button>
      </div>

      {message ? <Alert description={message} title="ذخیره شد" /> : null}
      {error ? <Alert description={error} title="خطا" tone="warning" /> : null}

      {!workspace ? null : (
        <>
          <nav
            className="flex flex-wrap gap-2"
            aria-label="بخش‌های پرونده تجاری"
          >
            {(
              [
                ['overview', 'نمای کلی'],
                ['address', 'نشانی'],
                ['credit', 'اعتبار و Deposit'],
                ['agreements', 'توافق‌نامه‌ها'],
                ['rates', 'نرخ و کمیسیون'],
                ['connections', 'سوابق مرتبط'],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={section === key ? 'primary' : 'outline'}
                aria-pressed={section === key}
                onClick={() => setSection(key)}
              >
                {label}
              </Button>
            ))}
          </nav>
          {section === 'overview' ? (
            <Card className="grid gap-3 p-4 sm:grid-cols-3">
              <div>
                توافق‌نامه‌های ثبت‌شده{' '}
                <strong>
                  {workspace.agreements.length.toLocaleString('fa-IR')}
                </strong>
              </div>
              <div>
                نرخ‌های ثبت‌شده{' '}
                <strong>
                  {workspace.agreedRates.length.toLocaleString('fa-IR')}
                </strong>
              </div>
              <div>
                آخرین تغییر پروفایل{' '}
                <strong>
                  {workspace.profile
                    ? new Date(workspace.profile.updatedAt).toLocaleDateString(
                        'fa-IR',
                      )
                    : 'ثبت‌نشده'}
                </strong>
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-3">
                آمار فقط مربوط به پرونده همین شعبه است.
              </p>
            </Card>
          ) : null}
          {section === 'connections' ? (
            <Card className="space-y-3 p-4">
              <h3 className="font-bold">سوابق بین‌بخشی</h3>
              <p className="text-sm text-muted-foreground">
                سوابق فروش، رزرواسیون، مسافران، درخواست‌های سفر، پرداخت و تسویه،
                اسناد و رویدادهای این سازمان هنوز به پرونده متصل نشده‌اند.
              </p>
            </Card>
          ) : null}

          {!workspace?.profile ? (
            <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50 p-4">
              <div>
                <p className="font-bold">
                  پروفایل عملیاتی این شعبه هنوز ثبت نشده است
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  برای ثبت قرارداد، اعتبار و نرخ توافقی ابتدا پروفایل شعبه را
                  فعال کنید.
                </p>
              </div>
              <Button
                disabled={
                  pending ||
                  !branchId ||
                  !permissions.includes('b2b.agency.manage')
                }
                onClick={() =>
                  void mutate(
                    () =>
                      agencyClient.upsertProfile(organizationId, {
                        branchId,
                        status: 'ACTIVE',
                        displayOrder: 0,
                      }),
                    'پروفایل عملیاتی این شعبه فعال شد.',
                  )
                }
                size="sm"
              >
                فعال‌سازی پروفایل
              </Button>
            </Card>
          ) : (
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-bold">پروفایل عملیاتی شعبه</p>
                <p className="text-sm text-muted-foreground">
                  نسخه {workspace.profile.version.toLocaleString('fa-IR')}
                </p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800">
                {workspace.profile.status === 'ACTIVE'
                  ? 'فعال'
                  : workspace.profile.status}
              </Badge>
            </Card>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="space-y-3 p-4" hidden={section !== 'address'}>
              <div className="flex items-center gap-2 font-bold">
                <MapPin className="size-4" /> آدرس پایه
              </div>
              {workspace?.primaryAddress ? (
                <div className="text-sm leading-7">
                  <p className="font-semibold">
                    {workspace.primaryAddress.countryName}،{' '}
                    {workspace.primaryAddress.cityName}
                  </p>
                  <p>{workspace.primaryAddress.addressLine}</p>
                  <p className="text-muted-foreground">
                    کدپستی: {workspace.primaryAddress.postalCode ?? 'ثبت‌نشده'}
                  </p>
                </div>
              ) : (
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-primary">
                    افزودن آدرس پایه
                  </summary>
                  <form className="mt-3 grid gap-2" onSubmit={submitAddress}>
                    <Input
                      name="label"
                      placeholder="عنوان آدرس؛ دفتر مرکزی"
                      required
                    />
                    <select
                      className="h-11 rounded-xl border border-input bg-surface px-3"
                      name="countryId"
                      onChange={(event) => setCountryId(event.target.value)}
                      required
                      value={countryId}
                    >
                      {countries.map((country) => (
                        <option key={country.id} value={country.id}>
                          {optionLabel(country)}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-11 rounded-xl border border-input bg-surface px-3"
                      name="cityId"
                      required
                    >
                      {matchingCities.map((city) => (
                        <option key={city.id} value={city.id}>
                          {optionLabel(city)}
                        </option>
                      ))}
                    </select>
                    <Input
                      name="addressLine"
                      placeholder="نشانی کامل"
                      required
                    />
                    <Input name="postalCode" placeholder="کدپستی" />
                    <Button
                      disabled={
                        pending || !permissions.includes('master_data.create')
                      }
                      type="submit"
                    >
                      ثبت آدرس
                    </Button>
                  </form>
                </details>
              )}
            </Card>

            <Card className="space-y-3 p-4" hidden={section !== 'credit'}>
              <div className="flex items-center gap-2 font-bold">
                <CreditCard className="size-4" /> سیاست اعتبار
              </div>
              <Alert
                title="تغییر اعتبار در انتظار گردش تأیید"
                description="تغییر سقف اعتبار باید توسط شخص دیگری تأیید شود. ثبت درخواست و تأیید هنوز آماده نیست؛ موجودی قطعی، Deposit و بدهی نیز تا اتصال اطلاعات مالی قابل نمایش نیستند."
              />
              {workspace?.creditPolicy ? (
                <div className="space-y-1 text-sm">
                  <p className="text-xl font-black">
                    {formatMoney(
                      workspace.creditPolicy.creditLimit,
                      workspace.creditPolicy.currencyCode,
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    مصرف فعلی:{' '}
                    {workspace.financeExposure.status === 'AVAILABLE'
                      ? formatMoney(
                          workspace.financeExposure.amount,
                          workspace.financeExposure.currencyCode,
                        )
                      : 'اطلاعات مالی هنوز در دسترس نیست'}
                  </p>
                </div>
              ) : null}
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-primary">
                  {workspace?.creditPolicy
                    ? 'ویرایش سیاست اعتبار'
                    : 'ثبت سیاست اعتبار'}
                </summary>
                <form className="mt-3 grid gap-2" onSubmit={submitCredit}>
                  <fieldset disabled className="grid gap-2">
                    <Input
                      defaultValue={workspace?.creditPolicy?.creditLimit}
                      inputMode="decimal"
                      name="creditLimit"
                      placeholder="سقف اعتبار"
                      required
                    />
                    <Input
                      defaultValue={
                        workspace?.creditPolicy?.currencyCode ?? 'IRR'
                      }
                      dir="ltr"
                      maxLength={3}
                      name="currencyCode"
                      placeholder="IRR"
                      required
                    />
                    <DatePicker
                      defaultValue={
                        workspace?.creditPolicy?.effectiveFrom ?? ''
                      }
                      key={`credit-from-${workspace?.creditPolicy?.version ?? 0}`}
                      name="effectiveFrom"
                      required
                    />
                    <DatePicker
                      defaultValue={workspace?.creditPolicy?.expiresAt ?? ''}
                      key={`credit-to-${workspace?.creditPolicy?.version ?? 0}`}
                      name="expiresAt"
                    />
                    <Button disabled type="submit">
                      ذخیره اعتبار
                    </Button>
                  </fieldset>
                </form>
              </details>
            </Card>

            <Card className="space-y-3 p-4" hidden={section !== 'agreements'}>
              <div className="flex items-center gap-2 font-bold">
                <FileText className="size-4" /> قراردادهای B2B
              </div>
              {workspace?.agreements.length ? (
                workspace.agreements.map((agreement) => (
                  <div
                    className="rounded-xl border p-3 text-sm"
                    key={agreement.id}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold">{agreement.title}</span>
                      <Badge>
                        {agreementLabel(
                          agreement,
                          new Date().toISOString().slice(0, 10),
                        )}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground" dir="ltr">
                      {agreement.code} · {agreement.startsAt} —{' '}
                      {agreement.endsAt ?? 'بدون پایان'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  قراردادی ثبت نشده است.
                </p>
              )}
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-primary">
                  افزودن قرارداد
                </summary>
                <form className="mt-3 grid gap-2" onSubmit={submitAgreement}>
                  <Input name="title" placeholder="عنوان قرارداد" required />
                  <DatePicker name="startsAt" required />
                  <DatePicker name="endsAt" />
                  <Input name="notes" placeholder="یادداشت اختیاری" />
                  <Button
                    disabled={
                      pending ||
                      !workspace?.profile ||
                      !permissions.includes('b2b.agreement.manage')
                    }
                    type="submit"
                  >
                    ثبت پیش‌نویس توافق‌نامه
                  </Button>
                </form>
              </details>
            </Card>

            <Card className="space-y-3 p-4" hidden={section !== 'rates'}>
              <div className="flex items-center gap-2 font-bold">
                <Percent className="size-4" /> نرخ‌های توافقی
              </div>
              {workspace?.agreedRates.length ? (
                workspace.agreedRates.map((rate) => (
                  <div className="rounded-xl border p-3 text-sm" key={rate.id}>
                    <p className="font-semibold">{rate.title}</p>
                    <p className="text-muted-foreground">
                      {rate.kind === 'FIXED_AMOUNT'
                        ? formatMoney(rate.value, rate.currencyCode ?? '')
                        : `${moneyLabel(rate.value, '')}٪`}
                      {' · '}
                      {rate.serviceReference}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  نرخ توافقی ثبت نشده است.
                </p>
              )}
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-primary">
                  افزودن نرخ
                </summary>
                <form className="mt-3 grid gap-2" onSubmit={submitRate}>
                  <Input
                    name="serviceReference"
                    placeholder="مرجع خدمت"
                    required
                  />
                  <Input name="rateTitle" placeholder="عنوان نرخ" required />
                  <select
                    className="h-11 rounded-xl border border-input bg-surface px-3"
                    defaultValue="DISCOUNT_PERCENT"
                    name="kind"
                  >
                    <option value="DISCOUNT_PERCENT">درصد تخفیف</option>
                    <option value="COMMISSION_PERCENT">درصد کمیسیون</option>
                    <option value="FIXED_AMOUNT">مبلغ ثابت</option>
                  </select>
                  <Input
                    inputMode="decimal"
                    name="rateValue"
                    placeholder="مقدار"
                    required
                  />
                  <Input
                    defaultValue="IRR"
                    dir="ltr"
                    maxLength={3}
                    name="rateCurrencyCode"
                    placeholder="ارز برای مبلغ ثابت"
                  />
                  <DatePicker name="validFrom" required />
                  <DatePicker name="validTo" />
                  <Button
                    disabled={
                      pending ||
                      !workspace?.profile ||
                      !permissions.includes('b2b.rate.manage')
                    }
                    type="submit"
                  >
                    ثبت نرخ
                  </Button>
                </form>
              </details>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
