'use client';
import type {
  BranchReference,
  IamPermissionCode,
  MasterDataRecord,
} from '@rubi/contracts';
import { ArrowLeft, Check, FileText, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { AgreementTermsEditor } from './agreement-terms-editor';
import { blankAgreementTerms } from '../model/agreement-terms';
import { masterDataApi } from '@/modules/master-data/api/client';
import { agencyClient } from '../api/agency-client';
import {
  blankCooperationDraft,
  cooperationIssue,
  CooperationSaveError,
  saveCooperation,
  type CooperationDraft,
} from '../model/cooperation-draft';

const steps = [
  ['هویت و نقش', 'انتخاب سازمان موجود یا جدید'],
  ['اشخاص و دسترسی', 'نماینده و نشانی همکاری'],
  ['قرارداد و اعتبار', 'شرایط تجاری و پیش‌نویس'],
  ['اسناد و تأیید', 'بازبینی و ثبت پرونده'],
];
export function CooperationWizard({
  role,
  permissions,
  onClose,
  onSaved,
}: {
  role: CooperationDraft['role'];
  permissions: readonly IamPermissionCode[];
  onClose: () => void;
  onSaved: (record: MasterDataRecord) => void;
}) {
  const [draft, setDraft] = useState<CooperationDraft>(() => ({
    ...blankCooperationDraft,
    role,
    agreementTerms: blankAgreementTerms(),
    agreementRequestId: crypto.randomUUID(),
  }));
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<'new' | 'existing'>('existing');
  const [existing, setExisting] = useState<MasterDataRecord>();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<readonly MasterDataRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [countries, setCountries] = useState<readonly MasterDataRecord[]>([]);
  const [countryQuery, setCountryQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [cities, setCities] = useState<readonly MasterDataRecord[]>([]);
  const [branches, setBranches] = useState<readonly BranchReference[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [partial, setPartial] = useState<MasterDataRecord>();
  const heading = useRef<HTMLHeadingElement>(null);
  const set = (field: keyof CooperationDraft, value: string | boolean) =>
    setDraft((current) => ({ ...current, [field]: value }));
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [step]);
  useEffect(() => {
    let active = true;
    void agencyClient
      .branches()
      .then((items) => {
        if (active) setBranches(items);
      })
      .catch(() => {
        if (active) setError('دریافت شعب مجاز ناموفق بود.');
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (mode !== 'existing') return;
      setSearching(true);
      void masterDataApi
        .list('organizations', {
          search: query,
          status: 'active',
          page: 1,
          pageSize: 20,
          sortBy: 'name',
          sortDirection: 'asc',
        })
        .then((response) => {
          if (active) setMatches(response.data);
        })
        .catch(() => {
          if (active) setError('جست‌وجوی سازمان‌ها ناموفق بود.');
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, mode]);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void masterDataApi
        .list('countries', {
          search: countryQuery,
          status: 'active',
          page: 1,
          pageSize: 100,
          sortBy: 'name',
          sortDirection: 'asc',
        })
        .then((response) => {
          if (active) setCountries(response.data);
        })
        .catch(() => {
          if (active) setError('دریافت کشورها ناموفق بود.');
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [countryQuery]);
  useEffect(() => {
    let active = true;
    if (!draft.countryId) return;
    const timer = window.setTimeout(() => {
      void masterDataApi
        .list('cities', {
          search: cityQuery,
          status: 'active',
          countryId: draft.countryId,
          page: 1,
          pageSize: 100,
          sortBy: 'name',
          sortDirection: 'asc',
        })
        .then((response) => {
          if (active) setCities(response.data);
        })
        .catch(() => {
          if (active) setError('دریافت شهرها ناموفق بود.');
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [draft.countryId, cityQuery]);
  function next() {
    const issue =
      step === 1 && mode === 'existing' && !existing
        ? 'ابتدا سازمان موجود را انتخاب کنید.'
        : cooperationIssue(draft, step);
    if (issue) {
      setError(issue);
      return;
    }
    setError('');
    setStep((current) => Math.min(4, current + 1));
  }
  async function save() {
    if (busy || stopped) return;
    setBusy(true);
    setError('');
    try {
      onSaved(await saveCooperation(draft, permissions, existing));
    } catch (caught) {
      setStopped(true);
      if (caught instanceof CooperationSaveError)
        setPartial(caught.organization);
      setError(caught instanceof Error ? caught.message : 'ثبت ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }
  const field = (
    key: keyof CooperationDraft,
    label: string,
    maxLength = 160,
    disabled = false,
    type = 'text',
  ) => (
    <label className="field">
      <span>{label}</span>
      <input
        className="input"
        type={type}
        maxLength={maxLength}
        disabled={disabled || busy || stopped}
        value={String(draft[key])}
        placeholder={
          key === 'code' ? 'پس از ثبت، خودکار تولید می‌شود' : undefined
        }
        onChange={(event) => set(key, event.target.value)}
      />
    </label>
  );
  const canAgreement = (
    ['b2b.agreement.read', 'b2b.credit.read', 'b2b.agreement.manage'] as const
  ).every((permission) => permissions.includes(permission));
  function close() {
    if (busy) return;
    if (partial) onSaved(partial);
    else onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="b2b-design b2b-modal cooperation-modal"
        dir="rtl"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="modal-title">
          <DialogTitle>ایجاد همکاری B2B</DialogTitle>
          <DialogDescription>
            ثبت نقش آژانس یا مشتری سازمانی با حفظ هویت سازمان موجود
          </DialogDescription>
        </div>
        <div className="wizard">
          <nav className="panel steps" aria-label="مراحل ایجاد همکاری">
            {steps.map(([title, description], index) => (
              <div
                key={title}
                className={`step ${step === index + 1 ? 'active' : step > index + 1 ? 'done' : ''}`}
                aria-current={step === index + 1 ? 'step' : undefined}
              >
                <span className="step-num">
                  {step > index + 1 ? (
                    <Check size={16} />
                  ) : (
                    (index + 1).toLocaleString('fa-IR')
                  )}
                </span>
                <div>
                  <b>{title}</b>
                  <small>{description}</small>
                </div>
              </div>
            ))}
          </nav>
          <div className="panel wizard-body">
            <h3 ref={heading} tabIndex={-1}>
              {
                [
                  'هویت سازمان و نقش همکاری',
                  'اشخاص کلیدی و نشانی همکاری',
                  'قرارداد چارچوب و سیاست اعتبار',
                  'بازبینی اطلاعات و ثبت پرونده',
                ][step - 1]
              }
            </h3>
            {step === 1 ? (
              <>
                <p className="panel-note">
                  ابتدا سازمان موجود را جست‌وجو کنید تا پرونده تکراری ساخته
                  نشود.
                </p>
                <div className="wizard-mode">
                  <label>
                    <input
                      type="radio"
                      name="identityMode"
                      checked={mode === 'existing'}
                      onChange={() => {
                        setMode('existing');
                        setExisting(undefined);
                        setDraft({ ...blankCooperationDraft, role });
                      }}
                    />{' '}
                    سازمان موجود
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="identityMode"
                      checked={mode === 'new'}
                      disabled={!permissions.includes('master_data.create')}
                      onChange={() => {
                        setMode('new');
                        setExisting(undefined);
                        setDraft({ ...blankCooperationDraft, role });
                      }}
                    />{' '}
                    سازمان جدید
                  </label>
                </div>
                {mode === 'existing' ? (
                  <div className="field full">
                    <label htmlFor="cooperation-search">جست‌وجوی سازمان</label>
                    <div className="search-field">
                      <Search size={18} />
                      <input
                        id="cooperation-search"
                        className="input"
                        value={query}
                        maxLength={100}
                        placeholder="نام یا کد سازمان"
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </div>
                    <div className="organization-matches" aria-live="polite">
                      {searching ? (
                        <p>در حال جست‌وجو…</p>
                      ) : matches.length ? (
                        matches.map((record) => (
                          <button
                            key={record.id}
                            type="button"
                            className={
                              existing?.id === record.id ? 'selected' : ''
                            }
                            onClick={() => {
                              setExisting(record);
                              setDraft((current) => ({
                                ...current,
                                legalName: record.name,
                                code: record.code,
                                personType: String(
                                  record.attributes.personType ?? 'LEGAL',
                                ),
                              }));
                            }}
                          >
                            <span>{record.name}</span>
                            <bdi>{record.code}</bdi>
                            {existing?.id === record.id ? (
                              <Check size={16} />
                            ) : null}
                          </button>
                        ))
                      ) : (
                        <p>سازمانی پیدا نشد.</p>
                      )}
                    </div>
                  </div>
                ) : null}
                <div className="form-grid">
                  {field(
                    'legalName',
                    'نام ثبتی سازمان',
                    160,
                    mode === 'existing',
                  )}
                  {field('code', 'کد سازمان', 32, true)}
                  <label className="field">
                    <span>نقش همکاری</span>
                    <select
                      className="input"
                      value={draft.role}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          role: event.target.value as CooperationDraft['role'],
                          withAgreement: false,
                        }))
                      }
                    >
                      <option value="AGENCY">آژانس</option>
                      <option value="CORPORATE_CUSTOMER">مشتری سازمانی</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>نوع شخصیت</span>
                    <select
                      className="input"
                      disabled={mode === 'existing'}
                      value={draft.personType}
                      onChange={(event) =>
                        set('personType', event.target.value)
                      }
                    >
                      <option value="LEGAL">حقوقی</option>
                      <option value="NATURAL">حقیقی</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>کشور نشانی (اختیاری)</span>
                    <input
                      className="input"
                      aria-label="جست‌وجوی کشور"
                      placeholder="جست‌وجوی کشور"
                      value={countryQuery}
                      onChange={(event) => setCountryQuery(event.target.value)}
                    />
                    <select
                      className="input"
                      aria-label="کشور نشانی"
                      disabled={!permissions.includes('master_data.update')}
                      value={draft.countryId}
                      onChange={(event) => {
                        setDraft((current) => ({
                          ...current,
                          countryId: event.target.value,
                          cityId: '',
                        }));
                        setCities([]);
                      }}
                    >
                      <option value="">انتخاب نشده</option>
                      {countries.map((country) => (
                        <option key={country.id} value={country.id}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>وضعیت اولیه فرم</span>
                    <input
                      className="input"
                      value="پیش‌نویس — هنوز ذخیره نشده"
                      readOnly
                    />
                  </label>
                </div>
              </>
            ) : null}
            {step === 2 ? (
              <>
                <div className="form-grid">
                  {field(
                    'fullName',
                    'نام نماینده (اختیاری)',
                    160,
                    !permissions.includes('master_data.create'),
                  )}
                  {field(
                    'jobTitle',
                    'سمت',
                    120,
                    !permissions.includes('master_data.create'),
                  )}
                  {field(
                    'phone',
                    'تلفن',
                    32,
                    !permissions.includes('master_data.create'),
                    'tel',
                  )}
                  {field(
                    'email',
                    'ایمیل',
                    200,
                    !permissions.includes('master_data.create'),
                    'email',
                  )}
                  {draft.countryId ? (
                    <>
                      <label className="field">
                        <span>شهر نشانی</span>
                        <input
                          className="input"
                          aria-label="جست‌وجوی شهر"
                          placeholder="جست‌وجوی شهر"
                          value={cityQuery}
                          onChange={(event) => setCityQuery(event.target.value)}
                        />
                        <select
                          className="input"
                          aria-label="شهر نشانی"
                          value={draft.cityId}
                          onChange={(event) =>
                            set('cityId', event.target.value)
                          }
                        >
                          <option value="">انتخاب شهر</option>
                          {cities.map((city) => (
                            <option key={city.id} value={city.id}>
                              {city.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {field('addressLine', 'نشانی کامل', 500)}
                    </>
                  ) : null}
                </div>
                <div className="boundary-note">
                  اتصال کاربر پرتال، تعیین امضادار و دامنه اختیار هنوز در دسترس
                  نیست. ثبت نماینده حساب ورود ایجاد نمی‌کند.
                </div>
              </>
            ) : null}
            {step === 3 ? (
              <>
                <div className="agreement-row-title">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={draft.withAgreement}
                      onChange={(event) =>
                        set('withAgreement', event.target.checked)
                      }
                    />
                    ثبت قرارداد همراه پرونده
                  </label>
                  <span className="panel-note">
                    {draft.withAgreement
                      ? 'پیش‌نویس همراه پرونده ذخیره می‌شود'
                      : 'برای ثبت قرارداد، گزینه را فعال کنید'}
                  </span>
                </div>
                {!canAgreement ? (
                  <p className="boundary-note">
                    برای ذخیره قرارداد، مجوز مدیریت قرارداد و مشاهده قرارداد و
                    اعتبار لازم است. می‌توانید ساختار فرم را بررسی کنید.
                  </p>
                ) : null}
                <label className="field">
                  <span>شعبه قرارداد *</span>
                  <select
                    className="input"
                    value={draft.branchId}
                    onChange={(event) => set('branchId', event.target.value)}
                  >
                    <option value="">انتخاب شعبه</option>
                    {branches.map((branch) => (
                      <option value={branch.id} key={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <AgreementTermsEditor
                  value={draft.agreementTerms}
                  role={draft.role}
                  branchId={draft.branchId}
                  organizationId={existing?.id}
                  permissions={permissions}
                  disabled={busy || stopped}
                  onChange={(agreementTerms) =>
                    setDraft((current) => ({
                      ...current,
                      agreementTerms,
                      withAgreement: true,
                    }))
                  }
                />
              </>
            ) : null}
            {step === 4 ? (
              <>
                <div className="summary-list">
                  {[
                    ['سازمان', draft.legalName],
                    ['کد سازمان', draft.code || 'تخصیص خودکار پس از ثبت'],
                    [
                      'نقش همکاری',
                      draft.role === 'AGENCY' ? 'آژانس' : 'مشتری سازمانی',
                    ],
                    ['نماینده', draft.fullName || 'ثبت نمی‌شود'],
                    ['نشانی', draft.addressLine || 'ثبت نمی‌شود'],
                    [
                      'قرارداد',
                      draft.withAgreement
                        ? `${draft.agreementTerms.title} — پیش‌نویس`
                        : 'ثبت نمی‌شود',
                    ],
                    ...(draft.withAgreement
                      ? [
                          [
                            'ارزهای قرارداد',
                            draft.agreementTerms.currencyCodes.join('، '),
                          ],
                          [
                            'سقف‌های اعتبار',
                            draft.agreementTerms.creditPolicies
                              .map((p) => `${p.creditLimit} ${p.currencyCode}`)
                              .join(' · ') || 'بدون سقف اعتباری',
                          ],
                          [
                            'تضمین‌ها',
                            `${draft.agreementTerms.guarantees.length} مورد`,
                          ],
                        ]
                      : []),
                  ].map(([label, value]) => (
                    <div className="summary-row" key={label}>
                      <span>{label}</span>
                      <b>{value}</b>
                    </div>
                  ))}
                </div>
                <div className="boundary-note">
                  <FileText size={20} />
                  <span>
                    پس از ذخیره، قرارداد و اسناد آن در پرونده قابل ویرایش و
                    ارسال برای تأیید مستقل است. این عملیات اطلاعات پرونده را
                    ذخیره می‌کند و به معنی تأیید اعتبار یا قرارداد نیست.
                  </span>
                </div>
              </>
            ) : null}
            {error ? (
              <div className="form-error" role="alert">
                {error}
                {partial ? (
                  <p>
                    سازمان «{partial.name}» ذخیره شده؛ ادامه عملیات کامل نشده
                    است. برای جلوگیری از ثبت تکراری، پرونده را باز کنید.
                  </p>
                ) : stopped ? (
                  <p>
                    پیش از تلاش دوباره، وجود کد سازمان را در فهرست بررسی کنید.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="wizard-actions">
              <button
                className="btn"
                disabled={step === 1 || busy || stopped}
                onClick={() => {
                  setStep((current) => current - 1);
                  setError('');
                }}
              >
                مرحله قبل
              </button>
              {partial ? (
                <button
                  className="btn primary"
                  onClick={() => onSaved(partial)}
                >
                  مشاهده پرونده ثبت‌شده
                </button>
              ) : (
                <button
                  className="btn primary"
                  disabled={busy || stopped}
                  onClick={() => (step < 4 ? next() : void save())}
                >
                  {busy
                    ? 'در حال ذخیره…'
                    : step === 4
                      ? 'ذخیره پرونده'
                      : 'مرحله بعد'}
                  <ArrowLeft size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
