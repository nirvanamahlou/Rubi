import { taxpayerPages } from '../accounting-taxpayer-catalog';
import type {
  AccountingParityCapture,
  AccountingParityField,
} from './accounting-parity-definitions';
export const accountingTaxpayerEvidence: AccountingParityCapture[] =
  taxpayerPages.map((page) => ({
    route: page.route,
    title: page.title,
    sourcePath: `مالی / ارتباط با سامانه مودیان مالیاتی / ${page.title}`,
    sourcePage: page.sourcePage,
    evidenceStatus:
      page.kind === 'blocked' ? 'source-error' : 'observed-layout',
    fields: page.fields.map((field) => ({
      label: field.label,
      type: (['date', 'checkbox', 'radio', 'textarea', 'password'].includes(
        field.type,
      )
        ? field.type
        : 'text') as AccountingParityField['type'],
      disabled: field.disabled || field.readOnly,
      sourceControlId: field.id,
    })),
    columns: page.columns,
    actions: page.actions,
    stage: page.title,
    ...(page.blocker
      ? { blocker: page.blocker }
      : { blocker: 'فرم مشاهده شده است؛ اتصال عملیاتی کامل نشده است.' }),
  }));
