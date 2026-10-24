'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileCheck2, Route, Search, TicketCheck } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import {
  countIssuedTicketsByRoute,
  initialIssuedTicketQuery,
  queryIssuedTickets,
  type IssuedTicketQuery,
  type IssuedTicketReadModel,
  type IssuedTicketStatus,
} from '../model/issued-tickets';
import {
  loadReservationIssuedTickets,
  downloadIssuedTicketReport,
} from '../api/issued-tickets';
import { TicketDatePicker } from './ticket-date-picker';

export const serviceLabels: Record<string, string> = {
  all: 'همه خدمات',
  FLIGHT: 'پرواز',
  HOTEL: 'هتل',
  TRANSFER: 'ترانسفر',
  INSURANCE: 'بیمه',
  VISA: 'ویزا',
  TOUR: 'تور',
  BUS: 'اتوبوس',
  TRAIN: 'قطار',
  CIP: 'CIP',
  OTHER: 'سایر',
};

const statusLabels: Record<IssuedTicketStatus, string> = {
  allocated: 'تخصیص‌یافته',
  issued: 'صادرشده',
  changed: 'تغییریافته',
  refunded: 'استردادشده',
  voided: 'باطل‌شده',
};

export function IssuedTicketsWorkspace({
  tickets,
  loading = false,
  error = '',
  onDatesChange,
  reportOptions,
}: {
  reportOptions?: {
    origins: { id: string; name: string }[];
    destinations: { id: string; name: string }[];
    hotels: { id: string; name: string }[];
  };
  tickets: readonly IssuedTicketReadModel[];
  loading?: boolean;
  error?: string;
  onDatesChange?: (query: IssuedTicketQuery) => void;
}) {
  const [query, setQuery] = useState<IssuedTicketQuery>(() => ({
    ...initialIssuedTicketQuery,
    issuedFrom: new Date(Date.now() - 30 * 86400000 + 12600000)
      .toISOString()
      .slice(0, 10),
    issuedTo: new Date(Date.now() + 12600000).toISOString().slice(0, 10),
  }));
  const [applied, setApplied] = useState(query);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  async function download(format: 'xlsx' | 'pdf') {
    setExportError('');
    setExporting(true);
    try {
      await downloadIssuedTicketReport(applied, format);
    } catch (reason) {
      setExportError(
        reason instanceof Error ? reason.message : 'خروجی انجام نشد.',
      );
    } finally {
      setExporting(false);
    }
  }
  const result = useMemo(
    () => queryIssuedTickets(tickets, applied),
    [tickets, applied],
  );
  const routeCounts = useMemo(
    () => countIssuedTicketsByRoute(result.matchedRows),
    [result.matchedRows],
  );
  const filter = (patch: Partial<IssuedTicketQuery>) => {
    const next = { ...query, ...patch, page: 1 };
    setQuery(next);
  };
  function search() {
    if (
      !query.issuedFrom ||
      !query.issuedTo ||
      query.issuedFrom > query.issuedTo
    ) {
      setExportError(
        'بازه تاریخ صدور را انتخاب کنید؛ تاریخ پایان نباید قبل از شروع باشد.',
      );
      return;
    }
    setExportError('');
    setApplied({ ...query, page: 1 });
    onDatesChange?.({ ...query, page: 1 });
  }
  const options = useMemo(() => {
    const origins = new Map<string, string>();
    const destinations = new Map<string, string>();
    const airlines = new Map<string, string>();
    for (const ticket of tickets) {
      if (ticket.originCityId) origins.set(ticket.originCityId, ticket.origin);
      if (ticket.destinationCityId)
        destinations.set(ticket.destinationCityId, ticket.destination);
      if (ticket.airlineId) airlines.set(ticket.airlineId, ticket.airline);
    }
    return {
      origins: reportOptions?.origins.map((r) => [r.id, r.name] as const) ?? [
        ...origins,
      ],
      destinations: reportOptions?.destinations.map(
        (r) => [r.id, r.name] as const,
      ) ?? [...destinations],
      airlines: [...airlines],
    };
  }, [tickets, reportOptions]);

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        title="گزارش خدمات مسافران"
        eyebrow="گزارش فقط‌خواندنی رزرواسیون"
        description="پیگیری بلیط صادرشده، قرارداد، مسافر، PNR و مسیر؛ عملیات صدور و استرداد همچنان در رزرواسیون انجام می‌شود."
      />
      {loading ? (
        <Alert
          title="در حال دریافت اطلاعات رزرواسیون"
          description="قراردادها، مسافران و مسیرهای ثبت‌شده در حال خواندن هستند."
        />
      ) : null}
      {error ? (
        <Alert
          tone="warning"
          title="دریافت گزارش انجام نشد"
          description={error}
        />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">تعداد خدمات در گزارش</p>
          <div className="mt-3 flex items-center justify-between">
            <strong className="text-2xl text-primary">
              {result.total.toLocaleString('fa-IR')}
            </strong>
            <TicketCheck className="size-7 text-primary" aria-hidden />
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">فعال و تغییریافته</p>
          <strong className="mt-3 block text-2xl text-emerald-700">
            {result.matchedRows
              .filter((ticket) => ['issued', 'changed'].includes(ticket.status))
              .length.toLocaleString('fa-IR')}
          </strong>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">استرداد یا ابطال</p>
          <strong className="mt-3 block text-2xl text-rose-700">
            {result.matchedRows
              .filter((ticket) =>
                ['refunded', 'voided'].includes(ticket.status),
              )
              .length.toLocaleString('fa-IR')}
          </strong>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">تعداد مسیرها</p>
          <div className="mt-3 flex items-center justify-between">
            <strong className="text-2xl">
              {routeCounts.length.toLocaleString('fa-IR')}
            </strong>
            <Route className="size-7 text-sky-600" aria-hidden />
          </div>
        </Card>
      </div>
      {routeCounts.length ? (
        <Card className="p-4">
          <h2 className="font-bold">جمع قطعه پرواز صادرشده در هر مسیر</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {routeCounts.map((route) => (
              <Badge key={route.key}>
                {route.origin} ← {route.destination} •{' '}
                {route.count.toLocaleString('fa-IR')} بلیط
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}
      <Card
        className="space-y-4 p-4"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            search();
          }
        }}
      >
        <div className="flex items-center gap-2">
          <Search className="size-5 text-primary" aria-hidden />
          <h2 className="font-bold">فیلتر بلیط‌های صادرشده</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FormField label="نوع خدمت" id="report-service">
            <select
              id="report-service"
              className="h-11 w-full rounded-lg border bg-background px-3"
              value={query.serviceKind}
              onChange={(e) =>
                filter({ serviceKind: e.target.value, hotelId: 'all' })
              }
            >
              {Object.entries(serviceLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="هتل" id="report-hotel">
            <select
              id="report-hotel"
              className="h-11 w-full rounded-lg border bg-background px-3"
              value={query.hotelId}
              onChange={(e) =>
                filter({
                  hotelId: e.target.value,
                  serviceKind:
                    e.target.value === 'all' ? query.serviceKind : 'HOTEL',
                })
              }
            >
              <option value="all">همه هتل‌ها</option>
              {reportOptions?.hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="مبنای تاریخ" id="report-date-basis">
            <select
              id="report-date-basis"
              className="h-11 w-full rounded-lg border bg-background px-3"
              value={query.dateBasis}
              onChange={(e) => filter({ dateBasis: e.target.value })}
            >
              <option value="ISSUED">صدور / ثبت درخواست</option>
              <option value="TRAVEL">حرکت / ورود هتل</option>
            </select>
          </FormField>
          <FormField label="جست‌وجوی کلی" id="issued-ticket-search">
            <Input
              id="issued-ticket-search"
              value={query.search}
              placeholder="قرارداد، مسافر، بلیط، PNR…"
              onChange={(event) => filter({ search: event.target.value })}
            />
          </FormField>
          <FormField label="شماره قرارداد" id="issued-contract-number">
            <Input
              id="issued-contract-number"
              value={query.contractNumber}
              onChange={(event) =>
                filter({ contractNumber: event.target.value })
              }
            />
          </FormField>
          <FormField label="نام مسافر" id="issued-passenger">
            <Input
              id="issued-passenger"
              value={query.passenger}
              onChange={(event) => filter({ passenger: event.target.value })}
            />
          </FormField>
          <FormField label="شماره بلیط یا PNR" id="issued-document-number">
            <Input
              id="issued-document-number"
              value={query.documentNumber}
              onChange={(event) =>
                filter({ documentNumber: event.target.value })
              }
            />
          </FormField>
          <FormField label="مبدأ" id="issued-origin">
            <Select
              value={query.originCityId}
              onValueChange={(originCityId) => filter({ originCityId })}
            >
              <SelectTrigger id="issued-origin">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">همه مبدأها</SelectItem>
                {options.origins.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="مقصد" id="issued-destination">
            <Select
              value={query.destinationCityId}
              onValueChange={(destinationCityId) =>
                filter({ destinationCityId })
              }
            >
              <SelectTrigger id="issued-destination">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">همه مقصدها</SelectItem>
                {options.destinations.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="ایرلاین" id="issued-airline">
            <Select
              value={query.airlineId}
              onValueChange={(airlineId) => filter({ airlineId })}
            >
              <SelectTrigger id="issued-airline">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">همه ایرلاین‌ها</SelectItem>
                {options.airlines.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="وضعیت" id="issued-status">
            <Select
              value={query.status}
              onValueChange={(status) =>
                filter({ status: status as IssuedTicketQuery['status'] })
              }
            >
              <SelectTrigger id="issued-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                {Object.entries(statusLabels).map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            label={
              query.dateBasis === 'TRAVEL' ? 'سفر از تاریخ' : 'صدور از تاریخ'
            }
            id="issued-from"
          >
            <TicketDatePicker
              id="issued-from"
              value={query.issuedFrom}
              onChange={(issuedFrom) => filter({ issuedFrom })}
            />
          </FormField>
          <FormField
            label={
              query.dateBasis === 'TRAVEL' ? 'سفر تا تاریخ' : 'صدور تا تاریخ'
            }
            id="issued-to"
          >
            <TicketDatePicker
              id="issued-to"
              value={query.issuedTo}
              onChange={(issuedTo) => filter({ issuedTo })}
            />
          </FormField>
          <div className="flex items-end gap-2">
            <Button disabled={loading} onClick={search}>
              جست‌وجو
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const next = {
                  ...initialIssuedTicketQuery,
                  issuedFrom: query.issuedFrom,
                  issuedTo: query.issuedTo,
                };
                setQuery(next);
                setApplied(next);
                onDatesChange?.(next);
              }}
            >
              پاک‌کردن همه فیلترها
            </Button>
          </div>
        </div>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={loading || exporting}
          onClick={() => void download('xlsx')}
        >
          دانلود اکسل
        </Button>
        <Button
          disabled={loading || exporting}
          onClick={() => void download('pdf')}
        >
          دانلود PDF
        </Button>
      </div>
      {exportError ? (
        <Alert
          tone="warning"
          title="خروجی انجام نشد"
          description={exportError}
        />
      ) : null}
      {!result.rows.length ? (
        <EmptyState
          icon={FileCheck2}
          title={
            loading
              ? 'در حال دریافت بلیط‌ها'
              : error
                ? 'اطلاعات رزرواسیون در دسترس نیست'
                : 'بلیطی با این فیلترها پیدا نشد'
          }
          description={
            loading
              ? 'کمی صبر کنید.'
              : error
                ? 'اتصال سرور و مجوز مشاهده رزرواسیون را بررسی کنید.'
                : 'فیلترها را تغییر دهید یا قرارداد دیگری را جست‌وجو کنید.'
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {result.rows.map((ticket) => (
            <Card className="space-y-3 p-4" key={ticket.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong>
                    {ticket.origin && ticket.destination
                      ? `${ticket.origin} ← ${ticket.destination}`
                      : ticket.hotelName || ticket.serviceTitle}
                  </strong>
                  <p className="mt-1 text-sm text-muted-foreground">
                    قرارداد {ticket.contractNumber} •{' '}
                    {ticket.passengerDisplayName}
                  </p>
                </div>
                <Badge>
                  {ticket.reportStatus === 'ALLOCATED'
                    ? 'تخصیص‌یافته'
                    : statusLabels[ticket.status]}
                </Badge>
              </div>
              <p className="text-sm font-semibold">
                {serviceLabels[ticket.serviceKind ?? 'FLIGHT']}{' '}
                {ticket.direction === 'OUTBOUND'
                  ? 'رفت'
                  : ticket.direction === 'RETURN'
                    ? 'برگشت'
                    : ''}{' '}
                · {ticket.hotelName || ticket.serviceTitle}
              </p>
              {ticket.departureAt ? (
                <p className="text-sm" dir="ltr">
                  {new Intl.DateTimeFormat('en-GB', {
                    timeZone: 'Asia/Tehran',
                    dateStyle: 'medium',
                  }).format(new Date(ticket.departureAt))}
                  {ticket.checkOutDate ? ' → ' + ticket.checkOutDate : ''}
                </p>
              ) : null}
              {!ticket.serviceKind || ticket.serviceKind === 'FLIGHT' ? (
                <p className="text-sm">
                  بلیط: {ticket.ticketNumber || 'ثبت نشده'} • PNR:{' '}
                  {ticket.pnr || 'ثبت نشده'} • {ticket.airline}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      )}
      {result.pages > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            disabled={result.page <= 1}
            onClick={() => setApplied({ ...applied, page: result.page - 1 })}
          >
            قبلی
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحه {result.page.toLocaleString('fa-IR')} از{' '}
            {result.pages.toLocaleString('fa-IR')}
          </span>
          <Button
            variant="outline"
            disabled={result.page >= result.pages}
            onClick={() => setApplied({ ...applied, page: result.page + 1 })}
          >
            بعدی
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ConnectedIssuedTicketsWorkspace() {
  const [tickets, setTickets] = useState<IssuedTicketReadModel[]>([]);
  const [reportOptions, setReportOptions] = useState<{
    origins: { id: string; name: string }[];
    destinations: { id: string; name: string }[];
    hotels: { id: string; name: string }[];
  }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<IssuedTicketQuery>(() => ({
    ...initialIssuedTicketQuery,
    issuedFrom: new Date(Date.now() - 30 * 86400000 + 12600000)
      .toISOString()
      .slice(0, 10),
    issuedTo: new Date(Date.now() + 12600000).toISOString().slice(0, 10),
  }));
  const onDatesChange = useCallback((q: IssuedTicketQuery) => {
    setLoading(true);
    setRange(q);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void loadReservationIssuedTickets(controller.signal, range)
      .then((data) => {
        if (controller.signal.aborted) return;
        setTickets(data.data);
        setReportOptions(data.options);
        setError('');
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setTickets([]);
        setError(
          reason instanceof Error
            ? reason.message
            : 'دریافت گزارش بلیط‌ها انجام نشد.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [range]);
  return (
    <IssuedTicketsWorkspace
      {...(reportOptions ? { reportOptions } : {})}
      tickets={tickets}
      loading={loading}
      error={error}
      onDatesChange={onDatesChange}
    />
  );
}
