'use client';

import { Info } from 'lucide-react';
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

export interface ContextualHrFormContext {
  section: HrSectionId;
  tab: string;
  title: string;
  description: string;
  columns: readonly string[];
  mode: 'create' | 'edit';
}

type ContextualFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'time'
  | 'select'
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
  contracts:
    'مشخصات قرارداد، بازه اعتبار، نسخه و وضعیت همکاری را تکمیل کنید.',
  time: 'کارمند، تاریخ کارکرد، شیفت یا نوع درخواست و وضعیت تأیید را ثبت کنید.',
  development:
    'دوره، هدف یا برنامه توسعه، مسئول ارزیابی و نتیجه مورد انتظار را مشخص کنید.',
  expenses:
    'کارمند، نوع هزینه، ارز، مبلغ و مرحله تأیید مالی را تکمیل کنید.',
  benefits:
    'نوع مزیت یا تکلیف قانونی، دوره، مبنا و وضعیت بررسی را ثبت کنید.',
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

const fieldOptions = (label: string): readonly string[] | undefined => {
  if (label.includes('وضعیت'))
    return ['پیش‌نویس', 'در انتظار تأیید', 'فعال', 'تکمیل‌شده', 'غیرفعال'];
  if (label.includes('ارز')) return ['IRR', 'USD', 'EUR', 'AED'];
  if (/مشمول|قابل انتقال|الزامی/.test(label)) return ['بله', 'خیر'];
  if (label.includes('کارمند') || label.includes('درخواست‌کننده'))
    return [
      'همکار نمایشی الف',
      'همکار نمایشی ب',
      'همکار نمایشی پ',
      'همکار نمایشی ت',
    ];
  if (
    label.includes('مسئول') ||
    label.includes('مالک') ||
    label.includes('مدیر')
  )
    return ['منابع انسانی', 'مدیر مستقیم', 'مالی', 'مدیر سیستم'];
  if (label.includes('واحد'))
    return ['عملیات سفر', 'فروش', 'مالی', 'منابع انسانی'];
  if (label.includes('شعبه'))
    return ['شعبه مرکزی', 'شعبه فرودگاه', 'همه شعبه‌ها'];
  if (label.includes('نوع همکاری'))
    return ['تمام‌وقت', 'پاره‌وقت', 'پروژه‌ای', 'کارآموزی'];
  if (label.includes('نوع مرخصی'))
    return ['استحقاقی', 'استعلاجی', 'بدون حقوق', 'جبرانی'];
  if (label.includes('نوع تردد')) return ['ورود', 'خروج'];
  if (label.includes('نوع مؤلفه')) return ['دریافتی', 'کسورات'];
  if (/نوع پایان همکاری|نوع خاتمه/.test(label))
    return ['پایان مدت', 'استعفا', 'فسخ', 'بازنشستگی'];
  if (label.includes('نوع خروجی')) return ['نمایش', 'PDF', 'Excel'];
  if (label.startsWith('نوع ')) return ['عادی', 'ویژه', 'موقت'];
  if (label.includes('مرحله'))
    return ['ثبت اولیه', 'بررسی مدیر', 'تأیید منابع انسانی', 'تکمیل'];
  if (/سطح فعلی|سطح هدف|سطح موجود|سطح موردنیاز/.test(label))
    return ['مقدماتی', 'متوسط', 'پیشرفته', 'خبره'];
  if (label.includes('رتبه'))
    return ['نیازمند بهبود', 'مطابق انتظار', 'فراتر از انتظار'];
  if (label.includes('تقویم')) return ['شمسی', 'میلادی', 'تقویم تهران'];
  if (label.includes('سطح دسترسی'))
    return ['داخلی', 'محرمانه', 'خیلی محرمانه'];
  if (label.includes('خروجی')) return ['نمایش', 'PDF', 'Excel'];
  return undefined;
};

const fieldType = (label: string): ContextualFieldType => {
  if (/ساعت (شروع|پایان|مصاحبه|تردد|تحویل|عودت)/.test(label)) return 'time';
  if (/تاریخ|موعد|تولد|انقضا|مهلت/.test(label) && !label.includes('بازه'))
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
  /نتیجه|خروجی|پایان|انقضا|تکمیل|وابستگی|اثر مالی|حساب مقصد/.test(label);

export function buildContextualHrFields(
  columns: readonly string[],
): readonly ContextualHrField[] {
  return columns
    .filter((column) => column !== 'عملیات')
    .map((label, index) => {
      const options = fieldOptions(label);
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

export function ContextualHrForm({
  context,
  onCancel,
  onSubmit,
}: {
  context: ContextualHrFormContext;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const fields = useMemo(
    () => buildContextualHrFields(context.columns),
    [context.columns],
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((field) => [
        field.id,
        field.options?.[0] ??
          (field.label.includes('شناسه')
            ? `preview-${context.section}-${context.tab}`
            : field.label.includes('نسخه')
              ? 'preview-v1'
              : ''),
      ]),
    ),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (id: string, value: string) => {
    setValues((current) => ({ ...current, [id]: value }));
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
    onSubmit();
  };

  return (
    <form noValidate onSubmit={submit}>
      <div className={styles.previewNote}>
        <Info aria-hidden="true" size={16} />
        داده این فرم فقط برای بررسی رابط در همین نشست استفاده می‌شود.
      </div>
      <fieldset className={styles.formFieldset}>
        <legend className={styles.formLegend}>مشخصات {context.title}</legend>
        <div className={styles.formGrid}>
          {fields.map((field, index) => {
            const inputId = `hr-${context.section}-${context.tab}-${field.id}`;
            const errorId = `${inputId}-error`;
            const commonProps = {
              'aria-describedby': errors[field.id] ? errorId : undefined,
              'aria-invalid': Boolean(errors[field.id]),
              className: styles.control ?? '',
              id: inputId,
              name: field.id,
            };
            return (
              <label className={styles.fieldLabel} htmlFor={inputId} key={field.id}>
                <span>{field.label}{field.required ? ' *' : ''}</span>
                {field.type === 'select' ? (
                  <select
                    {...commonProps}
                    onChange={(event) => update(field.id, event.target.value)}
                    value={values[field.id] ?? ''}
                  >
                    {field.options?.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : field.type === 'date' ? (
                  <DatePicker
                    {...commonProps}
                    onChange={(value) => update(field.id, value)}
                    placeholder={`انتخاب ${field.label}`}
                    value={values[field.id] ?? ''}
                  />
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
                    autoFocus={index === 0}
                    min={field.type === 'number' ? '0' : undefined}
                    onChange={(event) => update(field.id, event.target.value)}
                    placeholder={field.placeholder}
                    type={field.type}
                    value={values[field.id] ?? ''}
                  />
                )}
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
        <button className={`${styles.button} ${styles.buttonPrimary}`} type="submit">
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
  onSubmit: () => void;
}) {
  const purpose = sectionPurposes[context.section] ?? context.description;
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className={`${styles.modal} ${styles.employeeModal}`} dir="rtl">
        <DialogTitle>
          {context.mode === 'edit' ? 'ویرایش' : 'افزودن'} {context.title}
        </DialogTitle>
        <DialogDescription>{purpose}</DialogDescription>
        <ContextualHrForm context={context} onCancel={onClose} onSubmit={onSubmit} />
      </DialogContent>
    </Dialog>
  );
}
