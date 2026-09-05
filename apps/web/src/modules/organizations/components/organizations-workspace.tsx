'use client';

import type { MasterDataRecord, MasterDataStatus } from '@rubi/contracts';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldX,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  PaginationShell,
  Skeleton,
} from '@/components/ui/surfaces';
import {
  masterDataApi,
  MasterDataApiError,
  type MasterDataLogoChange,
} from '@/modules/master-data/api/client';
import { MasterDataLiveForm } from '@/modules/master-data/components/master-data-live-form';
import { getMasterDataDefinition } from '@/modules/master-data/model/catalog';
import { agencyClient } from '../api/agency-client';

type RequestState =
  'loading' | 'ready' | 'empty' | 'unauthorized' | 'forbidden' | 'error';

function attribute(record: MasterDataRecord, key: string, fallback = '—') {
  const value = record.attributes[key];
  return value === null || value === undefined || value === ''
    ? fallback
    : String(value);
}

function personType(record: MasterDataRecord) {
  return attribute(record, 'personType') === 'NATURAL'
    ? 'حقیقی'
    : attribute(record, 'personType') === 'LEGAL'
      ? 'حقوقی'
      : 'ثبت‌نشده';
}

export function OrganizationsWorkspace() {
  const [records, setRecords] = useState<readonly MasterDataRecord[]>([]);
  const [contacts, setContacts] = useState<readonly MasterDataRecord[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | MasterDataStatus>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<RequestState>('loading');
  const [selected, setSelected] = useState<MasterDataRecord>();
  const [profileOpen, setProfileOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [notice, setNotice] = useState<string>();
  const [contactsLoading, setContactsLoading] = useState(false);
  const pageSize = 20;

  const load = useCallback(async () => {
    setState('loading');
    try {
      const response = await agencyClient.list({
        search,
        status,
        page,
        pageSize,
      });
      setRecords(response.data);
      setTotal(response.meta.total);
      setState(response.data.length ? 'ready' : 'empty');
    } catch (error) {
      if (error instanceof MasterDataApiError && error.status === 401)
        setState('unauthorized');
      else if (error instanceof MasterDataApiError && error.status === 403)
        setState('forbidden');
      else setState('error');
    }
  }, [page, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function openProfile(record: MasterDataRecord) {
    setSelected(record);
    setProfileOpen(true);
    setContacts([]);
    setContactsLoading(true);
    try {
      const response = await agencyClient.contacts(record.id);
      setContacts(response.data);
    } catch {
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }

  async function persist(
    values: Record<string, string>,
    logoChange?: MasterDataLogoChange,
  ) {
    const roleCodes = new Set(
      (values.roleCodes ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    );
    roleCodes.add('AGENCY');
    const result = await masterDataApi.persistWithLogo({
      resource: 'organizations',
      values: { ...values, roleCodes: [...roleCodes].join(',') },
      title: `لوگوی آژانس ${values.legalName ?? selected?.name ?? ''}`.trim(),
      ...(formMode === 'edit' && selected ? { existing: selected } : {}),
      ...(logoChange ? { logoChange } : {}),
    });
    setNotice(
      result.warning ??
        `سازمان آژانس با موفقیت ${formMode === 'edit' ? 'ویرایش' : 'ایجاد'} شد.`,
    );
    setFormMode(null);
    setSelected(undefined);
    await load();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <Button
            onClick={() => {
              setSelected(undefined);
              setFormMode('create');
            }}
          >
            <Plus className="size-4" /> افزودن سازمان آژانس
          </Button>
        }
        description="فهرست آژانس‌ها مستقیماً از Organizationهای دارای نقش AGENCY در اطلاعات پایه خوانده می‌شود؛ موجودیت تکراری ساخته نمی‌شود."
        title="آژانس‌ها و مشتریان سازمانی"
      />

      {notice ? <Alert description={notice} title="نتیجه عملیات" /> : null}

      <FilterBar>
        <label className="min-w-64 flex-1 space-y-2">
          <span className="text-sm font-bold">جست‌وجو</span>
          <span className="relative block">
            <Search className="absolute end-3 top-3 size-4 text-muted-foreground" />
            <Input
              className="pe-9"
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="نام یا کد آژانس"
              value={search}
            />
          </span>
        </label>
        <label className="min-w-48 space-y-2">
          <span className="text-sm font-bold">وضعیت سازمان</span>
          <Select
            onValueChange={(value) => {
              setPage(1);
              setStatus(value as 'all' | MasterDataStatus);
            }}
            value={status}
          >
            <SelectTrigger aria-label="وضعیت سازمان">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              <SelectItem value="active">فعال</SelectItem>
              <SelectItem value="inactive">غیرفعال</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <Button onClick={() => void load()} type="button" variant="outline">
          <RefreshCw className="size-4" /> تازه‌سازی
        </Button>
      </FilterBar>

      {state === 'loading' ? (
        <div aria-label="در حال بارگذاری آژانس‌ها" className="space-y-3">
          {[0, 1, 2].map((item) => (
            <Skeleton className="h-20 w-full" key={item} />
          ))}
        </div>
      ) : state === 'unauthorized' ? (
        <EmptyState
          description="نشست شما معتبر نیست؛ دوباره وارد سامانه شوید."
          icon={ShieldX}
          title="ورود مجدد لازم است"
        />
      ) : state === 'forbidden' ? (
        <EmptyState
          description="مجوز master_data.read برای مشاهده آژانس‌ها لازم است."
          icon={ShieldX}
          title="دسترسی وجود ندارد"
        />
      ) : state === 'error' ? (
        <ErrorState
          action={<Button onClick={() => void load()}>تلاش دوباره</Button>}
          description="دریافت آژانس‌ها از API عمومی اطلاعات پایه ناموفق بود."
          title="خطا در دریافت آژانس‌ها"
        />
      ) : state === 'empty' ? (
        <EmptyState
          description="با فیلتر فعلی Organization دارای نقش AGENCY پیدا نشد."
          icon={Building2}
          title="فهرست آژانس‌ها خالی است"
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[70rem] text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                {[
                  'کد',
                  'نام آژانس',
                  'نوع',
                  'تلفن و ایمیل',
                  'آدرس پایه',
                  'وضعیت',
                  'آخرین تغییر',
                  'عملیات',
                ].map((head) => (
                  <th className="p-4 text-start" key={head}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr className="border-t border-border" key={record.id}>
                  <td className="p-4 font-mono" dir="ltr">
                    {record.code}
                  </td>
                  <td className="p-4 font-bold">{record.name}</td>
                  <td className="p-4">{personType(record)}</td>
                  <td className="p-4 text-muted-foreground">
                    برای مشاهده، پروفایل را باز کنید
                  </td>
                  <td className="p-4">
                    <Badge>BLOCKED_FOR_MIGRATION</Badge>
                  </td>
                  <td className="p-4">
                    <Badge
                      className={
                        record.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }
                    >
                      {record.status === 'active' ? 'فعال' : 'غیرفعال'}
                    </Badge>
                  </td>
                  <td className="p-4" dir="ltr">
                    {new Date(record.updatedAt).toLocaleDateString('fa-IR')}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <Button
                        onClick={() => void openProfile(record)}
                        size="sm"
                        variant="outline"
                      >
                        <Eye className="size-4" /> مشاهده
                      </Button>
                      <Button
                        onClick={() => {
                          setSelected(record);
                          setFormMode('edit');
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <Pencil className="size-4" /> ویرایش
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="flex items-center justify-between gap-3">
        <PaginationShell
          currentPage={page}
          totalLabel={`${total.toLocaleString('fa-IR')} آژانس`}
        />
        <div className="flex gap-2">
          <Button
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            size="sm"
            variant="outline"
          >
            <ChevronRight className="size-4" /> قبلی
          </Button>
          <Button
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
            size="sm"
            variant="outline"
          >
            بعدی <ChevronLeft className="size-4" />
          </Button>
        </div>
      </div>

      <Dialog onOpenChange={setProfileOpen} open={profileOpen}>
        <DialogContent className="start-auto left-1/2 max-w-xl">
          <DialogTitle>پروفایل سازمان آژانس</DialogTitle>
          <DialogDescription>
            اطلاعات پایه از Master Organization و تماس‌ها فقط به‌صورت ماسک‌شده
            خوانده می‌شوند.
          </DialogDescription>
          {selected ? (
            <div className="mt-5 space-y-4">
              <Card className="grid gap-3 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">نام</p>
                  <p className="font-bold">{selected.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">کد</p>
                  <p className="font-mono" dir="ltr">
                    {selected.code}
                  </p>
                </div>
              </Card>
              <Card className="space-y-3 p-4">
                <p className="font-bold">تماس‌های سازمان</p>
                {contactsLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : contacts.length ? (
                  contacts.map((contact) => (
                    <div
                      className="grid gap-1 rounded-xl border p-3 sm:grid-cols-3"
                      key={contact.id}
                    >
                      <span className="font-semibold">{contact.name}</span>
                      <span dir="ltr">{attribute(contact, 'phoneMasked')}</span>
                      <span dir="ltr">{attribute(contact, 'emailMasked')}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    تماس ثبت‌شده‌ای وجود ندارد.
                  </p>
                )}
              </Card>
              <Alert
                description="آدرس سازمان و پروفایل عملیاتی قرارداد، اعتبار و نرخ توافقی هنوز ستون عمومی ندارند و تا Migration مستقل، داده ساختگی نمایش داده نمی‌شود."
                title="بخش‌های عملیاتی در انتظار مدل داده"
                tone="warning"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {formMode ? (
        <MasterDataLiveForm
          definition={getMasterDataDefinition('organizations')}
          initialValues={formMode === 'create' ? { roleCodes: 'AGENCY' } : {}}
          mode={formMode}
          onOpenChange={(open) => {
            if (!open) {
              setFormMode(null);
              setSelected(undefined);
            }
          }}
          onPersist={persist}
          open
          {...(formMode === 'edit' && selected ? { record: selected } : {})}
        />
      ) : null}
    </div>
  );
}
