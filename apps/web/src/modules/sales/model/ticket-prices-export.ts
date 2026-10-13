import type { TicketOfferV1, TicketSalePriceTargetV1 } from '@nora/contracts';
import { netTicketPrice, type TicketPriceRow } from './ticket-price-rows';

const dateTime = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  hourCycle: 'h23',
  timeZone: 'Asia/Tehran',
});

function flightFields(
  offer: TicketOfferV1 | undefined,
  cities: Record<string, string>,
) {
  if (!offer) return ['', '', '', '', '', '', '', ''];
  return [
    offer.carrierName,
    offer.serviceNumber,
    cities[offer.originId] ?? offer.originId,
    cities[offer.destinationId] ?? offer.destinationId,
    dateTime.format(new Date(offer.departureAt)),
    offer.remainingCapacity.toLocaleString('fa-IR'),
    offer.cabinClassCode,
    offer.status === 'ACTIVE' ? 'فعال' : 'متوقف',
  ];
}

export function ticketPriceExportRows(
  rows: readonly TicketPriceRow[],
  targets: readonly TicketSalePriceTargetV1[],
  cities: Record<string, string>,
) {
  const activeTargets = targets.filter((target) => target.isActive);
  const headers = [
    'نوع بلیت',
    'مسیر',
    'ایرلاین رفت',
    'شماره پرواز رفت',
    'مبدأ رفت',
    'مقصد رفت',
    'زمان حرکت رفت',
    'ظرفیت باقی‌مانده رفت',
    'کلاس رفت',
    'وضعیت رفت',
    'ایرلاین برگشت',
    'شماره پرواز برگشت',
    'مبدأ برگشت',
    'مقصد برگشت',
    'زمان حرکت برگشت',
    'ظرفیت باقی‌مانده برگشت',
    'کلاس برگشت',
    'وضعیت برگشت',
    'قیمت پایه',
    'ارز',
    'کمیسیون مجموعه ٪',
    'قیمت مجموعه',
    ...activeTargets.flatMap((target) => [
      `کمیسیون ${target.name} ٪`,
      `قیمت ${target.name}`,
    ]),
  ];
  return [
    headers,
    ...rows.map((row) => {
      const path = `${cities[row.offer.originId] ?? row.offer.originId} ← ${cities[row.offer.destinationId] ?? row.offer.destinationId}`;
      const baseAmount = row.base?.amount ?? '';
      const baseCurrency = row.base?.currencyCode ?? '';
      const commission = (targetId: string | null) =>
        row.offer.saleCommissions?.find(
          (item) =>
            item.returnOfferId === row.returnOfferId &&
            item.salePriceTargetId === targetId,
        );
      const direct = commission(null);
      const priceFor = (targetId: string) => {
        const saved = commission(targetId);
        const legacy = !row.returnOfferId
          ? row.offer.targetedStandaloneSalePrices?.find(
              (item) => item.salePriceTarget.id === targetId,
            )
          : undefined;
        if (saved)
          return [
            saved.percent,
            saved.isHidden || Number(saved.percent) === 100
              ? 'عدم نمایش'
              : `${saved.amount} ${saved.currencyCode}`,
          ];
        if (legacy) return ['—', `${legacy.amount} ${legacy.currencyCode}`];
        const amount = row.base ? netTicketPrice(row.base.amount, '0') : '';
        return amount ? ['0', `${amount} ${baseCurrency}`] : ['', ''];
      };
      return [
        row.returnOfferId ? 'رفت‌وبرگشت' : 'یک‌طرفه',
        path,
        ...flightFields(row.offer, cities),
        ...flightFields(row.returning, cities),
        baseAmount,
        baseCurrency,
        direct?.percent ?? (row.base ? '0' : ''),
        direct
          ? direct.isHidden || Number(direct.percent) === 100
            ? 'عدم نمایش'
            : `${direct.amount} ${direct.currencyCode}`
          : row.base
            ? `${netTicketPrice(row.base.amount, '0') ?? ''} ${baseCurrency}`.trim()
            : '',
        ...activeTargets.flatMap((target) =>
          target.branchId === row.offer.branchId
            ? priceFor(target.id)
            : ['', ''],
        ),
      ];
    }),
  ];
}
