'use client';
import { useEffect, useState } from 'react';
import type {
  InsurancePolicyRowV1,
  InsuranceStandaloneInputV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-controls';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { DatePicker } from '@/components/ui/date-picker';
import {
  insuranceRequest,
  type InsuranceProviderCatalog,
  type InsuranceSettingsResponse,
} from './client';
import {
  InsuranceInputGuide,
  InsurancePassengerFields,
} from './passenger-fields';
import styles from './workspace.module.css';

export function StandaloneInsuranceDraft({
  branches,
  policy,
  saved,
}: {
  branches: { id: string; name?: string }[];
  policy?: InsurancePolicyRowV1;
  saved: () => void;
}) {
  const [draft, setDraft] = useState<InsuranceStandaloneInputV1>(() => ({
    branchId:
      policy?.branchId ?? (branches.length === 1 ? branches[0]!.id : ''),
    requestKey: crypto.randomUUID(),
    sourceCountryCode: '',
    destinationCode: '',
    planCode: '',
    departureDate: '',
    durationDays: 0,
    notes: '',
    expectedVersion: 0,
    passenger: {
      version: 1,
      firstName: '',
      lastName: '',
      firstNameLatin: '',
      lastNameLatin: '',
      nationalityCode: 'IRN',
      nationalCode: '',
      passportNo: '',
      birthDate: '',
      gender: '' as 'M',
      mobile: '',
      email: '',
    },
  }));
  const [settings, setSettings] = useState<InsuranceSettingsResponse | null>(
    null,
  );
  const [catalogState, setCatalog] = useState<
    (InsuranceProviderCatalog & { branchId: string }) | null
  >(null);
  const catalog =
    catalogState?.branchId === draft.branchId ? catalogState : null;
  const [ready, setReady] = useState(!policy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const policyId = policy?.id;
  useEffect(() => {
    if (!policyId) return;
    let active = true;
    insuranceRequest<{ data: InsuranceStandaloneInputV1 }>(
      'standalone/' + policyId,
    )
      .then((r) => {
        if (active) {
          setDraft(r.data);
          setReady(true);
        }
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'اطلاعات بیمه دریافت نشد.');
      });
    return () => {
      active = false;
    };
  }, [policyId]);
  useEffect(() => {
    let active = true;
    if (!draft.branchId) return;
    const query = new URLSearchParams({ branchId: draft.branchId });
    Promise.all([
      insuranceRequest<InsuranceSettingsResponse>('settings?' + query),
      insuranceRequest<InsuranceProviderCatalog>('issuance-catalog?' + query),
    ])
      .then(([settings, catalog]) => {
        if (active) {
          setSettings(settings);
          setCatalog({ ...catalog, branchId: draft.branchId });
        }
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'اطلاعات بیمه دریافت نشد.');
      });
    return () => {
      active = false;
    };
  }, [draft.branchId]);
  const country = settings?.config.countries.find(
    (c) => c.active && c.providerCountryCode === draft.destinationCode,
  );
  const durationValid = Boolean(
    catalog?.durations.some((d) => d.days === draft.durationDays),
  );
  const person = draft.passenger;
  const passengerComplete =
    [
      person.firstName,
      person.lastName,
      person.firstNameLatin,
      person.lastNameLatin,
      person.nationalityCode,
      person.passportNo,
      person.birthDate,
      person.mobile,
      person.email,
    ].every((value) => value.trim()) &&
    ['M', 'F'].includes(person.gender) &&
    (person.nationalityCode !== 'IRN' || Boolean(person.nationalCode.trim()));
  const canSave =
    ready &&
    !busy &&
    passengerComplete &&
    durationValid &&
    Boolean(
      country?.plans.some((p) => p.providerPlanCode === draft.planCode),
    ) &&
    Boolean(
      catalog?.countries.some((c) => String(c.id) === draft.sourceCountryCode),
    ) &&
    Boolean(draft.departureDate);
  async function submit() {
    if (!canSave) return;
    setBusy(true);
    setError('');
    try {
      await insuranceRequest(
        policyId ? 'standalone/' + policyId : 'standalone',
        {
          method: policyId ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...draft,
            passenger: Object.fromEntries(
              Object.entries(draft.passenger).map(([k, v]) => [
                k,
                typeof v === 'string' ? v.trim() : v,
              ]),
            ),
          }),
        },
      );
      saved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className={styles.stack}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p>اطلاعات متقاضی و سفر را وارد کنید؛ قرارداد فروش لازم نیست.</p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <label>
        شعبه صادرکننده
        <NativeSearchSelect
          required
          disabled={busy || Boolean(policy)}
          value={draft.branchId}
          onChange={(e) =>
            setDraft({
              ...draft,
              branchId: e.target.value,
              destinationCode: '',
              planCode: '',
              sourceCountryCode: '',
              durationDays: 0,
            })
          }
        >
          <option value="">انتخاب شعبه</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name ?? b.id}
            </option>
          ))}
        </NativeSearchSelect>
      </label>
      <InsuranceInputGuide standalone />
      {!ready ? (
        <p>در حال دریافت اطلاعات بیمه‌شده…</p>
      ) : (
        <InsurancePassengerFields
          value={draft.passenger}
          disabled={busy}
          onChange={(passenger) => setDraft({ ...draft, passenger })}
        />
      )}
      <div className={styles.fields}>
        <label>
          کشور مبدا
          <NativeSearchSelect
            required
            value={draft.sourceCountryCode}
            disabled={busy || !catalog}
            onChange={(e) =>
              setDraft({ ...draft, sourceCountryCode: e.target.value })
            }
          >
            <option value="">انتخاب کشور</option>
            {catalog?.countries.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.title}
              </option>
            ))}
          </NativeSearchSelect>
        </label>
        <label>
          کشور مقصد
          <NativeSearchSelect
            required
            value={draft.destinationCode}
            disabled={busy || !settings}
            onChange={(e) =>
              setDraft({
                ...draft,
                destinationCode: e.target.value,
                planCode: '',
              })
            }
          >
            <option value="">انتخاب کشور</option>
            {settings?.config.countries
              .filter((c) => c.active)
              .map((c) => (
                <option key={c.countryId} value={c.providerCountryCode}>
                  {c.providerCountryName}
                </option>
              ))}
          </NativeSearchSelect>
        </label>
        <label>
          طرح بیمه
          <NativeSearchSelect
            required
            value={draft.planCode}
            disabled={busy || !country}
            onChange={(e) => setDraft({ ...draft, planCode: e.target.value })}
          >
            <option value="">انتخاب طرح</option>
            {country?.plans.map((p) => (
              <option key={p.providerPlanCode} value={p.providerPlanCode}>
                {p.title}
              </option>
            ))}
          </NativeSearchSelect>
        </label>
        <label>
          مدت سفر (روز)
          <NativeSearchSelect
            required
            value={durationValid ? String(draft.durationDays) : ''}
            disabled={busy || !catalog}
            onChange={(e) =>
              setDraft({ ...draft, durationDays: Number(e.target.value) })
            }
          >
            <option value="">انتخاب مدت بیمه</option>
            {catalog?.durations.map((d) => (
              <option key={d.days} value={String(d.days)}>
                {d.title}
              </option>
            ))}
          </NativeSearchSelect>
        </label>
        <label>
          تاریخ سفر
          <DatePicker
            disabled={busy}
            value={draft.departureDate}
            onChange={(departureDate) => setDraft({ ...draft, departureDate })}
          />
        </label>
      </div>
      <label>
        یادداشت
        <Textarea
          maxLength={2000}
          disabled={busy}
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </label>
      <Button type="submit" disabled={!canSave}>
        {policy ? 'ذخیره اصلاحات و تلاش مجدد صدور' : 'ثبت درخواست و صدور بیمه'}
      </Button>
    </form>
  );
}
