import {
  BusFront,
  Eye,
  FilePenLine,
  MapPin,
  Plane,
  Power,
  RefreshCw,
  TrainFront,
  Trash2,
} from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import {
  type CatalogStatus,
  type Product,
  type Reference,
} from '../model/catalog';
import {
  displayTime,
  journeyLabels,
  statusLabels,
  supplyLabels,
} from '../model/preview';

const transportIcons = {
  flight: Plane,
  train: TrainFront,
  bus: BusFront,
};

const accents = {
  flight: 'border-s-cyan-500',
  train: 'border-s-emerald-500',
  bus: 'border-s-amber-500',
};

type TicketCatalogCardProps = {
  product: Product;
  referenceLabel: (
    kind: Reference['kind'],
    id: string,
    fallback: string,
  ) => string;
  onView: () => void;
  onEdit: () => void;
  onRepeat: () => void;
  onDelete: () => void;
  onStatus: (status: CatalogStatus) => void;
};

export function TicketCatalogCard({
  product,
  referenceLabel,
  onView,
  onEdit,
  onRepeat,
  onDelete,
  onStatus,
}: TicketCatalogCardProps) {
  const segment = product.definition.segments[0]!;
  const display = product.definition.display;
  const TransportIcon = transportIcons[product.definition.transport];
  const operatorKind =
    product.definition.transport === 'flight'
      ? 'airline'
      : product.definition.transport === 'train'
        ? 'railCompany'
        : 'busCompany';
  const powerStatus: CatalogStatus | null =
    product.status === 'active'
      ? 'paused'
      : product.status === 'paused' || product.status === 'draft'
        ? 'active'
        : null;

  return (
    <Card
      className={`relative overflow-hidden border-s-4 p-0 transition-shadow hover:shadow-md ${accents[product.definition.transport]}`}
    >
      <div className="border-b bg-muted/25 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <TransportIcon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate font-black">{product.definition.title}</p>
              <p className="mt-1 text-xs">
                <span className="font-bold text-primary">
                  {product.definition.transport === 'flight'
                    ? 'ایرلاین'
                    : 'شرکت'}
                  :
                </span>{' '}
                {referenceLabel(
                  operatorKind,
                  segment.airlineId,
                  display?.operator || 'شرکت انتخاب نشده',
                )}{' '}
                • <span dir="ltr">{segment.flightNumber}</span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            <Badge>{statusLabels[product.status]}</Badge>
            <Badge>{journeyLabels[product.definition.journeyRole]}</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 p-3">
        <div className="flex items-center gap-2 font-black">
          <MapPin className="size-5 text-primary" aria-hidden />
          <span>
            {referenceLabel(
              'city',
              segment.originCityId,
              display?.origin || 'مبدأ',
            )}
          </span>
          <span className="text-primary">←</span>
          <span>
            {referenceLabel(
              'city',
              segment.destinationCityId,
              display?.destination || 'مقصد',
            )}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {product.definition.transport === 'flight'
            ? `${referenceLabel('airport', segment.originAirportId, segment.originTerminal || 'فرودگاه مبدأ')} ← ${referenceLabel('airport', segment.destinationAirportId, segment.destinationTerminal || 'فرودگاه مقصد')}`
            : `${segment.originTerminal || 'پایانه مبدأ'} ← ${segment.destinationTerminal || 'پایانه مقصد'}`}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/45 p-2">
            <p className="text-xs text-muted-foreground">حرکت</p>
            <p className="mt-1 text-sm font-bold">
              {displayTime(segment.departureAt, segment.departureZone)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/45 p-2">
            <p className="text-xs text-muted-foreground">رسیدن</p>
            <p className="mt-1 text-sm font-bold">
              {displayTime(segment.arrivalAt, segment.arrivalZone)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-y py-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">ظرفیت</p>
            <p className="mt-0.5 font-bold">
              {product.definition.totalCapacity.toLocaleString('fa-IR')} نفر
            </p>
          </div>
          <Badge>{supplyLabels[product.definition.supplyType]}</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={onView}>
            <Eye className="size-4" aria-hidden />
            مشاهده
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit}>
            <FilePenLine className="size-4" aria-hidden />
            ویرایش
          </Button>
          <Button size="sm" variant="outline" onClick={onRepeat}>
            <RefreshCw className="size-4" aria-hidden />
            تکرار
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="text-destructive"
            title="حذف بلیت"
            aria-label="حذف بلیت"
            onClick={onDelete}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
          {powerStatus ? (
            <Button
              size="sm"
              variant="outline"
              className={
                powerStatus === 'active'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
              }
              title={
                powerStatus === 'active'
                  ? 'فعال‌کردن دوباره فروش بلیت'
                  : 'توقف فروش بلیت'
              }
              aria-label={
                powerStatus === 'active'
                  ? 'فعال‌کردن دوباره فروش بلیت'
                  : 'توقف فروش بلیت'
              }
              onClick={() => onStatus(powerStatus)}
            >
              <Power className="size-4" aria-hidden />
              {powerStatus === 'active' ? 'فعال‌کردن فروش' : 'توقف فروش'}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled
              title="فروش این بلیت متوقف است"
              aria-label="فروش این بلیت متوقف است"
            >
              <Power className="size-4" aria-hidden />
              فروش متوقف است
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          نسخه {product.version.toLocaleString('fa-IR')} • قیمت فروش هنگام فروش
          تعیین می‌شود
        </p>
      </div>
    </Card>
  );
}
