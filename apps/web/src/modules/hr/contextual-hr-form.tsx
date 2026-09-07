'use client';

import { ExternalLink, Info, Upload } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import type { HrSectionId } from './hr.model';
import styles from './hr-workspace.module.css';
import { RequiredFieldLabel } from './required-field-label';

export interface ContextualHrFormContext {
  section: HrSectionId;
  tab: string;
  title: string;
  description: string;
  columns: readonly string[];
  mode: 'create' | 'edit';
  rowIndex?: number;
  initialValues?: readonly string[];
  peopleOptions?: readonly string[];
  employeeDetails?: readonly {
    name: string;
    position: string;
    grade: string;
  }[];
  contractNumbersByEmployee?: Readonly<Record<string, string>>;
  linkedEmployeeName?: string;
}

type ContextualFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'time'
  | 'select'
  | 'combobox'
  | 'file'
  | 'url'
  | 'textarea';

export interface ContextualHrField {
  id: string;
  label: string;
  type: ContextualFieldType;
  required: boolean;
  options?: readonly string[];
  placeholder?: string;
}

const sectionPurposes: Partial<Record<HrSectionId, string>> = {
  recruitment:
    'اطلاعات برنامه جذب، متقاضی، مرحله مصاحبه و پیشنهاد استخدام را ثبت کنید.',
  lifecycle:
    'مرحله چرخه همکاری، مسئول اجرا، تاریخ اثر و وضعیت تکمیل را مشخص کنید.',
  contracts: 'مشخصات قرارداد، بازه اعتبار، نسخه و وضعیت همکاری را تکمیل کنید.',
  time: 'کارمند، تاریخ کارکرد، شیفت یا نوع درخواست و وضعیت تأیید را ثبت کنید.',
  development:
    'دوره، هدف یا برنامه توسعه، مسئول ارزیابی و نتیجه مورد انتظار را مشخص کنید.',
  expenses: 'کارمند، نوع هزینه، ارز، مبلغ و مرحله تأیید مالی را تکمیل کنید.',
  benefits: 'نوع مزیت یا تکلیف قانونی، دوره، مبنا و وضعیت بررسی را ثبت کنید.',
  assets: 'کارمند، تجهیز، شناسه دارایی، تاریخ تحویل و وضعیت را مشخص کنید.',
  fleet: 'خودرو یا سابقه استفاده، کارمند، بازه زمانی و وضعیت را ثبت کنید.',
  documents:
    'نوع مدرک، نسخه، تاریخ انقضا، سطح دسترسی و وضعیت بررسی را مشخص کنید.',
  requests:
    'نوع درخواست، درخواست‌کننده، مالک مرحله، موعد و وضعیت گردش‌کار را ثبت کنید.',
  finance:
    'دوره، نسخه مبنا، حساب مقصد، مالک و وضعیت انتقال به مالی را مشخص کنید.',
  reports:
    'عنوان گزارش، دامنه، تاریخ مبنا، مالک و نوع خروجی مجاز را تعیین کنید.',
  payroll:
    'دوره حقوق، ساختار یا مؤلفه، نسخه محاسبه و وضعیت پردازش را مشخص کنید.',
  hrSettings:
    'دامنه تنظیم، کنترل امنیتی، وابستگی و وضعیت فعال‌سازی را ثبت کنید.',
};

const defaultPeopleOptions = [
  'همکار نمایشی الف',
  'همکار نمایشی ب',
  'همکار نمایشی پ',
  'همکار نمایشی ت',
  'مدیر منابع انسانی',
  'مدیر عملیات',
  'مدیر فروش',
] as const;

const fieldOptions = (
  label: string,
  peopleOptions: readonly string[] = defaultPeopleOptions,
): readonly string[] | undefined => {
  if (label === 'نوع مدرک')
    return [
      'کارت ملی',
      'شناسنامه',
      'گذرنامه',
      'مدرک تحصیلی',
      'گواهی آموزشی',
      'گواهی مهارت',
      'گواهی عدم سوءپیشینه',
      'گواهی سلامت و طب کار',
      'کارت پایان خدمت یا معافیت',
      'رزومه متقاضی',
      'سایر مدارک پرسنلی',
    ];
  if (label.includes('نوع قرارداد'))
    return [
      'تمام‌وقت',
      'پاره‌وقت',
      'مدت‌معین',
      'پروژه‌ای و پیمانکاری',
      'مشاوره',
      'کارآموزی',
      'عدم افشای اطلاعات (NDA)',
      'عدم رقابت',
      'محرمانگی و مالکیت فکری',
    ];
  if (label.includes('وضعیت'))
    return [
      'پیش‌نویس',
      'در انتظار تأیید',
      'در انتظار تأیید مالی',
      'ارسال‌شده به مالی',
      'تأییدشده',
      'فعال',
      'تکمیل‌شده',
      'غیرفعال',
    ];
  if (/ارزیاب|مصاحبه‌کننده|تأییدکننده/.test(label))
    return Array.from(new Set([...peopleOptions, ...defaultPeopleOptions]));
  if (label === 'ارز' || /کد ارز|ارز پرداخت|ارز هزینه|ارز مبنا/.test(label))
    return ['IRR', 'USD', 'EUR', 'AED'];
  if (/مشمول|قابل انتقال|الزامی|تحویل دارایی|قطع دسترسی/.test(label))
    return ['بله', 'خیر'];
  if (
    label.includes('کارمند') ||
    label === 'درخواست‌کننده' ||
    label.includes('نام درخواست‌کننده')
  )
    return Array.from(new Set([...peopleOptions, ...defaultPeopleOptions]));
  if (label === 'مدیر مستقیم')
    return Array.from(
      new Set(['بدون مدیر مستقیم', ...peopleOptions, ...defaultPeopleOptions]),
    );
  if (
    label.includes('مسئول') ||
    label.includes('مالک') ||
    label.includes('مدیر')
  )
    return ['منابع انسانی', 'مدیر مستقیم', 'مالی', 'مدیر سیستم'];
  if (label.includes('واحد'))
    return [
      'عملیات سفر',
      'فروش سازمانی',
      'خدمات فرودگاهی',
      'مالی و خزانه‌داری',
      'منابع انسانی',
      'بازاریابی',
      'فناوری اطلاعات',
    ];
  if (label.includes('شعبه')) return ['نیایش سیر', 'جهان باستان'];
  if (label === 'شرکت') return ['نیایش سیر', 'جهان باستان'];
  if (/رده (شغلی|فعلی|جدید)/.test(label))
    return ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'مدیریتی'];
  if (label.includes('نوع همکاری'))
    return ['تمام‌وقت', 'پاره‌وقت', 'پروژه‌ای', 'کارآموزی'];
  if (label.includes('منبع جذب'))
    return ['جابینجا', 'جاب‌ویژن', 'وب‌سایت شرکت', 'لینکدین', 'معرفی داخلی'];
  if (label.includes('فرصت شغلی'))
    return [
      'کارشناس ارشد عملیات سفر',
      'کارشناس فروش سازمانی',
      'کارشناس حسابداری',
      'کارشناس خدمات فرودگاهی',
    ];
  if (label.includes('مرحله فعلی'))
    return [
      'دریافت رزومه',
      'غربالگری',
      'مصاحبه منابع انسانی',
      'مصاحبه فنی',
      'پیشنهاد استخدام',
      'استخدام‌شده',
      'ردشده',
    ];
  if (label.includes('نوع مرخصی'))
    return ['استحقاقی', 'استعلاجی', 'بدون حقوق', 'جبرانی'];
  if (label.includes('نوع تردد')) return ['ورود', 'خروج'];
  if (label.includes('نوع مؤلفه')) return ['دریافتی', 'کسورات'];
  if (/نوع پایان همکاری|نوع خاتمه/.test(label))
    return ['پایان مدت', 'استعفا', 'فسخ', 'بازنشستگی'];
  if (label.includes('نوع خروجی')) return ['نمایش', 'PDF', 'Excel'];
  if (/سطح دسترسی|نوع دسترسی/.test(label))
    return ['عمومی', 'داخلی', 'محرمانه', 'خیلی محرمانه'];
  if (label.startsWith('نوع ')) return ['عادی', 'ویژه', 'موقت'];
  if (label.includes('مرحله'))
    return ['ثبت اولیه', 'بررسی مدیر', 'تأیید منابع انسانی', 'تکمیل'];
  if (/سطح فعلی|سطح هدف|سطح موجود|سطح موردنیاز/.test(label))
    return ['مقدماتی', 'متوسط', 'پیشرفته', 'خبره'];
  if (label.includes('رتبه'))
    return ['نیازمند بهبود', 'مطابق انتظار', 'فراتر از انتظار'];
  if (label.includes('تقویم')) return ['شمسی', 'میلادی', 'تقویم تهران'];
  if (label.includes('خروجی')) return ['نمایش', 'PDF', 'Excel'];
  return undefined;
};

const fieldType = (label: string): ContextualFieldType => {
  if (/رزومه|فایل پیوست|^فایل$/.test(label)) return 'file';
  if (label.includes('لینک')) return 'url';
  if (/ارزیاب|مصاحبه‌کننده|تأییدکننده/.test(label)) return 'combobox';
  if (/ساعت (شروع|پایان|مصاحبه|تردد|تحویل|عودت)/.test(label)) return 'time';
  if (
    /تاریخ|موعد|تولد|انقضا|مهلت|آخرین روز کاری/.test(label) &&
    !label.includes('بازه')
  )
    return 'date';
  if (
    /مبلغ|امتیاز|تعداد|ظرفیت|بودجه|حقوق|درصد|وزن|نرخ|سهمیه|مسافت|کیلومتر|ترتیب|روز باقی‌مانده|کارکرد فعلی/.test(
      label,
    )
  )
    return 'number';
  if (fieldOptions(label)) return 'select';
  if (/شرح|توضیح|بازخورد|نتیجه|دلیل|هدف|نقاط|دستاورد|چالش/.test(label))
    return 'textarea';
  return 'text';
};

const optionalField = (label: string) =>
  /نتیجه|خروجی|پایان|انقضا|تکمیل|وابستگی|اثر مالی|حساب مقصد|لینک|رزومه|فایل پیوست|مدت محرمانگی|مرجع حل اختلاف/.test(
    label,
  );

export function buildContextualHrFields(
  columns: readonly string[],
  peopleOptions: readonly string[] = defaultPeopleOptions,
): readonly ContextualHrField[] {
  return columns
    .filter((column) => column !== 'عملیات')
    .map((label, index) => {
      const options = fieldOptions(label, peopleOptions);
      return {
        id: `field-${index + 1}`,
        label,
        type: fieldType(label),
        required: !optionalField(label),
        ...(options ? { options } : {}),
        placeholder: `ورود ${label}`,
      };
    });
}

const hrAttachmentPrefix = 'hr-attachment://';
const hrAttachmentStoragePrefix = 'rubi.hr.attachment.';

export interface HrAttachmentReference {
  id: string;
  name: string;
}

export function parseHrAttachmentReference(
  value: string,
): HrAttachmentReference | null {
  if (!value.startsWith(hrAttachmentPrefix)) return null;
  const [id = '', encodedName = ''] = value
    .slice(hrAttachmentPrefix.length)
    .split('|');
  if (!id || !encodedName) return null;
  try {
    return { id, name: decodeURIComponent(encodedName) };
  } catch {
    return null;
  }
}

async function storeHrAttachment(file: File): Promise<string> {
  const allowed = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);
  if (!allowed.has(file.type) || !/\.(pdf|doc|docx|jpg|jpeg|png|webp)$/i.test(file.name))
    throw new Error('فایل باید PDF، DOC، DOCX، JPG، PNG یا WEBP باشد.');
  if (file.size > 5 * 1024 * 1024)
    throw new Error('حجم فایل باید حداکثر ۵ مگابایت باشد.');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('خواندن فایل انجام نشد.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
  const id = `document-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    window.sessionStorage.setItem(`${hrAttachmentStoragePrefix}${id}`, dataUrl);
  } catch {
    throw new Error('فضای ذخیره موقت مرورگر برای این فایل کافی نیست.');
  }
  return `${hrAttachmentPrefix}${id}|${encodeURIComponent(file.name)}`;
}

export function openHrAttachment(value: string): boolean {
  const reference = parseHrAttachmentReference(value);
  if (!reference || typeof window === 'undefined') return false;
  const dataUrl = window.sessionStorage.getItem(
    `${hrAttachmentStoragePrefix}${reference.id}`,
  );
  if (!dataUrl) return false;
  window.open(dataUrl, '_blank', 'noopener,noreferrer');
  return true;
}

const normalizeDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

function persianDateToIso(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(
    normalizeDigits(value.trim()),
  );
  if (!match) return value;
  const target = `${match[1]}-${match[2]?.padStart(2, '0')}-${match[3]?.padStart(2, '0')}`;
  const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const start = new Date(Number(match[1]) + 620, 0, 1, 12);
  const end = new Date(Number(match[1]) + 622, 11, 31, 12);
  for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
    const parts = formatter.formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value.padStart(2, '0') ?? '';
    if (`${part('year')}-${part('month')}-${part('day')}` === target) {
      const year = String(date.getFullYear());
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  return value;
}

const isAutomaticCodeField = (field: ContextualHrField, index: number) =>
  (index === 0 && field.label.includes('شناسه')) ||
  field.label.startsWith('کد') ||
  /شماره (قرارداد|حکم|درخواست)/.test(field.label);

const isAutomaticRegistrationDate = (label: string) =>
  /^(تاریخ|زمان) (ثبت|ایجاد)$/.test(label);

const isContextDerivedField = (
  context: ContextualHrFormContext,
  field: ContextualHrField,
) =>
  (context.section === 'lifecycle' &&
    context.tab === 'promotion' &&
    /^(سمت فعلی|رده فعلی)$/.test(field.label)) ||
  (context.section === 'contracts' &&
    context.tab === 'alerts' &&
    field.label === 'شماره قرارداد') ||
  (context.section === 'lifecycle' &&
    context.tab === 'settlement' &&
    field.label === 'وضعیت تأیید مالی');

const todayIso = () => new Date().toISOString().slice(0, 10);

function buildInitialFormValues(
  context: ContextualHrFormContext,
  fields: readonly ContextualHrField[],
): Record<string, string> {
  const initial = Object.fromEntries(
    fields.map((field, index) => [
      field.id,
      context.initialValues?.[index] !== undefined
        ? field.type === 'date'
          ? persianDateToIso(context.initialValues[index] ?? '')
          : (context.initialValues[index] ?? '')
        : isAutomaticRegistrationDate(field.label)
          ? todayIso()
          : context.section === 'lifecycle' &&
              context.tab === 'settlement' &&
              field.label === 'وضعیت تأیید مالی'
            ? 'در انتظار تأیید مالی'
            : (field.options?.[0] ??
              (isAutomaticCodeField(field, index)
                ? `HR-${context.section}-${context.tab}-${String(Date.now()).slice(-6)}`.toUpperCase()
                : '')),
    ]),
  );
  const employeeField = fields.find((field) => field.label === 'کارمند');
  const selectedEmployee = context.employeeDetails?.find(
    (employee) => employee.name === initial[employeeField?.id ?? ''],
  );
  if (selectedEmployee) {
    const position = fields.find((field) => field.label === 'سمت فعلی');
    const grade = fields.find((field) => field.label === 'رده فعلی');
    if (position) initial[position.id] = selectedEmployee.position;
    if (grade) initial[grade.id] = selectedEmployee.grade;
  }
  if (context.section === 'contracts' && context.tab === 'alerts') {
    const contract = fields.find((field) => field.label === 'شماره قرارداد');
    if (contract && employeeField)
      initial[contract.id] =
        context.contractNumbersByEmployee?.[initial[employeeField.id] ?? ''] ?? '';
  }
  return initial;
}

export function ContextualHrForm({
  context,
  onCancel,
  onSubmit,
}: {
  context: ContextualHrFormContext;
  onCancel: () => void;
  onSubmit: (values: readonly string[]) => void;
}) {
  const fields = useMemo(
    () => buildContextualHrFields(context.columns, context.peopleOptions),
    [context.columns, context.peopleOptions],
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildInitialFormValues(context, fields),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileLoading, setFileLoading] = useState(false);

  const update = (id: string, value: string) => {
    setValues((current) => {
      const next = { ...current, [id]: value };
      const changedField = fields.find((field) => field.id === id);
      if (changedField?.label === 'کارمند') {
        const employee = context.employeeDetails?.find(
          (item) => item.name === value,
        );
        const position = fields.find((field) => field.label === 'سمت فعلی');
        const grade = fields.find((field) => field.label === 'رده فعلی');
        const contract = fields.find(
          (field) => field.label === 'شماره قرارداد',
        );
        if (position) next[position.id] = employee?.position ?? '';
        if (grade) next[grade.id] = employee?.grade ?? '';
        if (contract)
          next[contract.id] = context.contractNumbersByEmployee?.[value] ?? '';
      }
      return next;
    });
    setErrors((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = Object.fromEntries(
      fields
        .filter((field) => field.required && !values[field.id]?.trim())
        .map((field) => [field.id, `${field.label} الزامی است.`]),
    );
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    onSubmit(fields.map((field) => values[field.id] ?? ''));
  };

  return (
    <form noValidate onSubmit={submit}>
      <div className={styles.previewNote}>
        <Info aria-hidden="true" size={16} />
        داده این فرم فقط برای بررسی رابط در همین نشست استفاده می‌شود.
      </div>
      {context.section === 'recruitment' && context.tab === 'applicants' ? (
        <div className={styles.integrationLinks}>
          <span>منابع جذب متصل به فرم:</span>
          <a href="https://jobinja.ir" rel="noreferrer" target="_blank">
            جابینجا <ExternalLink aria-hidden="true" size={13} />
          </a>
          <a href="https://jobvision.ir" rel="noreferrer" target="_blank">
            جاب‌ویژن <ExternalLink aria-hidden="true" size={13} />
          </a>
        </div>
      ) : null}
      <fieldset className={styles.formFieldset}>
        <legend className={styles.formLegend}>مشخصات {context.title}</legend>
        <div className={styles.formGrid}>
          {fields.map((field, index) => {
            const inputId = `hr-${context.section}-${context.tab}-${field.id}`;
            const errorId = `${inputId}-error`;
            const commonProps = {
              'aria-describedby': errors[field.id] ? errorId : undefined,
              'aria-invalid': Boolean(errors[field.id]),
              'aria-required': field.required,
              className: styles.control ?? '',
              id: inputId,
              name: field.id,
              required: field.required,
            };
            const readOnly =
              isAutomaticCodeField(field, index) ||
              isAutomaticRegistrationDate(field.label) ||
              isContextDerivedField(context, field);
            return (
              <label
                className={styles.fieldLabel}
                htmlFor={inputId}
                key={field.id}
              >
                <RequiredFieldLabel required={field.required}>
                  {field.label}
                </RequiredFieldLabel>
                {field.type === 'select' ? (
                  <select
                    {...commonProps}
                    disabled={readOnly}
                    onChange={(event) => update(field.id, event.target.value)}
                    value={values[field.id] ?? ''}
                  >
                    {Array.from(
                      new Set(
                        [
                          ...(field.options ?? []),
                          values[field.id] ?? '',
                        ].filter(Boolean),
                      ),
                    ).map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : field.type === 'combobox' ? (
                  <>
                    <input
                      {...commonProps}
                      list={`${inputId}-options`}
                      onChange={(event) => update(field.id, event.target.value)}
                      placeholder={`انتخاب یا تایپ ${field.label}`}
                      value={values[field.id] ?? ''}
                    />
                    <datalist id={`${inputId}-options`}>
                      {(field.options ?? []).map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </>
                ) : field.type === 'date' ? (
                  <DatePicker
                    {...commonProps}
                    onChange={(value) => update(field.id, value)}
                    placeholder={`انتخاب ${field.label}`}
                    readOnly={readOnly}
                    value={values[field.id] ?? ''}
                  />
                ) : field.type === 'file' ? (
                  <>
                    <input
                      {...commonProps}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setFileLoading(true);
                        void storeHrAttachment(file)
                          .then((reference) => update(field.id, reference))
                          .catch((error: unknown) =>
                            setErrors((current) => ({
                              ...current,
                              [field.id]:
                                error instanceof Error
                                  ? error.message
                                  : 'بارگذاری فایل انجام نشد.',
                            })),
                          )
                          .finally(() => setFileLoading(false));
                      }}
                      type="file"
                    />
                    <small className={styles.fieldHint}>
                      <Upload aria-hidden="true" size={13} />{' '}
                      {parseHrAttachmentReference(values[field.id] ?? '')
                        ?.name ?? 'PDF، DOC، DOCX یا تصویر تا ۵ مگابایت'}
                    </small>
                  </>
                ) : field.type === 'textarea' ? (
                  <textarea
                    {...commonProps}
                    className={`${styles.control} ${styles.textArea}`}
                    onChange={(event) => update(field.id, event.target.value)}
                    rows={3}
                    value={values[field.id] ?? ''}
                  />
                ) : (
                  <input
                    {...commonProps}
                    autoFocus={index === 1}
                    min={field.type === 'number' ? '0' : undefined}
                    onChange={(event) => update(field.id, event.target.value)}
                    placeholder={field.placeholder}
                    readOnly={readOnly}
                    type={field.type}
                    value={values[field.id] ?? ''}
                  />
                )}
                {readOnly ? (
                  <small className={styles.fieldHint}>
                    این مقدار به‌صورت خودکار تکمیل می‌شود.
                  </small>
                ) : null}
                {errors[field.id] ? (
                  <small className={styles.fieldError} id={errorId}>
                    {errors[field.id]}
                  </small>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className={styles.modalFooter}>
        <button className={styles.button} onClick={onCancel} type="button">
          انصراف
        </button>
        <button
          className={`${styles.button} ${styles.buttonPrimary}`}
          disabled={fileLoading}
          type="submit"
        >
          {context.mode === 'edit' ? 'ذخیره ویرایش' : `افزودن ${context.title}`}
        </button>
      </div>
    </form>
  );
}

export function ContextualHrFormDialog({
  context,
  onClose,
  onSubmit,
}: {
  context: ContextualHrFormContext;
  onClose: () => void;
  onSubmit: (values: readonly string[]) => void;
}) {
  const purpose = sectionPurposes[context.section] ?? context.description;
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent
        className={`${styles.modal} ${styles.employeeModal}`}
        dir="rtl"
      >
        <DialogTitle>
          {context.mode === 'edit' ? 'ویرایش' : 'افزودن'} {context.title}
        </DialogTitle>
        <DialogDescription>{purpose}</DialogDescription>
        <ContextualHrForm
          context={context}
          onCancel={onClose}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
