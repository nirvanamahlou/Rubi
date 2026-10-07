'use client';
import { NativeSearchSelect } from '@/components/ui/native-search-select';

import type {
  B2bPhoneChallengeV1,
  BranchReference,
  IamPermissionCode,
  MasterDataRecord,
} from '@nora/contracts';
import { normalizeIranianMobile } from '@nora/contracts';
import { ArrowLeft, Check, FileText, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { AgreementTermsEditor } from './agreement-terms-editor';
import { blankAgreementTerms } from '../model/agreement-terms';
import { masterDataApi } from '@/modules/master-data/api/client';
import { agencyClient } from '../api/agency-client';
import {
  blankCooperationDraft,
  cooperationIssue,
  CooperationSaveError,
  normalizeOtpCode,
  saveCooperation,
  type CooperationDraft,
} from '../model/cooperation-draft';
import { PhoneVerificationRequestGate } from '../model/phone-verification-lifecycle';

const steps = [
  'هویت و نقش',
  'اشخاص و دسترسی',
  'تأیید شماره',
  'قرارداد و اعتبار',
  'اسناد و تأیید',
];

function freshDraft(role: CooperationDraft['role'], branchId = '') {
  return {
    ...blankCooperationDraft,
    role,
    branchId,
    agreementTerms: blankAgreementTerms(),
    agreementRequestId: crypto.randomUUID(),
    registrationId: crypto.randomUUID(),
  } satisfies CooperationDraft;
}
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
  const [draft, setDraft] = useState<CooperationDraft>(() => freshDraft(role));
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<'new' | 'existing'>('existing');
  const [existing, setExisting] = useState<MasterDataRecord>();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<readonly MasterDataRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [branches, setBranches] = useState<readonly BranchReference[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [partial, setPartial] = useState<MasterDataRecord>();
  const [phoneChallenge, setPhoneChallenge] = useState<B2bPhoneChallengeV1>();
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const phoneRequests = useRef(new PhoneVerificationRequestGate());
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
        if (active) {
          setBranches(items);
          setDraft((current) =>
            current.branchId || !items[0]
              ? current
              : { ...current, branchId: items[0].id },
          );
        }
      })
      .catch(() => {
        if (active) setError('دریافت شعب مجاز ناموفق بود.');
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(
    () => () => {
      phoneRequests.current.invalidate();
    },
    [],
  );
  useEffect(() => {
    if (!draft.phoneVerificationExpiresAt) return;
    const remaining = Date.parse(draft.phoneVerificationExpiresAt) - Date.now();
    const timer = window.setTimeout(
      () => {
        setDraft((current) => ({
          ...current,
          phoneVerificationGrant: undefined,
          phoneVerificationExpiresAt: undefined,
        }));
      },
      Number.isFinite(remaining) ? Math.max(0, remaining) : 0,
    );
    return () => window.clearTimeout(timer);
  }, [draft.phoneVerificationExpiresAt]);

  function changeIdentity(
    update: (current: CooperationDraft) => CooperationDraft,
  ) {
    phoneRequests.current.invalidate();
    setPhoneBusy(false);
    setPhoneChallenge(undefined);
    setPhoneCode('');
    setDraft((current) => ({
      ...update(current),
      registrationId: crypto.randomUUID(),
      phoneVerificationGrant: undefined,
      phoneVerificationExpiresAt: undefined,
    }));
  }

  function verificationInput(current = draft) {
    return {
      registrationId: current.registrationId,
      branchId: current.branchId,
      role: current.role,
      organizationId: existing?.id ?? null,
      phone: current.phone,
    };
  }

  async function requestPhoneCode() {
    const issue = cooperationIssue(draft, 2);
    if (issue) return setError(issue);
    if (!draft.branchId) return setError('شعبه ثبت شماره را انتخاب کنید.');
    const requestId = phoneRequests.current.begin();
    setPhoneBusy(true);
    setError('');
    try {
      const challenge =
        await agencyClient.requestPhoneChallenge(verificationInput());
      if (!phoneRequests.current.isCurrent(requestId)) return;
      setPhoneChallenge(challenge);
      setPhoneCode('');
      setDraft((current) => ({
        ...current,
        phoneVerificationGrant: undefined,
        phoneVerificationExpiresAt: undefined,
      }));
    } catch (caught) {
      if (phoneRequests.current.isCurrent(requestId))
        setError(
          caught instanceof Error ? caught.message : 'ارسال کد ناموفق بود.',
        );
    } finally {
      if (phoneRequests.current.settle(requestId)) setPhoneBusy(false);
    }
  }

  async function verifyPhoneCode() {
    if (!phoneChallenge) return setError('ابتدا کد آزمایشی دریافت کنید.');
    const requestId = phoneRequests.current.begin();
    setPhoneBusy(true);
    setError('');
    try {
      const verified = await agencyClient.verifyPhoneChallenge(
        phoneChallenge.challengeId,
        { ...verificationInput(), code: phoneCode.trim() },
      );
      if (!phoneRequests.current.isCurrent(requestId)) return;
      setDraft((current) => ({
        ...current,
        phoneVerificationGrant: verified.grant,
        phoneVerificationExpiresAt: verified.expiresAt,
      }));
    } catch (caught) {
      if (phoneRequests.current.isCurrent(requestId))
        setError(
          caught instanceof Error ? caught.message : 'تأیید کد ناموفق بود.',
        );
    } finally {
      if (phoneRequests.current.settle(requestId)) setPhoneBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    if (!query.trim() || mode !== 'existing') return;
    const timer = window.setTimeout(() => {
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
  function next() {
    const issue =
      step === 1 && mode === 'existing' && !existing
        ? 'ابتدا سازمان موجود را انتخاب کنید.'
        : step === 3
          ? undefined
          : cooperationIssue(draft, step);
    if (issue) {
      setError(issue);
      return;
    }
    setError('');
    setStep((current) => Math.min(5, current + 1));
  }
  async function save() {
    if (busy || uploading || stopped) return;
    const verificationIssue = cooperationIssue(draft, 3);
    if (verificationIssue) {
      setStep(3);
      setError(verificationIssue);
      return;
    }
    setBusy(true);
    setError('');
    try {
      onSaved(await saveCooperation(draft, permissions, existing));
    } catch (caught) {
      if (caught instanceof CooperationSaveError) {
        setPartial(caught.organization);
        setStopped(
          Boolean(caught.organization) || caught.creationMayHaveSucceeded,
        );
      } else {
        setStopped(false);
      }
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
        disabled={disabled || busy || uploading || stopped}
        value={String(draft[key])}
        placeholder={
          key === 'code' ? 'پس از ثبت، خودکار تولید می‌شود' : undefined
        }
        onChange={(event) =>
          key === 'phone'
            ? changeIdentity((current) => ({
                ...current,
                phone: event.target.value,
              }))
            : set(key, event.target.value)
        }
      />
    </label>
  );
  const canAgreement = (
    ['b2b.agreement.read', 'b2b.credit.read', 'b2b.agreement.manage'] as const
  ).every((permission) => permissions.includes(permission));
  function close() {
    if (busy || uploading) return;
    phoneRequests.current.invalidate();
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
        aria-describedby={undefined}
        className="b2b-design b2b-modal cooperation-modal"
        dir="rtl"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="modal-title">
          <DialogTitle>ایجاد همکاری B2B</DialogTitle>
        </div>
        <div className="wizard">
          <nav className="panel steps" aria-label="مراحل ایجاد همکاری">
            {steps.map((title, index) => (
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
                <b>{title}</b>
              </div>
            ))}
          </nav>
          <div className="panel wizard-body">
            <h3 ref={heading} tabIndex={-1}>
              {
                [
                  'هویت سازمان و نقش همکاری',
                  'اشخاص کلیدی و نشانی همکاری',
                  'تأیید شماره همراه نماینده',
                  'قرارداد چارچوب و سیاست اعتبار',
                  'بازبینی اطلاعات و ثبت پرونده',
                ][step - 1]
              }
            </h3>
            {step === 1 ? (
              <>
                <div className="wizard-mode">
                  <label>
                    <input
                      type="radio"
                      name="identityMode"
                      checked={mode === 'existing'}
                      onChange={() => {
                        phoneRequests.current.invalidate();
                        setPhoneBusy(false);
                        setMode('existing');
                        setExisting(undefined);
                        setPhoneChallenge(undefined);
                        setPhoneCode('');
                        setDraft(freshDraft(role, branches[0]?.id));
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
                        phoneRequests.current.invalidate();
                        setPhoneBusy(false);
                        setMode('new');
                        setExisting(undefined);
                        setPhoneChallenge(undefined);
                        setPhoneCode('');
                        setDraft(freshDraft(role, branches[0]?.id));
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
                      {!query.trim() ? (
                        <p>برای نمایش سازمان‌ها، نام یا کد را جست‌وجو کنید.</p>
                      ) : searching ? (
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
                              phoneRequests.current.invalidate();
                              setPhoneBusy(false);
                              setExisting(record);
                              setPhoneChallenge(undefined);
                              setPhoneCode('');
                              setDraft((current) => ({
                                ...current,
                                registrationId: crypto.randomUUID(),
                                phoneVerificationGrant: undefined,
                                phoneVerificationExpiresAt: undefined,
                                legalName: record.name,
                                code: record.code,
                                nationalId: String(
                                  record.attributes.nationalId ?? '',
                                ),
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
                    <NativeSearchSelect
                      className="input"
                      value={draft.role}
                      onChange={(event) =>
                        changeIdentity((current) => ({
                          ...current,
                          role: event.target.value as CooperationDraft['role'],
                          withAgreement: false,
                        }))
                      }
                    >
                      <option value="AGENCY">آژانس</option>
                      <option value="CORPORATE_CUSTOMER">مشتری سازمانی</option>
                    </NativeSearchSelect>
                  </label>
                  <label className="field">
                    <span>نوع شخصیت</span>
                    <NativeSearchSelect
                      className="input"
                      disabled={mode === 'existing'}
                      value={draft.personType}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          personType: event.target.value,
                          nationalId:
                            event.target.value === 'LEGAL'
                              ? current.nationalId
                              : '',
                        }))
                      }
                    >
                      <option value="LEGAL">حقوقی</option>
                      <option value="NATURAL">حقیقی</option>
                    </NativeSearchSelect>
                  </label>
                  {draft.personType === 'LEGAL' ? (
                    <div className="rounded-xl border border-border bg-white p-3">
                      {field(
                        'nationalId',
                        'شناسه ملی شرکت',
                        11,
                        mode === 'existing',
                      )}
                      <p className="panel-note">
                        ۱۱ رقم از مدارک ثبتی شرکت؛ شناسه ملی خودکار تولید یا
                        استعلام نمی‌شود. شناسه سازمان موجود از «ویرایش اطلاعات»
                        اصلاح می‌شود.
                      </p>
                    </div>
                  ) : null}
                  {field(
                    'addressLine',
                    'نشانی',
                    500,
                    !permissions.includes('master_data.update'),
                  )}
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
                </div>
                <div className="boundary-note">
                  پس از ثبت سازمان، نمایندگان، امضاداران و مدیر حساب را در صفحه
                  مشخصات و نقش‌ها تکمیل کنید. ثبت نماینده حساب ورود پرتال ایجاد
                  نمی‌کند.
                </div>
              </>
            ) : null}
            {step === 3 ? (
              <>
                {!draft.phone.trim() ? (
                  <div className="boundary-note">
                    شماره همراه اختیاری است. چون شماره‌ای وارد نشده، می‌توانید
                    بدون تأیید شماره ادامه دهید.
                  </div>
                ) : (
                  <div className="form-grid">
                    <label className="field">
                      <span>شماره همراه</span>
                      <input
                        className="input"
                        value={
                          normalizeIranianMobile(draft.phone) ?? draft.phone
                        }
                        readOnly
                      />
                      <small className="panel-note">
                        قالب پشتیبانی‌شده: 09xxxxxxxxx یا معادل +98/0098
                      </small>
                    </label>
                    <div className="field">
                      <span>ارسال کد</span>
                      <button
                        type="button"
                        className="btn"
                        disabled={
                          phoneBusy || Boolean(draft.phoneVerificationGrant)
                        }
                        onClick={() => void requestPhoneCode()}
                      >
                        {phoneChallenge
                          ? 'ارسال دوباره کد'
                          : 'دریافت کد آزمایشی'}
                      </button>
                    </div>
                    {phoneChallenge ? (
                      <>
                        {phoneChallenge.developmentCode ? (
                          <div className="boundary-note" role="status">
                            کد آزمایشی؛ پیامک واقعی ارسال نشده:{' '}
                            <bdi>{phoneChallenge.developmentCode}</bdi>
                          </div>
                        ) : null}
                        <label className="field">
                          <span>کد شش‌رقمی</span>
                          <input
                            className="input"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            disabled={
                              phoneBusy || Boolean(draft.phoneVerificationGrant)
                            }
                            value={phoneCode}
                            onChange={(event) =>
                              setPhoneCode(normalizeOtpCode(event.target.value))
                            }
                          />
                        </label>
                        <div className="field">
                          <span>بررسی کد</span>
                          <button
                            type="button"
                            className="btn primary"
                            disabled={
                              phoneBusy ||
                              phoneCode.length !== 6 ||
                              Boolean(draft.phoneVerificationGrant)
                            }
                            onClick={() => void verifyPhoneCode()}
                          >
                            تأیید شماره
                          </button>
                        </div>
                      </>
                    ) : null}
                    {draft.phoneVerificationGrant ? (
                      <div className="boundary-note" role="status">
                        شماره برای همین پیش‌نویس تأیید شد. این تأیید، احراز هویت
                        شرکت یا حساب کاربری نیست.
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          changeIdentity((current) => ({
                            ...current,
                            phone: '',
                          }));
                          setError('');
                        }}
                      >
                        ادامه بدون ثبت شماره
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : null}
            {step === 4 ? (
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
                  <NativeSearchSelect
                    className="input"
                    disabled={Boolean(draft.phoneVerificationGrant)}
                    value={draft.branchId}
                    onChange={(event) => set('branchId', event.target.value)}
                  >
                    <option value="">انتخاب شعبه</option>
                    {branches.map((branch) => (
                      <option value={branch.id} key={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </NativeSearchSelect>
                </label>
                <AgreementTermsEditor
                  onUploadStateChange={setUploading}
                  value={draft.agreementTerms}
                  role={draft.role}
                  branchId={draft.branchId}
                  organizationId={existing?.id}
                  permissions={permissions}
                  pendingDocuments={{
                    agreement: draft.pendingAgreementDocument,
                    guarantees: draft.pendingGuaranteeDocuments,
                  }}
                  onPendingDocumentsChange={(pending) =>
                    setDraft((current) => ({
                      ...current,
                      pendingAgreementDocument: pending.agreement,
                      pendingGuaranteeDocuments: pending.guarantees,
                    }))
                  }
                  disabled={busy || uploading || stopped}
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
            {step === 5 ? (
              <>
                <div className="summary-list">
                  {[
                    ['سازمان', draft.legalName],
                    ['شناسه ملی شرکت', draft.nationalId || 'ثبت نشده'],
                    ['کد سازمان', draft.code || 'تخصیص خودکار پس از ثبت'],
                    [
                      'نقش همکاری',
                      draft.role === 'AGENCY' ? 'آژانس' : 'مشتری سازمانی',
                    ],
                    ['نماینده', draft.fullName || 'ثبت نمی‌شود'],
                    [
                      'شماره همراه',
                      draft.phone
                        ? draft.phoneVerificationGrant
                          ? 'تأیید شده برای ثبت این مخاطب'
                          : 'نیازمند تأیید'
                        : 'ثبت نمی‌شود',
                    ],
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
                disabled={step === 1 || busy || uploading || stopped}
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
              ) : stopped ? (
                <button className="btn primary" onClick={onClose}>
                  بررسی فهرست سازمان‌ها
                </button>
              ) : (
                <button
                  className="btn primary"
                  disabled={busy || uploading || stopped}
                  onClick={() => (step < 5 ? next() : void save())}
                >
                  {busy
                    ? 'در حال ذخیره…'
                    : step === 5
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
