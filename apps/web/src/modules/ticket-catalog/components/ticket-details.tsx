import { Badge, Card } from '@/components/ui';
import type { Product, Reference } from '../model/catalog';
import {
  displayTime,
  journeyLabels,
  statusLabels,
  supplyLabels,
  transportLabels,
} from '../model/preview';

function Detail({
  label,
  value,
  ltr = false,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-muted/25 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-bold" dir={ltr ? 'ltr' : undefined}>
        {value || '—'}
      </p>
    </div>
  );
}

export function TicketDetails({
  product,
  referenceLabel,
}: {
  product: Product;
  referenceLabel: (
    kind: Reference['kind'],
    id: string,
    fallback: string,
  ) => string;
}) {
  const definition = product.definition;
  const segment = definition.segments[0]!;
  const display = definition.display;
  const operatorKind =
    definition.transport === 'flight'
      ? 'airline'
      : definition.transport === 'train'
        ? 'railCompany'
        : 'busCompany';
  const operatorTitle =
    definition.transport === 'flight'
      ? 'ایرلاین'
      : definition.transport === 'train'
        ? 'شرکت ریلی'
        : 'شرکت اتوبوس‌رانی';
  const vehicleTitle =
    definition.transport === 'flight'
      ? 'نوع هواپیما'
      : definition.transport === 'train'
        ? 'نوع قطار'
        : 'نوع اتوبوس';
  const origin = referenceLabel(
    'city',
    segment.originCityId,
    display?.origin || 'مبدأ',
  );
  const destination = referenceLabel(
    'city',
    segment.destinationCityId,
    display?.destination || 'مقصد',
  );
  const operator = referenceLabel(
    operatorKind,
    segment.airlineId,
    display?.operator || '—',
  );

  return (
    <div className="space-y-4">
      <Card className="space-y-3 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-black">{definition.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {origin} ← {destination}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{transportLabels[definition.transport]}</Badge>
            <Badge>{journeyLabels[definition.journeyRole]}</Badge>
            <Badge>{statusLabels[product.status]}</Badge>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label={operatorTitle} value={operator} />
        <Detail label={vehicleTitle} value={display?.vehicle || '—'} />
        <Detail label="شماره سرویس" value={segment.flightNumber} ltr />
        <Detail label="مبدأ" value={origin} />
        <Detail label="مقصد" value={destination} />
        <Detail
          label="مسیر پایانه‌ها"
          value={
            (segment.originTerminal || 'پایانه مبدأ') +
            ' ← ' +
            (segment.destinationTerminal || 'پایانه مقصد')
          }
        />
        <Detail
          label="حرکت"
          value={displayTime(segment.departureAt, segment.departureZone)}
        />
        <Detail
          label="رسیدن"
          value={displayTime(segment.arrivalAt, segment.arrivalZone)}
        />
        <Detail
          label="ظرفیت"
          value={definition.totalCapacity.toLocaleString('fa-IR') + ' نفر'}
        />
        <Detail label="نوع تأمین" value={supplyLabels[definition.supplyType]} />
        <Detail
          label="نرخ خرید"
          value={
            (product.fares.at(-1)?.purchase || '—') +
            ' ' +
            (product.fares.at(-1)?.currencyCode || '')
          }
          ltr
        />
        <Detail label="قوانین بلیت" value={definition.rules || 'ثبت نشده'} />
      </div>
    </div>
  );
}
