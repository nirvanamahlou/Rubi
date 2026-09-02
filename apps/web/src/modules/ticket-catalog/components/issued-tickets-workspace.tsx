'use client';

import { useMemo, useState } from 'react';
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
import { TicketDatePicker } from './ticket-date-picker';

const statusLabels: Record<IssuedTicketStatus, string> = {
  issued: 'صادرشده',
  changed: 'تغییریافته',
  refunded: 'استردادشده',
  voided: 'باطل‌شده',
};

export function IssuedTicketsWorkspace({
  connected,
  tickets,
}: {
  connected: boolean;
  tickets: readonly IssuedTicketReadModel[];
}) {
  const [query, setQuery] = useState<IssuedTicketQuery>(
    initialIssuedTicketQuery,
  );
  const result = queryIssuedTickets(tickets, query);
  const routeCounts = countIssuedTicketsByRoute(tickets);
  const filter = (patch: Partial<IssuedTicketQuery>) =>
    setQuery({ ...query, ...patch, page: 1 });
  const options = useMemo(() => {
    const origins = new Map<string, string>();
    const destinations = new Map<string, string>();
    const airlines = new Map<string, string>();
    for (const ticket of tickets) {
      origins.set(ticket.originCityId, ticket.origin);
      destinations.set(ticket.destinationCityId, ticket.destination);
      airlines.set(ticket.airlineId, ticket.airline);
    }
    return {
      origins: [...origins],
      destinations: [...destinations],
      airlines: [...airlines],
    };
  }, [tickets]);

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        title="بلیت‌های صادرشده مسافران"
        eyebrow="گزارش فقط‌خواندنی رزرواسیون"
        description="پیگیری بلیت صادرشده، قرارداد، مسافر، PNR و مسیر؛ عملیات صدور و استرداد همچنان در رزرواسیون انجام می‌شود."
      />
      {!connected ? (
        <Alert
          tone="warning"
          title="در انتظار اتصال قرارداد عمومی رزرواسیون"
          description="این صفحه داده ساختگی ذخیره نمی‌کند. پس از انتشار قرارداد عمومی رزرواسیون، بلیت‌های واقعی به‌صورت فقط‌خواندنی اینجا نمایش داده می‌شوند."
        />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">جمع بلیت‌های صادرشده</p>
          <div className="mt-3 flex items-center justify-between">
            <strong className="text-2xl text-primary">
              {tickets.length.toLocaleString('fa-IR')}
            </strong>
            <TicketCheck className="size-7 text-primary" aria-hidden />
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">فعال و تغییریافته</p>
          <strong className="mt-3 block text-2xl text-emerald-700">
            {tickets
              .filter((ticket) => ['issued', 'changed'].includes(ticket.status))
              .length.toLocaleString('fa-IR')}
          </strong>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">استرداد یا ابطال</p>
          <strong className="mt-3 block text-2xl text-rose-700">
            {tickets
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
          <h2 className="font-bold">جمع بلیت صادرشده در هر مسیر</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {routeCounts.map((route) => (
              <Badge key={route.key}>
                {route.origin} ← {route.destination} •{' '}
                {route.count.toLocaleString('fa-IR')} بلیت
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}
      <Card className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Search className="size-5 text-primary" aria-hidden />
          <h2 className="font-bold">فیلتر بلیت‌های صادرشده</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FormField label="جست‌وجوی کلی" id="issued-ticket-search">
            <Input
              id="issued-ticket-search"
              value={query.search}
              placeholder="قرارداد، مسافر، بلیت، PNR…"
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
          <FormField label="شماره بلیت یا PNR" id="issued-document-number">
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
          <FormField label="صدور از تاریخ" id="issued-from">
            <TicketDatePicker
              id="issued-from"
              value={query.issuedFrom}
              onChange={(issuedFrom) => filter({ issuedFrom })}
            />
          </FormField>
          <FormField label="صدور تا تاریخ" id="issued-to">
            <TicketDatePicker
              id="issued-to"
              value={query.issuedTo}
              onChange={(issuedTo) => filter({ issuedTo })}
            />
          </FormField>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => setQuery(initialIssuedTicketQuery)}
            >
              پاک‌کردن همه فیلترها
            </Button>
          </div>
        </div>
      </Card>
      {!result.rows.length ? (
        <EmptyState
          icon={FileCheck2}
          title={
            connected
              ? 'بلیتی با این فیلترها پیدا نشد'
              : 'هنوز داده رزرواسیون متصل نشده است'
          }
          description={
            connected
              ? 'فیلترها را تغییر دهید یا قرارداد دیگری را جست‌وجو کنید.'
              : 'پس از اتصال قرارداد عمومی رزرواسیون، اطلاعات واقعی بلیت‌های مسافران در این بخش نمایش داده می‌شود.'
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {result.rows.map((ticket) => (
            <Card className="space-y-3 p-4" key={ticket.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong>
                    {ticket.origin} ← {ticket.destination}
                  </strong>
                  <p className="mt-1 text-sm text-muted-foreground">
                    قرارداد {ticket.contractNumber} •{' '}
                    {ticket.passengerDisplayName}
                  </p>
                </div>
                <Badge>{statusLabels[ticket.status]}</Badge>
              </div>
              <p className="text-sm">
                بلیت: {ticket.ticketNumber} • PNR: {ticket.pnr} •{' '}
                {ticket.airline}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
