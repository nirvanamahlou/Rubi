'use client';
import { useEffect, useState } from 'react';
import type {
  B2bAgreementTermsV1,
  B2bCooperationRole,
  DocumentListItemV1,
  IamPermissionCode,
  MasterDataRecord,
} from '@rubi/contracts';
import { Plus, Trash2, FileText, ShieldCheck, Wallet } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { masterDataApi } from '@/modules/master-data/api/client';
import { documentsApi } from '@/modules/documents/api/client';
import {
  canReadOrganizationDocuments,
  organizationDocumentQuery,
} from '../model/organization-documents';
import { serviceLabels } from '../model/agreement-terms';
import { B2B_AGREEMENT_TYPES } from '@rubi/contracts';
import { MasterDataReferenceSelector } from '@/modules/master-data/components/master-data-reference-selector';
import { InlineDocumentUpload } from './inline-document-upload';

export function AgreementTermsEditor({
  value,
  onChange,
  role,
  branchId,
  organizationId,
  permissions,
  disabled = false,
  onUploadStateChange,
}: {
  value: B2bAgreementTermsV1;
  onChange: (terms: B2bAgreementTermsV1) => void;
  role: B2bCooperationRole;
  branchId: string;
  organizationId?: string | undefined;
  permissions: readonly IamPermissionCode[];
  disabled?: boolean;
  onUploadStateChange?: (busy: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const uploadBusy = (busy: boolean) => {
    setUploading(busy);
    onUploadStateChange?.(busy);
  };
  const [currencies, setCurrencies] = useState<readonly MasterDataRecord[]>([]);
  const [documents, setDocuments] = useState<readonly DocumentListItemV1[]>([]);
  const [error, setError] = useState('');
  const [documentPage, setDocumentPage] = useState(1);
  const [documentPages, setDocumentPages] = useState(1);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void masterDataApi
      .list('currencies', {
        search: '',
        status: 'active',
        page: 1,
        pageSize: 100,
        sortBy: 'name',
        sortDirection: 'asc',
      })
      .then((result) => {
        if (active) setCurrencies(result.data);
      })
      .catch(() => {
        if (active) setError('دریافت ارزها ناموفق بود؛ دوباره تلاش کنید.');
      });
    return () => {
      active = false;
    };
  }, [reload]);
  useEffect(() => {
    let active = true;
    if (
      !organizationId ||
      !branchId ||
      !canReadOrganizationDocuments(permissions)
    )
      return;
    void documentsApi
      .list({
        ...organizationDocumentQuery(organizationId, branchId, documentPage),
        pageSize: 100,
      })
      .then((result) => {
        if (active) {
          setDocuments(result.data);
          setDocumentPages(result.meta.totalPages);
        }
      })
      .catch(() => {
        if (active) setError('دریافت اسناد مرتبط ناموفق بود.');
      });
    return () => {
      active = false;
    };
  }, [organizationId, branchId, documentPage, permissions, reload]);
  const set = <K extends keyof B2bAgreementTermsV1>(
    key: K,
    next: B2bAgreementTermsV1[K],
  ) => onChange({ ...value, [key]: next });
  const text = (
    key:
      'title' | 'cancellationTerms' | 'refundTerms' | 'notes' | 'changeReason',
    label: string,
    multiline = false,
  ) => (
    <label className={`field ${multiline ? 'full' : ''}`}>
      <span>{label}</span>
      {multiline ? (
        <textarea
          className="textarea"
          maxLength={key === 'changeReason' ? 500 : 2000}
          value={value[key]}
          onChange={(e) => set(key, e.target.value)}
        />
      ) : (
        <input
          className="input"
          maxLength={160}
          value={value[key]}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </label>
  );
  const select = <T extends string>(
    label: string,
    current: T,
    choices: readonly (readonly [T, string])[],
    change: (next: T) => void,
  ) => (
    <label className="field">
      <span>{label}</span>
      <select
        className="input"
        value={current}
        onChange={(e) => change(e.target.value as T)}
      >
        {choices.map(([key, title]) => (
          <option key={key} value={key}>
            {title}
          </option>
        ))}
      </select>
    </label>
  );
  const date = (
    label: string,
    current: string | null,
    change: (next: string) => void,
  ) => (
    <div className="field">
      <span>{label}</span>
      <DatePicker
        withinDialog
        aria-label={label}
        value={current ?? ''}
        required={label.includes('*')}
        onChange={change}
        disabled={disabled}
      />
    </div>
  );
  const document = (
    label: string,
    id: string | null,
    change: (id: string | null) => void,
    inlineOnly = false,
  ) => (
    <div className="field full">
      <span>{label}</span>
      {inlineOnly ? (
        id ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <span>
              سند متصل:{' '}
              {documents.find((d) => d.id === id)?.title ??
                'سند ثبت‌شده قرارداد'}
            </span>
            <button type="button" className="btn" onClick={() => change(null)}>
              برداشتن پیوست از قرارداد
            </button>
          </div>
        ) : null
      ) : (
        <select
          className="input"
          value={id ?? ''}
          aria-label={label}
          disabled={
            !organizationId || !canReadOrganizationDocuments(permissions)
          }
          onChange={(e) => change(e.target.value || null)}
        >
          <option value="">بدون پیوست</option>
          {id && !documents.some((d) => d.id === id) ? (
            <option value={id}>سند انتخاب‌شده (نسخه ثبت‌شده)</option>
          ) : null}
          {documents.map((item) => (
            <option
              key={item.id}
              value={item.id}
              disabled={
                ['INFECTED', 'QUARANTINED', 'SCAN_FAILED'].includes(
                  item.currentVersion.scanStatus,
                ) || item.isIncomplete
              }
            >
              {item.title}
              {item.currentVersion.scanStatus !== 'CLEAN'
                ? ' — در انتظار بررسی'
                : ''}
            </option>
          ))}
        </select>
      )}
      {organizationId &&
      branchId &&
      permissions.includes('documents.upload') &&
      canReadOrganizationDocuments(permissions) ? (
        <InlineDocumentUpload
          expanded={inlineOnly}
          organizationId={organizationId}
          branchId={branchId}
          label={label}
          permissions={permissions}
          onBusyChange={uploadBusy}
          onUploaded={(documentId) => {
            change(documentId);
            setReload((n) => n + 1);
          }}
        />
      ) : null}
    </div>
  );
  const currencyChoices = value.currencyCodes.map(
    (code) => [code, code] as const,
  );
  return (
    <fieldset className="agreement-editor" disabled={disabled || uploading}>
      {error ? (
        <div role="alert" className="form-error">
          {error}{' '}
          <button
            type="button"
            className="btn"
            onClick={() => {
              setError('');
              setReload((x) => x + 1);
            }}
          >
            تلاش دوباره
          </button>
        </div>
      ) : null}
      <section className="agreement-section">
        <div className="agreement-section-title">
          <FileText size={20} />
          <div>
            <h4>مشخصات و شرایط قرارداد</h4>
            <p>دامنه خدمات، اعتبار زمانی و شیوه تسویه همکاری</p>
          </div>
          <span className="badge">پیش‌نویس</span>
        </div>
        <div className="form-grid">
          {text('title', 'عنوان قرارداد *')}
          {select(
            'نوع قرارداد',
            value.agreementType,
            Object.entries(B2B_AGREEMENT_TYPES).filter(([key]) =>
              role === 'AGENCY' ? key !== 'CORPORATE' : key !== 'AGENCY',
            ) as [keyof typeof B2B_AGREEMENT_TYPES, string][],
            (v) => set('agreementType', v),
          )}
          {date('شروع قرارداد *', value.startsAt, (v) => set('startsAt', v))}
          {date('پایان قرارداد', value.endsAt, (v) => set('endsAt', v || null))}
          <fieldset className="field full">
            <legend>خدمات مشمول قرارداد *</legend>
            <div className="agreement-options">
              {Object.entries(serviceLabels).map(([code, label]) => (
                <label className="check" key={code}>
                  <input
                    type="checkbox"
                    checked={value.services.includes(
                      code as keyof typeof serviceLabels,
                    )}
                    onChange={(e) =>
                      set(
                        'services',
                        e.target.checked
                          ? [
                              ...value.services,
                              code as keyof typeof serviceLabels,
                            ]
                          : value.services.filter((item) => item !== code),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="field full">
            <legend>ارزهای قرارداد *</legend>
            <div className="agreement-options">
              {currencies.map((currency) => (
                <label className="check" key={currency.id}>
                  <input
                    type="checkbox"
                    checked={value.currencyCodes.includes(currency.code)}
                    onChange={(e) =>
                      set(
                        'currencyCodes',
                        e.target.checked
                          ? [...value.currencyCodes, currency.code]
                          : value.currencyCodes.filter(
                              (code) => code !== currency.code,
                            ),
                      )
                    }
                  />
                  {currency.name} <span dir="ltr">{currency.code}</span>
                </label>
              ))}
            </div>
            {!currencies.length ? (
              <small>فهرست ارزهای فعال اطلاعات پایه در حال دریافت است.</small>
            ) : null}
            {value.currencyCodes
              .filter((code) => !currencies.some((c) => c.code === code))
              .map((code) => (
                <label className="check" key={code}>
                  <input
                    type="checkbox"
                    checked
                    onChange={() =>
                      set(
                        'currencyCodes',
                        value.currencyCodes.filter((c) => c !== code),
                      )
                    }
                  />
                  {code} — خارج از فهرست فعال
                </label>
              ))}
          </fieldset>
          {select(
            'شرایط تسویه',
            value.paymentMethod,
            [
              ['PREPAID', 'پیش‌پرداخت'],
              ['CREDIT', 'اعتباری'],
              ['MIXED', 'ترکیبی'],
            ],
            (v) => set('paymentMethod', v),
          )}
          <div className="field">
            <label htmlFor="agreement-payment-method">
              روش پرداخت از اطلاعات پایه *
            </label>
            <MasterDataReferenceSelector
              closeOnSelect
              id="agreement-payment-method"
              label="روش پرداخت"
              config={{ target: 'payment-methods', payload: 'id' }}
              value={value.paymentMethodId ?? ''}
              required
              disabled={disabled || uploading}
              onChange={(id) => set('paymentMethodId', id || null)}
            />
          </div>
          {select(
            'چرخه تسویه',
            value.settlementCycle,
            [
              ['PER_ORDER', 'برای هر سفارش'],
              ['WEEKLY', 'هفتگی'],
              ['MONTHLY', 'ماهانه'],
              ['CUSTOM', 'تعداد روز مشخص'],
            ],
            (v) =>
              onChange({
                ...value,
                settlementCycle: v,
                cutoffDay: v === 'MONTHLY' ? (value.cutoffDay ?? 1) : null,
              }),
          )}
          <label className="field">
            <span>مهلت تسویه (روز)</span>
            <input
              className="input"
              type="number"
              min={0}
              max={365}
              value={value.settlementDays}
              onChange={(e) => set('settlementDays', Number(e.target.value))}
            />
          </label>
          {value.settlementCycle === 'MONTHLY' ? (
            <label className="field">
              <span>روز بستن حساب ماهانه</span>
              <input
                className="input"
                type="number"
                min={1}
                max={28}
                value={value.cutoffDay ?? 1}
                onChange={(e) => set('cutoffDay', Number(e.target.value))}
              />
            </label>
          ) : null}
          <label className="field">
            <span>مهلت پاسخ‌گویی (ساعت)</span>
            <input
              className="input"
              type="number"
              min={1}
              max={720}
              value={value.slaHours ?? ''}
              onChange={(e) =>
                set('slaHours', e.target.value ? Number(e.target.value) : null)
              }
            />
          </label>
          {text('cancellationTerms', 'شرایط لغو و جریمه', true)}
          {text('refundTerms', 'شرایط استرداد', true)}
          {document(
            'سند قرارداد',
            value.documentId,
            (id) =>
              onChange({ ...value, documentId: id, documentVersionId: null }),
            true,
          )}
        </div>
      </section>
      <section className="agreement-section credit-section">
        <div className="agreement-section-title">
          <Wallet size={20} />
          <div>
            <h4>سیاست اعتبار به تفکیک ارز</h4>
            <p>هر ارز سقف مستقل دارد؛ تبدیل ارز انجام نمی‌شود.</p>
          </div>
          <button
            type="button"
            className="btn"
            disabled={
              !value.currencyCodes.some(
                (c) => !value.creditPolicies.some((p) => p.currencyCode === c),
              )
            }
            onClick={() =>
              set('creditPolicies', [
                ...value.creditPolicies,
                {
                  currencyCode: value.currencyCodes.find(
                    (c) =>
                      !value.creditPolicies.some((p) => p.currencyCode === c),
                  )!,
                  creditLimit: '0',
                  limitType: 'HARD',
                  dueDays: 0,
                  overdueAction: 'BLOCK',
                  effectiveFrom: value.startsAt,
                  expiresAt: value.endsAt,
                },
              ])
            }
          >
            <Plus size={16} />
            افزودن سقف ارزی
          </button>
        </div>
        {!value.creditPolicies.length ? (
          <p className="panel-note">
            برای پرداخت اعتباری یا ترکیبی، حداقل یک سقف ارزی اضافه کنید.
          </p>
        ) : null}
        {value.creditPolicies.map((policy, index) => (
          <div className="agreement-subcard" key={index}>
            <div className="agreement-row-title">
              <b>سقف اعتبار {policy.currencyCode}</b>
              <button
                type="button"
                className="btn danger"
                aria-label={`حذف سقف ${policy.currencyCode}`}
                onClick={() =>
                  set(
                    'creditPolicies',
                    value.creditPolicies.filter((_, i) => i !== index),
                  )
                }
              >
                <Trash2 size={16} />
                حذف
              </button>
            </div>
            <div className="form-grid">
              {select('ارز اعتبار', policy.currencyCode, currencyChoices, (v) =>
                set(
                  'creditPolicies',
                  value.creditPolicies.map((p, i) =>
                    i === index ? { ...p, currencyCode: v } : p,
                  ),
                ),
              )}
              <label className="field">
                <span>سقف اعتبار *</span>
                <input
                  className="input"
                  dir="ltr"
                  inputMode="decimal"
                  value={policy.creditLimit}
                  onChange={(e) =>
                    set(
                      'creditPolicies',
                      value.creditPolicies.map((p, i) =>
                        i === index ? { ...p, creditLimit: e.target.value } : p,
                      ),
                    )
                  }
                />
              </label>
              {select(
                'رفتار در بدهی سررسیدشده',
                policy.overdueAction,
                [
                  ['BLOCK', 'توقف اعتبار'],
                  ['WARN', 'هشدار'],
                ],
                (v) =>
                  set(
                    'creditPolicies',
                    value.creditPolicies.map((p, i) =>
                      i === index ? { ...p, overdueAction: v } : p,
                    ),
                  ),
              )}
              <label className="field">
                <span>مهلت پرداخت بدهی (روز)</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={365}
                  value={policy.dueDays}
                  onChange={(e) =>
                    set(
                      'creditPolicies',
                      value.creditPolicies.map((p, i) =>
                        i === index
                          ? { ...p, dueDays: Number(e.target.value) }
                          : p,
                      ),
                    )
                  }
                />
              </label>
              {date(
                `شروع سقف ${policy.currencyCode}`,
                policy.effectiveFrom,
                (v) =>
                  set(
                    'creditPolicies',
                    value.creditPolicies.map((p, i) =>
                      i === index ? { ...p, effectiveFrom: v } : p,
                    ),
                  ),
              )}
              {date(`پایان سقف ${policy.currencyCode}`, policy.expiresAt, (v) =>
                set(
                  'creditPolicies',
                  value.creditPolicies.map((p, i) =>
                    i === index ? { ...p, expiresAt: v || null } : p,
                  ),
                ),
              )}
            </div>
          </div>
        ))}
      </section>
      <section className="agreement-section guarantee-section">
        <div className="agreement-section-title">
          <ShieldCheck size={20} />
          <div>
            <h4>تضمین‌ها و اسناد پشتیبان</h4>
            <p>مشخصات تضمین و نسخه سند آن همراه قرارداد ثبت می‌شود.</p>
          </div>
          <button
            type="button"
            className="btn"
            disabled={
              !value.currencyCodes.length || value.guarantees.length >= 20
            }
            onClick={() =>
              set('guarantees', [
                ...value.guarantees,
                {
                  kind: 'BANK_GUARANTEE',
                  reference: '',
                  amount: '',
                  currencyCode: value.currencyCodes[0]!,
                  issuer: '',
                  receivedAt: value.startsAt,
                  expiresAt: value.endsAt,
                  status: 'REQUIRED',
                  documentId: null,
                },
              ])
            }
          >
            <Plus size={16} />
            افزودن تضمین
          </button>
        </div>
        {!value.guarantees.length ? (
          <p className="panel-note">
            در صورت نیاز، ضمانت‌نامه بانکی، چک یا شرط سپرده را اضافه کنید.
          </p>
        ) : null}
        {value.guarantees.map((guarantee, index) => {
          const update = (patch: Partial<typeof guarantee>) =>
            set(
              'guarantees',
              value.guarantees.map((g, i) =>
                i === index ? { ...g, ...patch } : g,
              ),
            );
          return (
            <div className="agreement-subcard" key={index}>
              <div className="agreement-row-title">
                <b>تضمین {new Intl.NumberFormat('fa-IR').format(index + 1)}</b>
                <button
                  type="button"
                  className="btn danger"
                  aria-label={`حذف تضمین ${index + 1}`}
                  onClick={() =>
                    set(
                      'guarantees',
                      value.guarantees.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Trash2 size={16} />
                  حذف
                </button>
              </div>
              <div className="form-grid">
                {select(
                  'نوع تضمین',
                  guarantee.kind,
                  [
                    ['BANK_GUARANTEE', 'ضمانت‌نامه بانکی'],
                    ['CHEQUE', 'چک تضمین'],
                    ['DEPOSIT_REQUIREMENT', 'شرط سپرده نقدی'],
                    ['OTHER', 'سایر تضمین‌ها'],
                  ],
                  (v) =>
                    update({
                      kind: v,
                      ...(v === 'DEPOSIT_REQUIREMENT'
                        ? { status: 'REQUIRED' }
                        : {}),
                    }),
                )}
                <label className="field">
                  <span>شماره / شناسه تضمین *</span>
                  <input
                    className="input"
                    maxLength={120}
                    value={guarantee.reference}
                    onChange={(e) => update({ reference: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>مبلغ تضمین *</span>
                  <input
                    className="input"
                    dir="ltr"
                    inputMode="decimal"
                    value={guarantee.amount}
                    onChange={(e) => update({ amount: e.target.value })}
                  />
                </label>
                {select(
                  'ارز تضمین',
                  guarantee.currencyCode,
                  currencyChoices,
                  (v) => update({ currencyCode: v }),
                )}
                <label className="field">
                  <span>صادرکننده / متعهد *</span>
                  <input
                    className="input"
                    maxLength={160}
                    value={guarantee.issuer}
                    onChange={(e) => update({ issuer: e.target.value })}
                  />
                </label>
                {select(
                  'وضعیت تضمین',
                  guarantee.status,
                  [
                    ['REQUIRED', 'موردنیاز / در انتظار دریافت'],
                    ...(guarantee.kind !== 'DEPOSIT_REQUIREMENT'
                      ? [['RECEIVED', 'دریافت‌شده با سند'] as const]
                      : []),
                  ],
                  (v) => update({ status: v }),
                )}
                {date(`تاریخ تضمین ${index + 1}`, guarantee.receivedAt, (v) =>
                  update({ receivedAt: v }),
                )}
                {date(`انقضای تضمین ${index + 1}`, guarantee.expiresAt, (v) =>
                  update({ expiresAt: v || null }),
                )}
                {document(
                  `سند تضمین ${index + 1}`,
                  guarantee.documentId,
                  (id) => update({ documentId: id, documentVersionId: null }),
                )}
              </div>
            </div>
          );
        })}
        <p className="panel-note">
          ثبت شرط سپرده، دریافت وجه ثبت نمی‌کند. دریافت و مانده سپرده در بخش
          مالی مدیریت می‌شود.
        </p>
      </section>
      {!organizationId ? (
        <p className="boundary-note">
          پس از ثبت سازمان، مدارک را در پرونده بارگذاری و به پیش‌نویس متصل کنید.
        </p>
      ) : canReadOrganizationDocuments(permissions) ? (
        <div className="agreement-row-title">
          <span className="panel-note">
            فایل هر مدرک را در محل همان قرارداد یا تضمین بارگذاری کنید. اسناد
            ذخیره‌شده همین سازمان و شعبه نیز قابل انتخاب‌اند.
          </span>
          <button
            type="button"
            className="btn"
            onClick={() => setReload((x) => x + 1)}
          >
            تازه‌سازی اسناد
          </button>
          {documentPages > 1 ? (
            <>
              <button
                type="button"
                className="btn"
                disabled={documentPage <= 1}
                onClick={() => setDocumentPage((p) => p - 1)}
              >
                اسناد قبلی
              </button>
              <button
                type="button"
                className="btn"
                disabled={documentPage >= documentPages}
                onClick={() => setDocumentPage((p) => p + 1)}
              >
                اسناد بعدی
              </button>
            </>
          ) : null}
        </div>
      ) : (
        <p className="panel-note">
          برای اتصال سند، مجوز مشاهده اسناد سازمان لازم است.
        </p>
      )}
      <div className="form-grid">
        {text('notes', 'یادداشت تکمیلی', true)}
        {text('changeReason', 'دلیل ثبت یا اصلاح این نسخه *', true)}
      </div>
      <div className="boundary-note">
        ذخیره، پیش‌نویس ایجاد می‌کند. فعال‌سازی قرارداد و سقف‌ها پس از ارسال و
        تأیید یک کاربر مستقل دارای مجوز انجام می‌شود.
      </div>
    </fieldset>
  );
}
