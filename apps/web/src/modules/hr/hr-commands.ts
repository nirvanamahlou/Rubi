import {
  getHrResource,
  type HrBootstrapDto,
  type HrRecordCreate,
  type HrWorkflowData,
} from '@rubi/contracts';
import { hrCompanies } from './hr-live-data';
import { persianDateToIso } from './contextual-hr-form';

export function prepareHrCommand(
  input: HrRecordCreate,
  data: HrBootstrapDto,
): HrRecordCreate {
  const definition = getHrResource(input.section, input.tab);
  if (!definition) throw new Error('این نوع رکورد پشتیبانی نمی‌شود.');
  const values = definition.columns.map((label, index) =>
    /تاریخ|روز کاری/.test(label) && input.values[index]
      ? persianDateToIso(input.values[index]!)
      : (input.values[index] ?? ''),
  );
  const field = (...labels: string[]) =>
    labels
      .map((label) => values[definition.columns.indexOf(label)])
      .find(Boolean) ?? '';
  const extra: HrWorkflowData = { ...input.data };
  const start = field(
    'از تاریخ',
    'تاریخ شروع',
    'تاریخ رفت',
    'آخرین روز کاری',
    'تاریخ اثر',
    'تاریخ شروع همکاری',
  );
  const end = field('تا تاریخ', 'تاریخ پایان', 'تاریخ برگشت');
  if (input.section === 'time' && input.tab === 'corrections') {
    const times = field('مقدار درخواستی')
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .match(/^(\d{2}:\d{2})\s*(?:تا|[-–])\s*(\d{2}:\d{2})$/);
    const date = field('تاریخ کارکرد');
    if (!times || !date || times[2]! <= times[1]!)
      throw new Error('زمان ورود و خروج اصلاح‌شده را در همان روز مشخص کنید.');
    extra.startsAt = new Date(`${date}T${times[1]}:00+03:30`).toISOString();
    extra.endsAt = new Date(`${date}T${times[2]}:00+03:30`).toISOString();
  }
  if (start) extra.startsAt = `${start}T00:00:00.000Z`;
  if (end) extra.endsAt = `${end}T23:59:59.999Z`;
  if (field('ارز')) extra.currency = field('ارز');
  if (
    definition.fields.some((item) => item.type === 'money') &&
    !extra.currency
  )
    throw new Error('ارز مبلغ را مشخص کنید.');
  const managerName = field('مدیر جدید', 'مدیر مستقیم');
  if (managerName && !extra.managerId && managerName !== 'بدون مدیر مستقیم') {
    const managers = data.employees.filter((item) => item.name === managerName);
    if (managers.length !== 1)
      throw new Error('مدیر مستقیم معتبر و یکتا نیست.');
    extra.managerId = managers[0]!.id;
  }
  if (input.section === 'lifecycle' && input.tab === 'transfer') {
    const destination = hrCompanies(data).find(
      (item) => item.name === field('شعبه مقصد', 'شرکت مقصد'),
    );
    if (!destination) throw new Error('شرکت مقصد مجاز نیست.');
    extra.targetBranchId = destination.branchId;
    if (destination.organizationBranchId)
      extra.organizationBranchId = destination.organizationBranchId;
  }
  if (values.some((value) => /^(?:hr-attachment|blob|data):/.test(value)))
    throw new Error('پیوست ابتدا باید در اسناد و فایل‌ها ثبت شود.');
  const document = values.find((value) => value.startsWith('document://'));
  if (document) extra.documentId = document.slice('document://'.length);
  return {
    ...input,
    values,
    data: extra,
    ...(start ? { effectiveAt: start } : {}),
  };
}
