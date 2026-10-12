import { accountingTaxForms } from '@nora/contracts';
import { accountingTaxRoute } from '../accounting-tax-model';
import type { AccountingParityCapture } from './accounting-parity-definitions';

export const accountingTaxEvidence: AccountingParityCapture[] =
  accountingTaxForms.flatMap((form) => {
    const sourcePath = form.route.includes('/base-information/')
      ? 'مالی / حسابداری مالیاتی / اطلاعات پایه'
      : 'مالی / حسابداری مالیاتی / مالیات بر ارزش افزوده';
    const captures: AccountingParityCapture[] = [];
    if (form.sourcePage)
      captures.push({
        route: form.route,
        title: form.title,
        sourcePath,
        sourcePage: form.sourcePage,
        evidenceStatus: 'observed-layout',
        stage: 'اطلاعات اصلی و گزینه‌های مشاهده‌شده',
        fields: form.fields.map((field) => ({
          label: field.label,
          type:
            field.kind === 'check'
              ? 'checkbox'
              : field.kind === 'date'
                ? 'date'
                : 'text',
          disabled: field.disabled || field.readOnly,
          sourceControlId: field.key,
        })),
        columns: form.tables.flatMap((table) => table.columns),
        actions: [],
      });
    const listRoute = accountingTaxRoute(form.route)?.listRoute;
    if (listRoute && form.listSourcePage)
      captures.push({
        route: listRoute,
        title: form.title,
        sourcePath: `${sourcePath} / فهرست ها`,
        sourcePage: form.listSourcePage,
        evidenceStatus: 'observed-layout',
        stage: 'فهرست مشاهده‌شده',
        fields: [],
        columns: form.listColumns,
        actions: [],
      });
    return captures;
  });
