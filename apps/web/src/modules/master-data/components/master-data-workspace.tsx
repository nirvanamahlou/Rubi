'use client';

import {
  Database,
  FileSpreadsheet,
  FileText,
  FilterX,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import {
  Alert,
  Badge,
  Card,
  FilterBar,
  PageHeader,
  PaginationShell,
} from '@/components/ui/surfaces';
import {
  MASTER_DATA_API_PREFIX,
  MASTER_DATA_API_PROPOSAL_VERSION,
} from '../api/contracts';
import {
  getMasterDataDefinition,
  masterDataCatalog,
  type MasterDataResourceKey,
} from '../model/catalog';
import {
  masterDataPermissions,
  proposedPermissionMatrix,
} from '../model/permissions';
import { MasterDataForm, type MasterDataFormMode } from './master-data-form';
import {
  MASTER_DATA_BLOCKER_TITLE,
  masterDataStateOptions,
  type MasterDataPreviewState,
} from './component-contract';
import { MasterDataTableState } from './master-data-state';

const groups = ['جغرافیا', 'مالی', 'خدمات سفر', 'سازمان‌ها', 'فروش'] as const;
const roleLabels = {
  viewer: 'مشاهده‌گر',
  editor: 'ویرایشگر',
  manager: 'مدیر اطلاعات پایه',
  exporter: 'خروجی‌گیر',
} as const;

export function MasterDataWorkspace({
  initialPreviewState = 'empty',
}: {
  initialPreviewState?: MasterDataPreviewState;
}) {
  const [resource, setResource] = useState<MasterDataResourceKey>('countries');
  const [previewState, setPreviewState] =
    useState<MasterDataPreviewState>(initialPreviewState);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sort, setSort] = useState<'name' | 'code' | 'updatedAt'>('name');
  const [formMode, setFormMode] = useState<MasterDataFormMode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const definition = getMasterDataDefinition(resource);

  function changeResource(next: MasterDataResourceKey) {
    setResource(next);
    setPreviewState('empty');
    setSearch('');
    setStatus('all');
    setSort('name');
    setNotice(null);
  }

  function blockExport(format: 'Excel' | 'PDF') {
    setNotice(
      `مسیر ${format} طراحی شده است؛ فایل ساختگی تولید نمی‌شود و اجرا تا آماده‌شدن API، Worker و Documents مسدود است.`,
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <>
            <Button onClick={() => blockExport('Excel')} variant="outline">
              <FileSpreadsheet aria-hidden="true" className="size-4" />
              Excel
            </Button>
            <Button onClick={() => blockExport('PDF')} variant="outline">
              <FileText aria-hidden="true" className="size-4" />
              PDF
            </Button>
            <Button onClick={() => setFormMode('create')}>
              <Plus aria-hidden="true" className="size-4" />
              ایجاد {definition.singularLabel}
            </Button>
          </>
        }
        description="مدیریت Reference Data و Organizationهای مشترک، با Contract ماژولار و بدون دورزدن قفل Migration."
        eyebrow="MASTER-001 · PC-B"
        title="اطلاعات پایه"
      />

      <Alert
        description="UI، validation و Contract آماده بازبینی هستند؛ Database، mutation و export authoritative تا Handoff صریح PC-A پیاده‌سازی نمی‌شوند."
        title={MASTER_DATA_BLOCKER_TITLE}
        tone="warning"
      />
      {notice ? (
        <Alert description={notice} title="نتیجه عملیات طراحی" />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="h-fit p-3 xl:sticky xl:top-20">
          <div className="flex items-center gap-2 border-b border-border px-2 pb-3">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Database aria-hidden="true" className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-black">Catalog اطلاعات پایه</h2>
              <p className="text-xs text-muted-foreground">
                ۱۲ resource پیشنهادی
              </p>
            </div>
          </div>
          <nav aria-label="دسته‌های اطلاعات پایه" className="mt-3 space-y-4">
            {groups.map((group) => (
              <section key={group}>
                <h3 className="px-2 text-[11px] font-bold text-muted-foreground">
                  {group}
                </h3>
                <div className="mt-1 grid gap-1">
                  {masterDataCatalog
                    .filter((item) => item.group === group)
                    .map((item) => (
                      <button
                        aria-current={
                          item.key === resource ? 'page' : undefined
                        }
                        className="rounded-xl px-3 py-2 text-start text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
                        key={item.key}
                        onClick={() => changeResource(item.key)}
                        type="button"
                      >
                        {item.label}
                      </button>
                    ))}
                </div>
              </section>
            ))}
          </nav>
        </Card>

        <main className="min-w-0 space-y-4" id="master-data-workspace">
          <Card className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black">{definition.label}</h2>
                  <Badge>{definition.group}</Badge>
                  <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    بدون persistence
                  </Badge>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                  {definition.description}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setFormMode('view')}
                  size="sm"
                  variant="ghost"
                >
                  فرم مشاهده
                </Button>
                <Button
                  onClick={() => setFormMode('edit')}
                  size="sm"
                  variant="ghost"
                >
                  فرم ویرایش
                </Button>
              </div>
            </div>
          </Card>

          <FilterBar className="grid sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_12rem_12rem_auto]">
            <FormField id="master-data-search" label="جست‌وجوی سریع">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="absolute end-3 top-3.5 size-4 text-muted-foreground"
                />
                <Input
                  className="pe-10"
                  id="master-data-search"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`جست‌وجو در ${definition.label}`}
                  value={search}
                />
              </div>
            </FormField>
            <FormField label="وضعیت">
              <Select
                onValueChange={(value) => setStatus(value as typeof status)}
                value={status}
              >
                <SelectTrigger aria-label="فیلتر وضعیت">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                  <SelectItem value="active">فعال</SelectItem>
                  <SelectItem value="inactive">غیرفعال</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="مرتب‌سازی">
              <Select
                onValueChange={(value) => setSort(value as typeof sort)}
                value={sort}
              >
                <SelectTrigger aria-label="مرتب‌سازی">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">عنوان</SelectItem>
                  <SelectItem value="code">کد</SelectItem>
                  <SelectItem value="updatedAt">آخرین تغییر</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <Button
              onClick={() => {
                setSearch('');
                setStatus('all');
                setSort('name');
              }}
              variant="ghost"
            >
              <FilterX aria-hidden="true" className="size-4" />
              پاک‌کردن
            </Button>
          </FilterBar>

          <Card className="p-4">
            <fieldset>
              <legend className="text-xs font-bold text-muted-foreground">
                پیش‌نمایش Stateهای اجباری UI
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {masterDataStateOptions.map(([value, label]) => (
                  <Button
                    aria-pressed={previewState === value}
                    key={value}
                    onClick={() => setPreviewState(value)}
                    size="sm"
                    variant={previewState === value ? 'secondary' : 'ghost'}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </fieldset>
          </Card>

          <MasterDataTableState
            definition={definition}
            onCreate={() => setFormMode('create')}
            onEdit={() => setFormMode('edit')}
            onRetry={() => setPreviewState('empty')}
            onView={() => setFormMode('view')}
            state={previewState}
          />
          <PaginationShell currentPage={1} totalLabel="۰ رکورد پایدار" />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <div className="border-b border-border p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    aria-hidden="true"
                    className="size-4 text-primary"
                  />
                  <h2 className="font-black">Permission Matrix پیشنهادی</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  scope نهایی به Handoff IAM وابسته است.
                </p>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr>
                      <th className="p-2 text-start">نقش</th>
                      {masterDataPermissions.map((permission) => (
                        <th
                          className="p-2 text-center text-[10px]"
                          key={permission}
                        >
                          {permission.replace('master_data.', '')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(proposedPermissionMatrix).map(
                      ([role, permissions]) => (
                        <tr className="border-t border-border" key={role}>
                          <th className="p-2 text-start">
                            {roleLabels[role as keyof typeof roleLabels]}
                          </th>
                          {masterDataPermissions.map((permission) => (
                            <td className="p-2 text-center" key={permission}>
                              {permissions.includes(permission) ? '✓' : '—'}
                            </td>
                          ))}
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2">
                <LockKeyhole
                  aria-hidden="true"
                  className="size-4 text-primary"
                />
                <h2 className="font-black">مرز Contract و Export</h2>
              </div>
              <dl className="mt-4 grid gap-3 text-sm">
                <div>
                  <dt className="font-semibold">نسخه proposal</dt>
                  <dd className="font-mono text-xs text-muted-foreground">
                    {MASTER_DATA_API_PROPOSAL_VERSION}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">API prefix</dt>
                  <dd
                    className="font-mono text-xs text-muted-foreground"
                    dir="ltr"
                  >
                    {MASTER_DATA_API_PREFIX}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">Export</dt>
                  <dd className="text-xs leading-6 text-muted-foreground">
                    202 + operationId، permission snapshot، audit، Worker و
                    Documents
                  </dd>
                </div>
              </dl>
            </Card>
          </div>
        </main>
      </div>

      {formMode ? (
        <MasterDataForm
          definition={definition}
          mode={formMode}
          onOpenChange={(open) => {
            if (!open) setFormMode(null);
          }}
          onValidatedBlocked={setNotice}
          open
        />
      ) : null}
    </div>
  );
}
