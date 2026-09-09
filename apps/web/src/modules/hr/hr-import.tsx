'use client';
import { useState } from 'react';
import { getHrResource, type HrRecordDto } from '@rubi/contracts';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import type { HrSource } from './hr-navigation';
import type { HrStore } from './hr-store';
import { HrButton } from './hr-controls';
import { commandValues } from './hr-record-form';
import { prepareHrCommand } from './hr-commands';
import { normalizeHrText } from './hr-data-utils';
import { hrCompanies } from './hr-live-data';
import ui from './hr-unified.module.css';

interface ImportRow {
  line: number;
  values: string[];
  employeeId?: string;
  parentId?: string;
  error?: string;
  key: string;
  saved?: boolean;
}
export function HrImport({
  source,
  store,
  branchId: initialBranchId,
  organizationBranchId,
  onClose,
}: {
  source: HrSource;
  store: HrStore;
  branchId: string;
  organizationBranchId?: string | undefined;
  onClose: () => void;
}) {
  const definition = getHrResource(source.section, source.tab)!;
  const companies = hrCompanies(store.data!);
  const [companyId, setCompanyId] = useState(
    organizationBranchId ||
      companies.find((item) => item.branchId === initialBranchId)?.id ||
      '',
  );
  const company = companies.find((item) => item.id === companyId);
  const branchId = company?.branchId || initialBranchId;
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inspect = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const { readHrXlsx } = await import('./hr-xlsx');
      const [headers, ...incoming] = await readHrXlsx(file);
      const expected = [
        'شناسه',
        ...definition.columns,
        'وضعیت',
        'کد پرسنلی',
        'شناسه پرونده مرتبط',
      ];
      if (
        !headers ||
        definition.columns.some((column) => !headers.includes(column))
      )
        throw new Error(
          'ستون‌های فایل با این بخش یکسان نیستند؛ ابتدا قالب اکسل را دریافت کنید.',
        );
      const seen = new Set<string>();
      const parsed = incoming
        .filter((row) => row.some((cell) => cell.trim()))
        .map((row, index): ImportRow => {
          const code = row[headers.indexOf('کد پرسنلی')] ?? '';
          const name = row[headers.indexOf('کارمند')] ?? '';
          const people = store.data!.employees.filter(
            (item) =>
              item.branchId === branchId &&
              (!company?.organizationBranchId ||
                item.organizationBranchId === company.organizationBranchId) &&
              (code
                ? normalizeHrText(item.personnelCode) === normalizeHrText(code)
                : item.name === name),
          );
          const parentCode = row[headers.indexOf('شناسه پرونده مرتبط')] ?? '';
          const parent = store.data!.records.find(
            (item) =>
              (item.id === parentCode || item.code === parentCode) &&
              item.branchId === branchId &&
              (!company?.organizationBranchId ||
                !item.data.organizationBranchId ||
                item.data.organizationBranchId ===
                  company.organizationBranchId) &&
              definition.parentResources.includes(
                `${item.section}.${item.tab}`,
              ),
          );
          let dateError = '';
          let values = definition.columns.map(
            (column) => row[headers.indexOf(column)] ?? '',
          );
          try {
            values = commandValues(source.section, source.tab, values);
          } catch (e) {
            dateError = e instanceof Error ? e.message : 'تاریخ نامعتبر';
          }
          const fingerprint = values.map(normalizeHrText).join('|');
          const duplicate =
            seen.has(fingerprint) ||
            store.data!.records.some(
              (item) =>
                item.section === source.section &&
                item.tab === source.tab &&
                item.branchId === branchId &&
                (!company?.organizationBranchId ||
                  item.data.organizationBranchId ===
                    company.organizationBranchId) &&
                item.values.map(normalizeHrText).join('|') === fingerprint,
            );
          seen.add(fingerprint);
          let rowError =
            dateError ||
            (duplicate
              ? 'رکورد تکراری'
              : definition.employeeRequired && people.length !== 1
                ? 'کد پرسنلی معتبر و یکتا لازم است'
                : definition.parentResources.length &&
                    !parent &&
                    !definition.parentOptional
                  ? 'شناسه پرونده مرتبط معتبر نیست'
                  : undefined);
          if (
            !rowError &&
            definition.fields.some(
              (field, i) => field.required && !values[i]?.trim(),
            )
          )
            rowError = 'فیلد الزامی خالی است';
          if (
            values.some((value) => /^(?:hr-attachment|blob|data):/.test(value))
          )
            rowError = 'پیوست را از فرم بارگذاری کنید';
          return {
            line: index + 2,
            values,
            key: crypto.randomUUID(),
            ...(people[0] ? { employeeId: people[0].id } : {}),
            ...(parent ? { parentId: parent.id } : {}),
            ...(rowError ? { error: rowError } : {}),
          };
        });
      if (!parsed.length) throw new Error('فایل فاقد رکورد است.');
      if (headers.some((header) => !expected.includes(header)))
        setError('ستون‌های اضافی فایل نادیده گرفته می‌شوند.');
      setRows(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خواندن فایل انجام نشد.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent dir="rtl" className={ui.detail}>
        <DialogTitle>ورودی اکسل — {source.label}</DialogTitle>
        <DialogDescription>
          ابتدا ردیف‌ها بررسی می‌شوند. ثبت از همین مسیر، قواعد فرم و گردش تأیید
          را اجرا می‌کند.
        </DialogDescription>
        <div className={ui.actions}>
          <label className={ui.field}>
            شرکت / شعبه *
            <select
              value={companyId}
              disabled={busy}
              onChange={(event) => {
                setCompanyId(event.target.value);
                setRows([]);
                setError('');
              }}
            >
              {companies.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <HrButton
            onClick={async () => {
              const { downloadHrXlsx } = await import('./hr-xlsx');
              await downloadHrXlsx(
                `template-${source.section}-${source.tab}.xlsx`,
                [
                  [
                    'شناسه',
                    ...definition.columns,
                    'وضعیت',
                    'کد پرسنلی',
                    'شناسه پرونده مرتبط',
                  ],
                ],
              );
            }}
          >
            دریافت قالب
          </HrButton>
          <label className={ui.field}>
            انتخاب اکسل
            <input
              disabled={busy}
              type="file"
              accept=".xlsx"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void inspect(file);
              }}
            />
          </label>
        </div>
        {error ? (
          <p role="alert" className={ui.error}>
            {error}
          </p>
        ) : null}
        <div className={ui.importRows}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>ردیف</th>
                <th>عنوان</th>
                <th>نتیجه بررسی</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.line}</td>
                  <td>{row.values.slice(0, 2).join(' / ')}</td>
                  <td className={row.error ? ui.danger : ''}>
                    {row.saved ? 'ثبت شد' : (row.error ?? 'آماده ثبت')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={ui.actions}>
          <HrButton disabled={busy} onClick={onClose}>
            بستن
          </HrButton>
          <HrButton
            primary
            disabled={busy || !rows.some((row) => !row.error && !row.saved)}
            onClick={async () => {
              setBusy(true);
              for (const row of rows) {
                if (row.error || row.saved) continue;
                try {
                  const payload = {
                    branchId,
                    section: source.section,
                    tab: source.tab,
                    values: row.values,
                    ...(row.employeeId ? { employeeId: row.employeeId } : {}),
                    ...(row.parentId ? { parentId: row.parentId } : {}),
                    status: definition.approval ? 'پیش‌نویس' : 'فعال',
                    data: {
                      ...(company?.organizationBranchId
                        ? { organizationBranchId: company.organizationBranchId }
                        : {}),
                      currency:
                        row.values[definition.columns.indexOf('ارز')] || 'IRR',
                    },
                  };
                  const saved: HrRecordDto = await store.create(
                    prepareHrCommand(payload, store.data!),
                    row.key,
                  );
                  if (saved)
                    setRows((current) =>
                      current.map((item) =>
                        item.key === row.key ? { ...item, saved: true } : item,
                      ),
                    );
                } catch (e) {
                  setRows((current) =>
                    current.map((item) =>
                      item.key === row.key
                        ? {
                            ...item,
                            error: e instanceof Error ? e.message : 'ثبت نشد',
                          }
                        : item,
                    ),
                  );
                }
              }
              setBusy(false);
            }}
          >
            {busy
              ? 'در حال ثبت…'
              : `ثبت ${rows.filter((row) => !row.error && !row.saved).length.toLocaleString('fa-IR')} ردیف معتبر`}
          </HrButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
