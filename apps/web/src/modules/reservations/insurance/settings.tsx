'use client';
import { useEffect, useState } from 'react';
import {
  insuranceCountryFields,
  matchInsuranceCountry,
} from './country-mapping';
import { Plus, Save, Trash2, Globe2, ShieldCheck } from 'lucide-react';
import type {
  InsuranceConfigurationV1,
  InsuranceCountryMappingV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import {
  insuranceReferences,
  insuranceRequest,
  type InsuranceReference,
  type InsuranceSettingsResponse,
  type InsuranceProviderCatalog,
} from './client';
import styles from './workspace.module.css';
import { currencySymbol } from '@/lib/currency-symbol';
import { InsuranceRateMatrix } from './rate-matrix';
import {
  insuranceCountryPlanTemplates,
  insuranceRateBandTemplate,
} from './rate-band-template';

export function InsuranceSettings({ branchId }: { branchId: string }) {
  return <InsuranceSettingsForm key={branchId} branchId={branchId} />;
}
function InsuranceSettingsForm({ branchId }: { branchId: string }) {
  const [value, setValue] = useState<InsuranceSettingsResponse | null>(null);
  const [countries, setCountries] = useState<InsuranceReference[]>([]);
  const [plans, setPlans] = useState<InsuranceReference[]>([]);
  const [currencies, setCurrencies] = useState<InsuranceReference[]>([]);
  const [selected, setSelected] = useState('');
  const [planIndex, setPlanIndex] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState('');
  const [providerCatalog, setProviderCatalog] =
    useState<InsuranceProviderCatalog | null>(null);
  const [providerBusy, setProviderBusy] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      insuranceRequest<InsuranceSettingsResponse>(
        'settings?' + new URLSearchParams({ branchId }),
      ),
      insuranceReferences(branchId, 'countries'),
      insuranceReferences(branchId, 'insurance-plans'),
      insuranceReferences(branchId, 'currencies'),
    ])
      .then(([settings, countryRows, planRows, currencyRows]) => {
        if (!active) return;
        setValue(settings);
        setCountries(countryRows);
        setPlans(planRows);
        setCurrencies(currencyRows);
        setSelected(settings.config.countries[0]?.countryId ?? '');
        setPlanIndex(0);
        if (
          settings.canManage &&
          settings.providerStatus === 'SANDBOX_CONFIGURED'
        ) {
          setProviderBusy(true);
          void insuranceRequest<InsuranceProviderCatalog>(
            'provider/catalog?' + new URLSearchParams({ branchId }),
          )
            .then((catalog) => {
              if (active) setProviderCatalog(catalog);
            })
            .catch((reason: unknown) => {
              if (active)
                setError(
                  reason instanceof Error
                    ? reason.message
                    : 'اطلاعات بیمه دریافت نشد.',
                );
            })
            .finally(() => {
              if (active) setProviderBusy(false);
            });
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [branchId]);
  const mapping = value?.config.countries.find((c) => c.countryId === selected);
  const plan = mapping?.plans[planIndex];
  const editable = Boolean(value?.canManage && !busy);
  function change(
    fn: (config: InsuranceConfigurationV1) => InsuranceConfigurationV1,
  ) {
    setMessage('');
    setDirty(true);
    setValue((old) => (old ? { ...old, config: fn(old.config) } : old));
  }
  function updateMapping(patch: Partial<InsuranceCountryMappingV1>) {
    change((config) => ({
      ...config,
      countries: config.countries.map((c) =>
        c.countryId === selected ? { ...c, ...patch } : c,
      ),
    }));
  }
  function updatePlan(
    patch: Partial<InsuranceCountryMappingV1['plans'][number]>,
  ) {
    if (!mapping) return;
    updateMapping({
      plans: mapping.plans.map((p, i) =>
        i === planIndex ? { ...p, ...patch } : p,
      ),
    });
  }
  async function receiveProviderCatalog() {
    if (providerBusy) return;
    setProviderBusy(true);
    setError('');
    try {
      const catalog = await insuranceRequest<InsuranceProviderCatalog>(
        'provider/catalog?' + new URLSearchParams({ branchId }),
      );
      setProviderCatalog(catalog);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'اطلاعات بیمه دریافت نشد.');
    } finally {
      setProviderBusy(false);
    }
  }

  async function importFestival() {
    if (!value || busy || dirty) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await insuranceRequest<
        InsuranceSettingsResponse & { unsupportedBands: number }
      >('settings/festival?' + new URLSearchParams({ branchId }), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedVersion: value.version }),
      });
      setValue(result);
      const [countryRows, planRows] = await Promise.all([
        insuranceReferences(branchId, 'countries'),
        insuranceReferences(branchId, 'insurance-plans'),
      ]);
      setCountries(countryRows);
      setPlans(planRows);
      setSelected(result.config.countries[0]?.countryId ?? '');
      setPlanIndex(0);
      setMessage(
        'کشورها و نرخ‌های طرح ۷۶ از API آزمایشی ثبت شدند.' +
          (result.unsupportedBands
            ? ' بازه‌های بدون نرخ بیمه‌گر وارد نشدند.'
            : ''),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'اطلاعات بیمه دریافت نشد.');
    } finally {
      setBusy(false);
    }
  }
  async function testIssuance() {
    if (providerBusy) return;
    setProviderBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await insuranceRequest<{
        sandboxOnly: true;
        confirmed: true;
        policyId: number;
      }>('provider/test-issuance?' + new URLSearchParams({ branchId }), {
        method: 'POST',
      });
      setMessage(
        'ساخت و تأیید آزمایشی موفق بود؛ شناسهٔ آزمایشی: ' + result.policyId,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'اطلاعات بیمه دریافت نشد.');
    } finally {
      setProviderBusy(false);
    }
  }
  async function save() {
    if (!value) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setValue(
        await insuranceRequest<InsuranceSettingsResponse>(
          'settings?' + new URLSearchParams({ branchId }),
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              config: value.config,
              expectedVersion: value.version,
            }),
          },
        ),
      );
      setDirty(false);
      setMessage('تنظیمات بیمه ذخیره شد.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.stack}>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" className={styles.success}>
          {message}
        </p>
      )}
      {!value && !error && <p>در حال دریافت تنظیمات…</p>}
      {value && (
        <>
          <div className={styles.toolbar}>
            <div>
              <h2>تنظیمات صدور بیمه‌نامه</h2>
              <span className={styles.muted}>
                کشور، طرح و نرخ بر اساس سن و مدت سفر
              </span>
            </div>
            <Button onClick={() => void save()} disabled={!editable}>
              <Save size={16} />
              {busy ? 'در حال ذخیره…' : 'ثبت تنظیمات'}
            </Button>
          </div>
          <div className={styles.card}>
            <strong>اتصال آزمایشی تراویس</strong>
            <Button
              type="button"
              variant="outline"
              disabled={
                !value.canManage ||
                providerBusy ||
                value.providerStatus !== 'SANDBOX_CONFIGURED'
              }
              onClick={() => void receiveProviderCatalog()}
            >
              {providerBusy ? 'در حال دریافت…' : 'دریافت اطلاعات بیمه‌گر'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={
                !editable ||
                dirty ||
                providerBusy ||
                value.providerStatus !== 'SANDBOX_CONFIGURED'
              }
              title={dirty ? 'ابتدا تغییرات تنظیمات را ذخیره کنید.' : undefined}
              onClick={() => void importFestival()}
            >
              دریافت و ثبت کشورها و نرخ‌های طرح ۷۶
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={
                !editable ||
                providerBusy ||
                value.providerStatus !== 'SANDBOX_CONFIGURED'
              }
              onClick={() => void testIssuance()}
            >
              آزمایش صدور با اطلاعات ساختگی
            </Button>
            <p className={styles.muted}>
              این آزمایش بیمه‌نامهٔ واقعی مسافر ایجاد نمی‌کند.
            </p>
            {providerCatalog && (
              <p role="status">
                {providerCatalog.countries.length} کشور ·{' '}
                {providerCatalog.plans.length} طرح ·{' '}
                {providerCatalog.durations.length} مدت اقامت
              </p>
            )}
          </div>
          <div className={styles.settingsGrid}>
            <aside className={styles.card}>
              <h3>
                <Globe2 size={18} />
                کشورها
              </h3>
              <Input
                aria-label="جست‌وجوی کشور بیمه"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جست‌وجوی کشور"
              />
              <NativeSearchSelect
                aria-label="افزودن کشور بیمه"
                value=""
                disabled={!editable}
                onChange={(e) => {
                  const country = countries.find(
                    (c) => c.id === e.target.value,
                  );
                  if (!country) return;
                  const provider = matchInsuranceCountry(
                    country,
                    providerCatalog?.countries ?? [],
                  );

                  change((config) => ({
                    ...config,
                    countries: [
                      ...config.countries,
                      {
                        countryId: country.id,
                        providerCountryCode: '',
                        providerCountryName: country.name,
                        englishName: '',
                        ...(provider
                          ? insuranceCountryFields(provider, country)
                          : {}),
                        active: true,
                        plans: insuranceCountryPlanTemplates(config, selected),
                      },
                    ],
                  }));
                  setSelected(country.id);
                  setPlanIndex(0);
                }}
              >
                <option value="">افزودن کشور</option>
                {countries
                  .filter(
                    (c) =>
                      !value.config.countries.some((m) => m.countryId === c.id),
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </NativeSearchSelect>
              <div className={styles.countryList}>
                {value.config.countries
                  .filter((c) =>
                    (
                      countries.find((r) => r.id === c.countryId)?.name ??
                      c.providerCountryName
                    ).includes(search),
                  )
                  .map((c) => (
                    <button
                      type="button"
                      key={c.countryId}
                      className={
                        c.countryId === selected ? styles.selected : ''
                      }
                      onClick={() => {
                        setSelected(c.countryId);
                        setPlanIndex(0);
                      }}
                    >
                      <span>
                        {countries.find((r) => r.id === c.countryId)?.name ??
                          c.providerCountryName}
                      </span>
                      <span className={styles.muted}>
                        {c.active ? c.plans.length + ' طرح' : 'غیرفعال'}
                      </span>
                    </button>
                  ))}
              </div>
            </aside>
            <section className={styles.card}>
              {!mapping ? (
                <div className={styles.empty}>
                  <Globe2 size={32} />
                  <p>یک کشور از اطلاعات پایه اضافه کنید.</p>
                </div>
              ) : (
                <>
                  <div className={styles.toolbar}>
                    <h3>مشخصات کشور در بیمه‌گر</h3>
                    <label>
                      <input
                        type="checkbox"
                        checked={mapping.active}
                        disabled={!editable}
                        onChange={(e) =>
                          updateMapping({ active: e.target.checked })
                        }
                      />{' '}
                      فعال
                    </label>
                  </div>
                  <label>
                    انتخاب کشور از بیمه‌گر
                    <NativeSearchSelect
                      value={mapping.providerCountryCode}
                      disabled={!editable || !providerCatalog || providerBusy}
                      onChange={(e) => {
                        const country = providerCatalog?.countries.find(
                          (c) => String(c.id) === e.target.value,
                        );
                        if (country)
                          updateMapping(
                            insuranceCountryFields(
                              country,
                              countries.find(
                                (item) => item.id === mapping.countryId,
                              ),
                            ),
                          );
                      }}
                    >
                      <option value="">انتخاب کشور</option>
                      {!providerCatalog?.countries.some(
                        (c) => String(c.id) === mapping.providerCountryCode,
                      ) &&
                        mapping.providerCountryCode && (
                          <option value={mapping.providerCountryCode}>
                            {mapping.providerCountryName}
                          </option>
                        )}
                      {providerCatalog?.countries.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.title} ({c.standardCode || c.id})
                        </option>
                      ))}
                    </NativeSearchSelect>
                  </label>
                  <div className={styles.fields}>
                    <label>
                      کد کشور بیمه‌گر
                      <Input
                        dir="ltr"
                        value={mapping.providerCountryCode}
                        disabled={!editable}
                        readOnly
                      />
                    </label>
                    <label>
                      نام کشور بیمه‌گر
                      <Input
                        value={mapping.providerCountryName}
                        disabled={!editable}
                        readOnly
                      />
                    </label>
                    <label>
                      نام انگلیسی
                      <Input
                        dir="ltr"
                        value={mapping.englishName}
                        disabled={!editable}
                        readOnly
                      />
                    </label>
                  </div>
                  <div className={styles.toolbar}>
                    <h3>
                      <ShieldCheck size={18} />
                      طرح‌های این کشور
                    </h3>
                    <Button
                      variant="outline"
                      disabled={!editable}
                      onClick={() => {
                        updateMapping({
                          plans: [
                            ...mapping.plans,
                            {
                              masterPlanId: '',
                              providerPlanCode: '',
                              title: '',
                              rates: [],
                            },
                          ],
                        });
                        setPlanIndex(mapping.plans.length);
                      }}
                    >
                      <Plus size={16} />
                      افزودن طرح
                    </Button>
                  </div>
                  <div className={styles.planTabs}>
                    {mapping.plans.map((p, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => setPlanIndex(i)}
                        className={planIndex === i ? styles.selected : ''}
                      >
                        {p.title || 'طرح جدید'}
                      </button>
                    ))}
                  </div>
                  {plan && (
                    <>
                      {providerCatalog && (
                        <label>
                          انتخاب طرح از بیمه‌گر
                          <NativeSearchSelect
                            value={plan.providerPlanCode}
                            disabled={!editable}
                            onChange={(e) => {
                              const providerPlan = providerCatalog.plans.find(
                                (p) => String(p.id) === e.target.value,
                              );
                              if (providerPlan)
                                updatePlan({
                                  providerPlanCode: String(providerPlan.id),
                                  title: providerPlan.title,
                                });
                            }}
                          >
                            <option value="">انتخاب طرح</option>
                            {!providerCatalog.plans.some(
                              (p) => String(p.id) === plan.providerPlanCode,
                            ) &&
                              plan.providerPlanCode && (
                                <option value={plan.providerPlanCode}>
                                  {plan.title}
                                </option>
                              )}
                            {providerCatalog.plans.map((p) => (
                              <option key={p.id} value={String(p.id)}>
                                {p.title}
                              </option>
                            ))}
                          </NativeSearchSelect>
                        </label>
                      )}
                      <div className={styles.fields}>
                        <label>
                          طرح اطلاعات پایه
                          <NativeSearchSelect
                            value={plan.masterPlanId}
                            disabled={!editable}
                            onChange={(e) => {
                              const p = plans.find(
                                (p) => p.id === e.target.value,
                              );
                              updatePlan({
                                masterPlanId: e.target.value,
                                title: p?.name ?? '',
                                ...(plan.rates.length
                                  ? {}
                                  : {
                                      rates: insuranceRateBandTemplate(
                                        value.config,
                                        e.target.value,
                                      ),
                                    }),
                              });
                            }}
                          >
                            <option value="">انتخاب طرح</option>
                            {plans.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </NativeSearchSelect>
                        </label>
                        <label>
                          کد طرح بیمه‌گر
                          <Input
                            dir="ltr"
                            value={plan.providerPlanCode}
                            disabled={!editable}
                            onChange={(e) =>
                              updatePlan({ providerPlanCode: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          عنوان طرح
                          <Input
                            value={plan.title}
                            disabled={!editable}
                            onChange={(e) =>
                              updatePlan({ title: e.target.value })
                            }
                          />
                        </label>
                      </div>
                      <div className={styles.toolbar}>
                        <h3>نرخ بر اساس سن و مدت سفر</h3>
                        <Button
                          variant="outline"
                          disabled={!editable}
                          onClick={() =>
                            updatePlan({
                              rates: [
                                ...plan.rates,
                                {
                                  minDays: 1,
                                  maxDays: 7,
                                  minAge: 0,
                                  maxAge: 12,
                                  amount: '',
                                  currencyCode: currencies[0]?.code ?? '',
                                },
                              ],
                            })
                          }
                        >
                          <Plus size={16} />
                          افزودن بازه
                        </Button>
                      </div>
                      <div className={styles.tableWrap}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th colSpan={2}>مدت سفر (روز)</th>
                              <th colSpan={2}>سن مسافر (سال)</th>
                              <th>مبلغ</th>
                              <th>ارز</th>
                              <th />
                            </tr>
                            <tr>
                              <th>از</th>
                              <th>تا</th>
                              <th>از</th>
                              <th>تا</th>
                              <th />
                              <th />
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {plan.rates.map((rate, i) => (
                              <tr key={i}>
                                {(
                                  [
                                    'minDays',
                                    'maxDays',
                                    'minAge',
                                    'maxAge',
                                  ] as const
                                ).map((key) => (
                                  <td key={key}>
                                    <Input
                                      type="number"
                                      min={key.includes('Days') ? 1 : 0}
                                      max={key.includes('Days') ? 365 : 120}
                                      value={rate[key]}
                                      disabled={!editable}
                                      aria-label={`${{ minDays: 'حداقل مدت', maxDays: 'حداکثر مدت', minAge: 'حداقل سن', maxAge: 'حداکثر سن' }[key]} ${i + 1}`}
                                      onChange={(e) =>
                                        updatePlan({
                                          rates: plan.rates.map((r, n) =>
                                            n === i
                                              ? {
                                                  ...r,
                                                  [key]: Number(e.target.value),
                                                }
                                              : r,
                                          ),
                                        })
                                      }
                                    />
                                  </td>
                                ))}
                                <td>
                                  <Input
                                    dir="ltr"
                                    inputMode="decimal"
                                    aria-label={`مبلغ بازه ${i + 1}`}
                                    value={rate.amount}
                                    disabled={!editable}
                                    onChange={(e) =>
                                      updatePlan({
                                        rates: plan.rates.map((r, n) =>
                                          n === i
                                            ? { ...r, amount: e.target.value }
                                            : r,
                                        ),
                                      })
                                    }
                                  />
                                </td>
                                <td>
                                  <NativeSearchSelect
                                    aria-label={`ارز بازه ${i + 1}`}
                                    value={rate.currencyCode}
                                    disabled={!editable}
                                    onChange={(e) =>
                                      updatePlan({
                                        rates: plan.rates.map((r, n) =>
                                          n === i
                                            ? {
                                                ...r,
                                                currencyCode: e.target.value,
                                              }
                                            : r,
                                        ),
                                      })
                                    }
                                  >
                                    <option value="">انتخاب ارز</option>
                                    {currencies.map((c) => (
                                      <option key={c.id} value={c.code}>
                                        {currencySymbol(c.code)}
                                      </option>
                                    ))}
                                  </NativeSearchSelect>
                                </td>
                                <td>
                                  <button
                                    className={styles.remove}
                                    type="button"
                                    disabled={!editable}
                                    aria-label={`حذف بازه ${i + 1}`}
                                    onClick={() =>
                                      updatePlan({
                                        rates: plan.rates.filter(
                                          (_, n) => n !== i,
                                        ),
                                      })
                                    }
                                  >
                                    <Trash2 size={17} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {!plan.rates.length && (
                        <p className={styles.muted}>هنوز نرخی ثبت نشده است.</p>
                      )}
                      <InsuranceRateMatrix rates={plan.rates} />
                      <button
                        type="button"
                        className={styles.remove}
                        disabled={!editable}
                        onClick={() => {
                          updateMapping({
                            plans: mapping.plans.filter(
                              (_, i) => i !== planIndex,
                            ),
                          });
                          setPlanIndex(0);
                        }}
                      >
                        <Trash2 size={16} />
                        حذف طرح از این کشور
                      </button>
                    </>
                  )}
                </>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
