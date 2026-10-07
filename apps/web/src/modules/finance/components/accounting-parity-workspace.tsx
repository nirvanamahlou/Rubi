'use client';

import { AlertTriangle, CheckCircle2, CircleSlash2 } from 'lucide-react';

import { DatePicker } from '@/components/ui/date-picker';
import { Input, Textarea, FormField } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';

import type { AccountingParityDefinition } from './accounting-parity-definitions';

const supportCopy = {
  supported: {
    label: 'عملیاتی در روبی',
    description: 'این مسیر به فرمان یا گزارش داخلی نسخه‌دار حسابداری متصل است.',
    icon: CheckCircle2,
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800',
  },
  dependency: {
    label: 'نیازمند قرارداد داخلی تکمیلی',
    description:
      'چیدمان منبع مشاهده شده است؛ اجرای عملیات تا تعریف قواعد، مرجع‌های مالی و آزمون‌های یکپارچگی فعال نمی‌شود.',
    icon: CircleSlash2,
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-900',
  },
  'source-error': {
    label: 'منبع خطا داده است',
    description:
      'صفحه منبع خطا داده و فرم معتبر مشاهده نشده است. این مسیر رفتار حدسی ارائه نمی‌کند.',
    icon: AlertTriangle,
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
} as const;

function EvidenceField({
  field,
}: {
  field: AccountingParityDefinition['fields'][number];
}) {
  const id = `accounting-source-${field.sourceControlId ?? field.label}`;
  if (field.type === 'checkbox')
    return (
      <FormField id={id} label={field.label}>
        <input
          aria-label={field.label}
          checked={false}
          className="size-5 accent-primary"
          disabled
          id={id}
          readOnly
          type="checkbox"
        />
      </FormField>
    );
  if (field.type === 'radio')
    return (
      <FormField id={id} label={field.label}>
        <input
          aria-label={field.label}
          checked={false}
          className="size-5 accent-primary"
          disabled
          id={id}
          readOnly
          type="radio"
        />
      </FormField>
    );
  if (field.type === 'textarea')
    return (
      <FormField id={id} label={field.label}>
        <Textarea disabled id={id} value="" />
      </FormField>
    );
  if (field.type === 'date')
    return (
      <FormField id={id} label={field.label}>
        <DatePicker disabled id={id} onChange={() => undefined} value="" />
      </FormField>
    );
  return (
    <FormField id={id} label={field.label}>
      <Input
        autoComplete="off"
        disabled
        id={id}
        type={field.type === 'password' ? 'password' : 'text'}
        value=""
      />
    </FormField>
  );
}

export function AccountingParityWorkspace({
  definition,
}: {
  definition: AccountingParityDefinition;
}) {
  const support = supportCopy[definition.support];
  const SupportIcon = support.icon;
  return (
    <section className="space-y-5" data-accounting-route={definition.route}>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground">
          {definition.sourcePath}
        </p>
        <h2 className="text-xl font-black">{definition.title}</h2>
      </div>

      <div className={cn('rounded-xl border p-4', support.className)}>
        <div className="flex items-start gap-3">
          <SupportIcon className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-bold">{support.label}</p>
            <p className="text-sm">{support.description}</p>
            {definition.blockers.map((blocker) => (
              <p className="mt-2 text-sm font-semibold" key={blocker}>
                مانع مشاهده‌شده: {blocker}
              </p>
            ))}
          </div>
        </div>
      </div>

      {definition.stages.length > 1 ? (
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {definition.stages.map((stage, index) => (
            <li
              className="rounded-xl border bg-muted/30 p-3 text-sm"
              key={stage}
            >
              <span className="font-bold">مرحله {index + 1}</span>
              <span className="block text-muted-foreground">{stage}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {definition.fields.length ? (
        <fieldset disabled className="space-y-4 rounded-xl border p-4">
          <legend className="px-2 font-bold">فیلدهای مشاهده‌شده</legend>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {definition.fields.map((field, index) => (
              <EvidenceField
                field={field}
                key={`${field.sourceControlId ?? field.label}-${index}`}
              />
            ))}
          </div>
        </fieldset>
      ) : null}

      {definition.columns.length ? (
        <div className="space-y-2">
          <h3 className="font-bold">ستون‌های مشاهده‌شده</h3>
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  {definition.columns.map((column, index) => (
                    <th
                      className="whitespace-nowrap p-3 text-start"
                      key={`${column}-${index}`}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td
                    className="p-4 text-muted-foreground"
                    colSpan={definition.columns.length}
                  >
                    داده‌ای بدون قرارداد و مجوز مالک نمایش داده نمی‌شود.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {definition.actions.length ? (
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer font-bold">
            نوار ابزار مشاهده‌شده ({definition.actions.length} مورد)
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {definition.actions.map((action, index) => (
              <span
                className="rounded-lg border bg-muted/40 px-3 py-2 text-xs"
                key={`${action}-${index}`}
              >
                {action}
              </span>
            ))}
          </div>
        </details>
      ) : null}

      <p className="text-xs text-muted-foreground">
        شاهد چیدمان: {definition.sourcePages.join(' · ')}
      </p>
    </section>
  );
}

export function AccountingUnknownRoute({ route }: { route: string }) {
  return (
    <section className="space-y-3" role="alert">
      <h2 className="text-xl font-black">مسیر حسابداری تعریف نشده است</h2>
      <p>
        برای مسیر «{route || 'بدون مسیر'}» فرم منبع یا قرارداد داخلی ثبت نشده
        است.
      </p>
    </section>
  );
}
