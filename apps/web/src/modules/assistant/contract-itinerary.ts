import {
  salesBookedAgeCategory,
  type SalesContractDetail,
} from '@nora/contracts';
import { exactFlightQuery } from '@/modules/sales/model/exact-flight-dates';
import { searchTickets } from '@/modules/sales/api/ticket-search';

const day = (value: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));

export function itineraryEvidence(c: SalesContractDetail) {
  const notes: string[] = [];
  const seen = new Set<string>();
  const guests = c.passengersDetail ?? [];
  const services = c.servicesDetail ?? [];
  for (const [i, p] of guests.entries()) {
    const prefix = 'مسافر ' + (i + 1) + ' — ';
    if (seen.has(p.customerId)) notes.push(prefix + 'شناسه مسافر تکراری است.');
    seen.add(p.customerId);
    if (
      !p.serviceClientKeys.some((key) =>
        services.some((s) => s.clientKey === key),
      )
    )
      notes.push(prefix + 'خدمت تخصیص‌یافته ندارد.');
    if (!p.birthDate) {
      notes.push(
        prefix + 'تاریخ تولد ثبت نشده؛ رده رزرو با سن واقعی تطبیق داده نشد.',
      );
      continue;
    }
    const dateOnly = p.birthDate.slice(0, 10);
    const category = (value: string) =>
      salesBookedAgeCategory({ ...p, birthDate: dateOnly }, value.slice(0, 10));
    if (c.departureDate && category(c.departureDate) !== p.ageCategory)
      notes.push(prefix + 'رده رزرو با سن تاریخ رفت منطبق نیست.');
    if (
      c.departureDate &&
      c.returnNotBefore &&
      category(c.returnNotBefore) !== category(c.departureDate)
    )
      notes.push(prefix + 'رده سنی بین رفت و تاریخ بازگشت تغییر می‌کند.');
  }
  if (guests.length)
    for (const s of services) {
      if (!guests.some((p) => p.serviceClientKeys.includes(s.clientKey)))
        notes.push((s.titleSnapshot || s.kind) + ' — مسافر تخصیص‌یافته ندارد.');
    }
  else if (c.passengerCount)
    notes.push('تعداد تجمیعی ثبت شده است؛ تطبیق فردی مسافران ممکن نیست.');
  const stays = c.hotelSelection
    ? [c.hotelSelection, ...(c.hotelSelection.additionalStays ?? [])].sort(
        (a, b) => a.checkInDate.localeCompare(b.checkInDate),
      )
    : [];
  let end = '';
  for (const stay of stays) {
    const start = stay.checkInDate.slice(0, 10),
      finish = stay.checkOutDate.slice(0, 10);
    notes.push(
      stay.hotelNameSnapshot + ' — ' + start + ' تا ' + finish + ' (میلادی)',
    );
    if (finish <= start) {
      notes.push('تاریخ پایان اقامت معتبر نیست.');
      continue;
    }
    if (end && start !== end)
      notes.push(
        start < end
          ? 'هم‌پوشانی اقامت‌ها؛ تاریخ ورود را بررسی کنید.'
          : 'بین اقامت‌ها فاصله وجود دارد؛ برنامه سفر را تطبیق دهید.',
      );
    if (finish > end) end = finish;
  }
  for (const leg of c.ticketSelections ?? [])
    notes.push(
      [
        leg.direction === 'RETURN' ? 'برگشت' : 'رفت',
        leg.serviceNumberSnapshot,
        leg.originId + ' ← ' + leg.destinationId,
        day(leg.departureAt) + ' تا ' + day(leg.arrivalAt) + ' (میلادی، تهران)',
        day(leg.departureAt) !== day(leg.arrivalAt) ? 'ورود در روزی دیگر' : '',
      ]
        .filter(Boolean)
        .join(' — '),
    );
  return notes;
}

export async function currentOfferEvidence(
  c: SalesContractDetail,
  signal: AbortSignal,
) {
  const lines: string[] = [];
  for (const leg of c.ticketSelections ?? []) {
    const visited = new Set<string>();
    for (let page = 1; ; page++) {
      const result = await searchTickets(
        {
          originId: leg.originId,
          destinationId: leg.destinationId,
          ...exactFlightQuery(day(leg.departureAt)),
          page,
        },
        signal,
      );
      const match = result.data.find(
        (o) => o.id === leg.offerId && o.branchId === c.branchId,
      );
      if (match) {
        const fare = match.standaloneSalePrice;
        lines.push(
          leg.serviceNumberSnapshot +
            ' — ظرفیت فعلی ' +
            match.remainingCapacity +
            ' صندلی؛ وضعیت ' +
            match.status +
            '؛ نسخه پیشنهاد ' +
            match.version,
        );
        if (leg.quotedPrice)
          lines.push(
            'قیمت ثبت‌شده: ' +
              leg.quotedPrice.amount +
              ' ' +
              leg.quotedPrice.currencyCode,
          );
        if (fare)
          lines.push(
            'نرخ پایه فعلی فروش مستقیم: ' +
              fare.amount +
              ' ' +
              fare.currencyCode +
              '؛ نرخ پکیج، رفت‌وبرگشت یا پلکانی ممکن است متفاوت باشد.',
          );
        break;
      }
      if (!result.hasMore) {
        lines.push(
          leg.serviceNumberSnapshot +
            ' — پیشنهاد همسان در فهرست مجاز فعلی یافت نشد؛ ظرفیت قطعی نیست.',
        );
        break;
      }
      if (!result.data.some((o) => !visited.has(o.id)))
        throw Error('pagination');
      result.data.forEach((o) => visited.add(o.id));
    }
  }
  return lines.length ? lines : ['بلیتی با مرجع قابل استعلام ثبت نشده است.'];
}
