import { Badge, Card } from '@/components/ui';
import type { Product, Reference, Segment } from '../model/catalog';
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
  const first = definition.segments[0]!;
  const last = definition.segments.at(-1)!;
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
  const city = (segment: Segment, end: 'origin' | 'destination') => {
    const edgeFallback =
      segment === first && end === 'origin'
        ? display?.origin
        : segment === last && end === 'destination'
          ? display?.destination
          : undefined;
    return referenceLabel(
      'city',
      segment[(end + 'CityId') as 'originCityId' | 'destinationCityId'],
      edgeFallback ||
        segment[
          (end + 'Terminal') as 'originTerminal' | 'destinationTerminal'
        ] ||
        (end === 'origin' ? 'مبدأ' : 'مقصد'),
    );
  };
  const terminal = (segment: Segment, end: 'origin' | 'destination') => {
    const fallback =
      segment[(end + 'Terminal') as 'originTerminal' | 'destinationTerminal'] ||
      (definition.transport === 'flight'
        ? 'فرودگاه انتخاب نشده'
        : 'پایانه ثبت نشده');
    return definition.transport === 'flight'
      ? referenceLabel(
          'airport',
          segment[
            (end + 'AirportId') as 'originAirportId' | 'destinationAirportId'
          ],
          fallback,
        )
      : fallback;
  };
  const origin = referenceLabel(
    'city',
    first.originCityId,
    display?.origin || 'مبدأ',
  );
  const destination = referenceLabel(
    'city',
    last.destinationCityId,
    display?.destination || 'مقصد',
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
            {definition.segments.length > 1 ? (
              <Badge>
                {definition.segments.length.toLocaleString('fa-IR')} قطعه
              </Badge>
            ) : null}
            <Badge>{statusLabels[product.status]}</Badge>
          </div>
        </div>
      </Card>

      {definition.segments.map((segment, index) => (
        <Card className="space-y-3 p-4" key={'ticket-detail-segment-' + index}>
          <p className="font-black text-primary">
            قطعه {(index + 1).toLocaleString('fa-IR')}؛{' '}
            {city(segment, 'origin')} ← {city(segment, 'destination')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Detail
              label={operatorTitle}
              value={referenceLabel(
                operatorKind,
                segment.airlineId,
                index === 0 ? display?.operator || '—' : '—',
              )}
            />
            <Detail
              label={vehicleTitle}
              value={referenceLabel(
                definition.transport === 'flight'
                  ? 'aircraft'
                  : definition.transport === 'train'
                    ? 'trainType'
                    : 'busType',
                segment.aircraftId,
                index === 0 ? display?.vehicle || '—' : '—',
              )}
            />
            <Detail label="شماره سرویس" value={segment.flightNumber} ltr />
            <Detail label="مبدأ" value={city(segment, 'origin')} />
            <Detail label="مقصد" value={city(segment, 'destination')} />
            <Detail
              label="مسیر پایانه‌ها"
              value={
                terminal(segment, 'origin') +
                ' ← ' +
                terminal(segment, 'destination')
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
          </div>
        </Card>
      ))}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Detail
          label="ظرفیت کل بلیت"
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
