import { readLegacyServiceParties } from '@nora/contracts';
import type { TicketDocumentFacts } from '@/modules/ticket-catalog/public/document-details';
import { readPassengerTotalPrices } from '@nora/contracts';
import { readPassengerHotelStays } from '@nora/contracts';
import { salesRoomDisplayName } from '@nora/contracts';
import { readAgencyCommission } from '@nora/contracts';
import { hotelAgeOn } from '@nora/contracts';
import { readPassengerFlightPrices } from '@nora/contracts';
import {
  readPassengerHotelPrices,
  readPassengerDeductions,
} from '@nora/contracts';
import { salesHotelRoomSummary } from '@nora/contracts';
import { currencySymbol } from '@/lib/currency-symbol';
import {
  moneyDecimal,
  moneyUnits,
  salesContractFlights,
  calculateSalesCheque,
  salesPrincipal,
  type SalesContractOutputV1,
  type SalesHotelStayInput,
  type SalesHotelRoomV1,
} from '@nora/contracts';
import { publicDocumentQr } from '@/modules/travel-documents/public/document-qr';
import { contractPendingQrHtml } from './contract-pending-qr';

export interface ContractPrintReferences {
  hotels?: Record<
    string,
    { name: string; city?: string; grade?: string; website?: string }
  >;
  publicDocumentUrl?: string;
  names: Record<string, string>;
  flightFacts?: Record<string, TicketDocumentFacts>;
  hotelGrade?: string;
  hotelLatinName?: string;
  hotelWebsite?: string;
  logoDataUrl?: string;
  international?: boolean;
}
/** Isolate script-shaped symbols from the Latin numeric font used for amounts. */
function contractCurrency(code: string) {
  const symbol = escapeContractText(currencySymbol(code));
  return code === 'IRR' || code === 'IRI'
    ? '<span class="currency-symbol" dir="ltr">IRR</span>'
    : symbol;
}

export const contractOutputTemplateVersion = 'travel-services-v2';

/** Canonical room products take precedence over legacy summary fields. */
export function contractRoomSummary(
  hotel: SalesContractOutputV1['contract']['hotelSelection'],
): string {
  if (!hotel) return 'ندارد';
  if (hotel.rooms?.length)
    hotel = { ...hotel, ...salesHotelRoomSummary(hotel.rooms) };
  const count = (value: number | undefined) =>
    Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
  const total = count(hotel.roomCount);
  if (!total) return 'تعداد اتاق ثبت نشده';
  const single = count(hotel.singleRoomCount);
  const double = count(hotel.doubleRoomCount);
  const extra = count(hotel.extraBedCount);
  const parts =
    single + double > total
      ? ['ترکیب اتاق‌ها نیازمند بررسی است']
      : [
          ...(single ? [`${single} سینگل`] : []),
          ...(double ? [`${double} دبل`] : []),
          ...(total > single + double
            ? [`${total - single - double} اتاق با ترکیب ثبت‌نشده`]
            : []),
        ];
  if (extra) parts.push(`${extra} تخت اضافه`);
  return `مجموع ${total} اتاق: ${parts.join('، ')}`;
}

export function escapeContractText(value: unknown): string {
  return String(value ?? '—').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
}
export function contractMoney(amount: string): string {
  if (!/^-?\d+(\.\d+)?$/.test(amount))
    throw new Error('مبلغ قرارداد معتبر نیست.');
  const [integer = '', fraction] = amount.split('.');
  return (
    integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
    (fraction && /[1-9]/.test(fraction) ? '.' + fraction : '')
  );
}
const date = (value: string) =>
  !Number.isFinite(Date.parse(value))
    ? '—'
    : new Intl.DateTimeFormat('fa-IR', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(value));
const time = (value: string) =>
  new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));

export function contractPrintHtml(
  output: SalesContractOutputV1,
  refs: ContractPrintReferences,
  options: { draft?: boolean } = {},
): string {
  const guestStays = readPassengerHotelStays(
    output.contract.servicesDetail,
    output.contract.hotelSelection,
  );
  const c = output.contract,
    e = escapeContractText;
  const contractNotice = c.servicesDetail
    .map((service) => service.metadata?.contractNotice)
    .find(
      (notice): notice is string =>
        typeof notice === 'string' && Boolean(notice.trim()),
    )
    ?.trim();
  const travelDate = (value: string) =>
    refs.international && Number.isFinite(Date.parse(value))
      ? new Intl.DateTimeFormat('en-GB', {
          calendar: 'gregory',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'Asia/Tehran',
        }).format(new Date(value))
      : date(value);
  const name = (id?: string | null) =>
    id ? (refs.names[id] ?? 'نام مرجع در دسترس نیست') : '—';
  const legacyParties = readLegacyServiceParties(c.servicesDetail);
  const partyCount = legacyParties
    ? Math.max(
        ...Object.values(legacyParties).map(
          (p) => p.adults + p.children + p.infants,
        ),
      )
    : c.passengersDetail.length;
  const completePrices =
    c.passengersDetail.length > 0 &&
    c.passengersDetail.every((p) => p.agreedPrices?.length);
  const passengerTotals = new Map<string, bigint>();
  if (completePrices)
    for (const passenger of c.passengersDetail)
      for (const price of passenger.agreedPrices ?? [])
        passengerTotals.set(
          price.currencyCode,
          (passengerTotals.get(price.currencyCode) ?? 0n) +
            moneyUnits(price.amount),
        );
  const agreementTotal = completePrices
    ? [...passengerTotals]
        .map(
          ([code, amount]) =>
            `<div class="agreement-amount"><bdi>${contractMoney(moneyDecimal(amount))}</bdi><span class="agreement-currency">${contractCurrency(code)}</span></div>`,
        )
        .join('')
    : null;
  const moneyRows = (field: 'amount' | 'confirmedPaid' | 'outstanding') =>
    c.balances
      .map(
        (b) =>
          `<div class="agreement-amount"><bdi>${contractMoney(b[field])}</bdi><span class="agreement-currency">${contractCurrency(b.currencyCode)}</span></div>`,
      )
      .join('');
  const chequeTerms =
    c.paymentTerms?.mode === 'CHECK'
      ? `<p class="note"><b>فروش چکی · سود ماهیانه ۵٪ روی مانده خرید</b></p>${salesPrincipal(
          c.priceComponents,
        )
          .map((total) => {
            const plan = c.paymentTerms!.plans.find(
              (p) => p.currencyCode === total.currencyCode,
            )!;
            const result = calculateSalesCheque(total.amount, plan);
            return `<p class="note">${contractCurrency(total.currencyCode)} · مبلغ خرید: ${e(contractMoney(total.amount))} · پیش‌پرداخت: ${e(contractMoney(plan.downPayment))} · سود کل: ${e(contractMoney(result.fee))} · ${plan.months} چک · اولین سررسید: ${e(date(plan.firstDueDate))}</p>`;
          })
          .join('')}`
      : '';
  const kind = (k: string) =>
    ({
      FLIGHT: 'پرواز',
      HOTEL: 'هتل',
      VISA: 'ویزا',
      TRANSFER: 'ترانسفر',
      INSURANCE: 'بیمه',
      TOUR: 'تور',
      TRAIN: 'قطار',
      BUS: 'اتوبوس',
      CIP: 'CIP',
      OTHER: 'سایر',
    })[k] ?? k;
  const heading = (n: number, en: string, fa: string) =>
    `<h2><em>${String(n).padStart(2, '0')}</em><span dir="ltr">${en}</span><small>${fa}</small></h2>`;
  const agency = output.customer.kind === 'organization';
  const commission = agency
    ? readAgencyCommission(c.servicesDetail)
    : undefined;
  const deductions = readPassengerDeductions(
    c.servicesDetail,
    c.passengersDetail,
  );
  const showDiscount = Object.values(deductions).some(
    (p) => p.discount !== undefined,
  );
  const showCommission =
    Boolean(commission) ||
    Object.values(deductions).some((p) => p.commission !== undefined);
  const passengerColumns = (
    showDiscount && showCommission
      ? [4, 21, 10, 18, 18, 10, 10, 9]
      : showDiscount || showCommission
        ? [5, 27, 10, 18, 18, 12, 10]
        : [5, 30, 10, 24, 21, 10]
  )
    .map((width) => `<col style="width:${width}%">`)
    .join('');
  const contractPartyName = c.customerNameSnapshot;
  const hotel = c.hotelSelection;
  // Hotel room product is a Master Data reference, not a passenger bed/age category.
  const room = hotel
    ? name(hotel.rooms?.[0]?.roomTypeId ?? hotel.roomTypeId)
    : '—';
  const roomCount = hotel?.rooms?.length ?? hotel?.roomCount ?? 0;
  const roomGuestCount = hotel?.rooms?.length
    ? hotel.rooms.reduce(
        (total, room) => total + room.adults + room.childAges.length,
        0,
      )
    : (hotel?.occupancy ?? 0);
  const hotelSection = (stay: SalesHotelStayInput, index: number) => {
    const reference = refs.hotels?.[stay.hotelId];
    const rooms: readonly SalesHotelRoomV1[] =
      index === 0
        ? (hotel?.rooms ?? [])
        : hotel?.rooms?.length
          ? hotel.rooms.map((first, i) => ({
              ...(stay.rooms?.[i] ?? {
                ordinal: i + 1,
                roomTypeId: '',
                roomTypeNameSnapshot: '—',
              }),
              adults: first.adults,
              childAges: first.childAges,
            }))
          : (stay.rooms ?? []);
    const mixed = new Set(rooms.map((r) => r.roomTypeId)).size > 1;
    const fallbackCity = refs.names[stay.cityId];
    const city =
      reference?.city ??
      (fallbackCity && !/[\u0600-\u06ff]/.test(fallbackCity)
        ? fallbackCity
        : '—');
    const title =
      index === 0
        ? 'اطلاعات هتل'
        : index === 1
          ? 'اقامت دوم'
          : `اقامت ${index + 1}`;
    const summary = rooms.length
      ? salesHotelRoomSummary(rooms)
      : { roomCount, occupancy: roomGuestCount };
    const hotelName =
      reference?.name ??
      (index === 0 ? refs.hotelLatinName : undefined) ??
      stay.hotelNameSnapshot;
    const grade =
      reference?.grade ?? (index === 0 ? refs.hotelGrade : undefined);
    const website =
      reference?.website ?? (index === 0 ? refs.hotelWebsite : undefined);
    return `<section class="hotel-stay" data-stay="${index + 1}">${index === 0 ? heading(5, 'HOTEL INFORMATION', title) : `<h3>${e(title)}</h3>`}<table><thead><tr><th style="width:30%">نام هتل</th><th>شهر</th><th>درجه</th><th>خدمات</th><th>ورود</th><th>خروج</th>${mixed ? '' : '<th>نوع اتاق</th>'}</tr></thead><tbody><tr><td><bdi>${e(hotelName)}</bdi><small><bdi>${e(website ?? 'وب‌سایت ثبت نشده')}</bdi></small></td><td><bdi dir="ltr">${e(city)}</bdi></td><td>${e(grade)}</td><td>${e(name(hotel?.mealServiceId))}</td><td class="stay-date-cell"><bdi class="stay-date" dir="ltr">${e(stayDate(stay.checkInDate))}</bdi></td><td class="stay-date-cell"><bdi class="stay-date" dir="ltr">${e(stayDate(stay.checkOutDate))}</bdi></td>${mixed ? '' : `<td class="room-type"><bdi>${e(rooms[0]?.roomTypeNameSnapshot ?? room)}</bdi></td>`}</tr></tbody></table><div class="hotel-room-summary"><span>تعداد اتاق‌ها: <b>${e(summary.roomCount)}</b></span><span>مجموع مهمانان هتل: <b>${e(summary.occupancy)}</b></span></div><table class="hotel-rooms"><thead><tr><th>اتاق</th><th>شهر</th><th>نوع و دسته‌بندی اتاق</th><th>بزرگسال</th><th>سن کودکان</th><th>تعداد نفرات اتاق</th></tr></thead><tbody>${rooms.length ? rooms.map((r) => `<tr><td>${e(r.ordinal)}</td><td><bdi dir="ltr">${e(city)}</bdi></td><td class="room-type"><bdi>${e(salesRoomDisplayName(r))}</bdi></td><td>${e(r.adults)}</td><td>${e(r.childAges.join(', ') || '—')}</td><td>${e(r.adults + r.childAges.length)}</td></tr>`).join('') : `<tr><td colspan="6">${e(room)}</td></tr>`}</tbody></table></section>`;
  };
  const totalPrices = readPassengerTotalPrices(
    c.servicesDetail,
    c.passengersDetail,
  );
  // Saved package totals/passenger sale prices supersede obsolete service splits.
  // Historical whole-contract bookings may retain empty hotel/flight maps.
  const contractPackagePricing =
    c.servicesDetail.length > 0 &&
    c.servicesDetail.every(
      (s) => s.metadata?.contractPackagePricingVersion === 1,
    );
  const servicePriceFallback =
    !totalPrices && !completePrices && !contractPackagePricing;
  const flightPrices = servicePriceFallback
    ? readPassengerFlightPrices(c.servicesDetail)
    : undefined;
  const hotelPrices = servicePriceFallback
    ? readPassengerHotelPrices(c.servicesDetail, c.passengersDetail)
    : undefined;
  // Owner-approved display allocation for historical whole-contract totals.
  // Explicit passenger prices always retain their saved allocation.
  const firstPassengerTotals =
    contractPackagePricing &&
    !totalPrices &&
    c.passengersDetail.every((p) => !p.agreedPrices?.length)
      ? c.balances.map(({ currencyCode, amount }) => ({ currencyCode, amount }))
      : null;
  const passengerAgeLabel = (p: (typeof c.passengersDetail)[number]) => {
    if (p.ageCategory !== 'CHD')
      return p.ageCategory === 'INF' ? 'نوزاد' : 'بزرگسال';
    if (p.childAgeBand === 'AGE_2_6') return 'کودک (2-6)';
    if (p.childAgeBand === 'AGE_6_12') return 'کودک (6-12)';
    const age = hotelAgeOn(
      p.birthDate,
      c.hotelSelection?.checkInDate || c.departureDate,
    );
    if (age === null || age === undefined) return 'کودک';
    return age < 6 ? 'کودک (2-6)' : age < 12 ? 'کودک (6-12)' : 'کودک (12-18)';
  };
  const passengerAgeHtml = (p: (typeof c.passengersDetail)[number]) =>
    e(passengerAgeLabel(p)).replace(
      /\((\d+-\d+)\)/,
      '(<bdi dir="ltr">$1</bdi>)',
    );
  const rows = c.passengersDetail
    .map((p, i) => {
      const ageLabel = passengerAgeHtml(p);
      const deductionCell = (kind: 'discount' | 'commission') => {
        const price = deductions[p.customerId]?.[kind];
        return price
          ? '<bdi class="money">' +
              contractMoney(price.amount) +
              ' ' +
              contractCurrency(price.currencyCode) +
              '</bdi>'
          : '—';
      };
      const prices =
        totalPrices?.[p.customerId] ??
        (p.agreedPrices?.length
          ? p.agreedPrices
          : [
              ...(flightPrices?.[p.customerId] ?? []),
              ...(hotelPrices?.[p.customerId] ?? []),
              ...(firstPassengerTotals?.map((price) => ({
                ...price,
                amount: i === 0 ? price.amount : '0',
              })) ?? []),
            ]);
      const renderPrices = (foreign: boolean) =>
        prices
          .filter((price) =>
            foreign
              ? price.currencyCode !== 'IRR'
              : price.currencyCode === 'IRR',
          )
          .map(
            (price) =>
              '<div><bdi class="money">' +
              contractMoney(price.amount) +
              ' ' +
              contractCurrency(price.currencyCode) +
              '</bdi></div>',
          )
          .join('');
      return `<tr><td>${i + 1}</td><td class="passenger-name"><bdi>${e(p.displayNameSnapshot)}</bdi></td><td>${ageLabel}</td><td class="contract-total">${renderPrices(false) || '—'}</td><td>${renderPrices(true)}</td>${showDiscount ? '<td>' + deductionCell('discount') + '</td>' : ''}${showCommission ? '<td>' + (deductions[p.customerId]?.commission ? deductionCell('commission') : p.ageCategory !== 'INF' && commission ? contractMoney(p.ageCategory === 'ADT' ? commission.adult : commission.child) : '—') + '</td>' : ''}<td>—</td></tr>`;
    })
    .join('');
  const contractFlights = salesContractFlights(
    c.servicesDetail,
    c.ticketSelections,
  );
  const serviceDirection = (service: (typeof c.servicesDetail)[number]) =>
    service.metadata?.direction ??
    contractFlights.find(
      (flight) => flight.serviceClientKey === service.clientKey,
    )?.direction ??
    (/(?:^|[-_])(?:out|outbound)$/.test(service.clientKey)
      ? 'OUTBOUND'
      : /(?:^|[-_])(?:return|back|in)$/.test(service.clientKey)
        ? 'RETURN'
        : undefined);
  const stayDate = (value: string) =>
    refs.international
      ? new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Tehran',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(value))
      : date(value);
  const serviceRows = c.passengersDetail
    .map((p, i) => {
      const allocated = c.servicesDetail.filter((service) =>
        p.serviceClientKeys.includes(service.clientKey),
      );
      const hasLeg = (
        kind: 'FLIGHT' | 'TRANSFER',
        direction: 'OUTBOUND' | 'RETURN',
      ) =>
        allocated.some(
          (service) =>
            service.kind === kind && serviceDirection(service) === direction,
        );
      const mark = (selected: boolean) =>
        selected
          ? '<span class="service-selected" aria-label="دارد">✓</span>'
          : '<span class="service-empty">—</span>';
      const hotelGuest =
        hotel && p.serviceClientKeys.includes(hotel.serviceClientKey);
      const stay = hotelGuest ? (guestStays?.[p.customerId] ?? hotel) : null;
      const differentStay = Boolean(
        stay &&
        hotel &&
        (stay.checkInDate !== hotel.checkInDate ||
          stay.checkOutDate !== hotel.checkOutDate),
      );
      const stayCellClass =
        ' class="stay-date-cell' +
        (differentStay ? ' different-stay' : '') +
        '"';
      const other = [
        ...new Set(
          allocated
            .filter(
              (service) =>
                !['FLIGHT', 'HOTEL', 'TRANSFER'].includes(service.kind) ||
                (service.kind === 'TRANSFER' && !serviceDirection(service)),
            )
            .map((service) =>
              ['OTHER', 'TRANSFER'].includes(service.kind)
                ? service.titleSnapshot
                : kind(service.kind),
            ),
        ),
      ];
      return `<tr><td>${i + 1}</td><td class="passenger-name"><bdi>${e(p.displayNameSnapshot)}</bdi></td><td>${passengerAgeHtml(p)}</td><td>${mark(hasLeg('FLIGHT', 'OUTBOUND'))}</td><td>${mark(hasLeg('FLIGHT', 'RETURN'))}</td><td${stayCellClass}>${stay ? '<bdi class="stay-date" dir="ltr">' + e(stayDate(stay.checkInDate)) + '</bdi>' : '—'}</td><td${stayCellClass}>${stay ? '<bdi class="stay-date" dir="ltr">' + e(stayDate(stay.checkOutDate)) + '</bdi>' : '—'}</td><td>${mark(hasLeg('TRANSFER', 'OUTBOUND'))}</td><td>${mark(hasLeg('TRANSFER', 'RETURN'))}</td><td>${e(other.join('، ') || '—')}</td></tr>`;
    })
    .join('');
  const flights = salesContractFlights(c.servicesDetail, c.ticketSelections)
    .map((t) => {
      const business =
        c.servicesDetail.find((s) => s.clientKey === t.serviceClientKey)
          ?.metadata?.businessOutput === true;
      const facts = t.offerId ? refs.flightFacts?.[t.offerId] : undefined;
      const endpoint = (
        airport: TicketDocumentFacts['originAirport'],
        id: string,
      ) =>
        airport
          ? `${airport.cityName || airport.name} (${airport.code})`
          : name(id);
      return `<tr><td class="flight-route"><bdi dir="ltr"><bdi>${e(endpoint(facts?.originAirport, t.originId))}</bdi> → <bdi>${e(endpoint(facts?.destinationAirport, t.destinationId))}</bdi></bdi><small>${t.direction === 'RETURN' ? 'برگشت' : 'رفت'}${t.source === 'CONTRACT_ONLY' ? ' · شناور، نیازمند تأیید رزرو' : ''}</small></td><td>${e(t.carrierNameSnapshot)}</td><td><bdi>${e(t.serviceNumberSnapshot)}</bdi></td><td>${e(travelDate(t.departureAt))}</td><td>${e(time(t.departureAt))}</td><td>${e(business ? 'BUSINESS' : t.cabinClassCode)}</td></tr>`;
    })
    .join('');
  const issuerName =
    output.company.code === 'JAHAN_BASTAN'
      ? 'جهان باستان'
      : output.company.persianName;
  const niyayeshIssuer = output.company.code === 'NIYAYESH_SEIR_SAHAR';
  const contactIcon = (path: string) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
  const websiteIcon = contactIcon(
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',
  );
  const phoneIcon = contactIcon(
    '<path d="M5 3h4l2 5-3 2c1 3 3 5 6 6l2-3 5 2v4c0 2-2 2-4 2C9 20 4 15 3 7c0-2 0-4 2-4Z"/>',
  );
  const emailIcon = contactIcon(
    '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 6 9 7 9-7"/>',
  );
  const logo =
    refs.logoDataUrl &&
    /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(refs.logoDataUrl)
      ? `<img alt="" src="${refs.logoDataUrl}">`
      : '';
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:"><title>قرارداد ${e(c.contractNumber)}</title><style>
  @font-face{font-family:ContractNazanin;src:local('B Nazanin'),local('BNazanin');font-weight:normal}
  @page{size:A4 portrait;margin:7mm 7mm 12mm;@bottom-center{content:counter(page) " / " counter(pages);direction:ltr;unicode-bidi:isolate;font-family:Arial,sans-serif;font-size:8pt;color:#596781}}
  *{box-sizing:border-box}body{margin:0;background:white;color:#102d54;font-family:ContractNazanin,serif;font-size:10.5pt;line-height:1.2}
  .document{padding:0;border:0;background:white}
  header{display:flex;align-items:center;justify-content:space-between;gap:4mm;background:#10386b;background:linear-gradient(115deg,#10386b,#092b56);color:white;border-bottom:1mm solid #15999e;padding:4mm 5mm;min-height:27mm}
  header .title{order:-1;flex:1;text-align:right}header h1{margin:0;font-family:ContractNazanin,serif;font-size:25pt;line-height:1.2;white-space:nowrap}
  header .subtitle{display:flex;align-items:center;gap:2mm;margin:1mm 0 0;font-family:Arial,sans-serif;font-size:8pt;letter-spacing:2.2px;white-space:nowrap}
  header .subtitle:before,header .subtitle:after{content:"";height:1px;background:#38aeb1;flex:1;min-width:6mm}
  header .brand{width:54mm;flex-shrink:0;text-align:center;font-size:10.5pt}
  header img{display:block;max-width:52mm;max-height:17mm;margin:0 auto 1mm;object-fit:contain;filter:brightness(0) invert(1)}
  header .brand small{color:white}header .jahan-brand{background:transparent;color:white;padding:0}header .jahan-brand small{color:white}header .jahan-brand img{filter:brightness(0) invert(1)}
  .meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:#eaf0f4;padding:2mm 0;margin-bottom:2mm}
  .meta>div{text-align:center;border-left:1px solid #aebccc;font-size:10pt}.meta>div:last-child{border-left:0}.meta strong{display:block;font-size:11pt;margin-top:.4mm}
  small{display:block;font-size:8pt;color:#59708b;font-weight:normal;margin-top:.5mm}
  section{margin-top:1.5mm;break-inside:avoid;border:1px solid #b8c7d8;padding:0 1.3mm 1.2mm}
  h2{display:flex;direction:ltr;align-items:center;gap:2mm;background:white;border-bottom:1px solid #b8c7d8;margin:-1px -1.3mm 1.2mm;font-size:11pt;min-height:7mm}
  h2 em{background:#10386b;color:white;font-family:Arial,sans-serif;font-style:normal;font-weight:bold;font-size:13pt;padding:1mm 1.6mm;min-width:9mm;text-align:center;align-self:stretch;display:flex;align-items:center;justify-content:center}
  h2 span{font-family:Arial,sans-serif;font-size:9pt;color:#385574}h2 small{direction:rtl;margin:0 0 0 auto;padding-right:1mm;font-size:15pt;font-weight:bold;color:#102d54}
  .fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.3mm 0;background:#f8fafc}.fields>div{min-width:0}.fields>.wide{grid-column:1 / -1}.fields>div{border-bottom:1px solid #dfe6ee;padding:.4mm 1mm;overflow-wrap:anywhere}
  table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10pt}thead{display:table-header-group}th{background:#dce6ee;color:#15375c;border-color:white;font-weight:bold}td,th{border:1px solid #cdd7e1;padding:1mm .7mm;text-align:center;overflow-wrap:anywhere}
  tr{break-inside:avoid;page-break-inside:avoid}td:first-child{white-space:normal}
  .passengers{break-inside:auto}.passengers h2{break-after:avoid}.passengers th{font-size:9.5pt}.passengers td{padding:.8mm .6mm}
  .passenger-services{margin-top:1.5mm}.passenger-services th{background:#e6f1f2;color:#123c4e}.passenger-prices{margin-top:1.5mm}.passenger-prices th{background:#dce6ee}.passengers tbody tr:nth-child(even){background:#f6f9fc}.passenger-name{text-align:center}.service-selected{color:#126a57;font-family:Arial,sans-serif;font-weight:bold}.service-empty{color:#8392a3}.passenger-services td{font-size:9pt}.passengers .passenger-name,.room-type{font-size:8.5pt;font-weight:400;line-height:1.25}.passenger-name bdi,.room-type bdi{font-family:"Segoe UI",Tahoma,sans-serif;font-size:8.5pt;font-weight:400}
  .passenger-services td:nth-child(3),.passenger-prices td:nth-child(3){white-space:nowrap;font-size:8pt}.stay-date-cell{text-align:left;direction:ltr}.stay-date{display:inline-block;direction:ltr;unicode-bidi:isolate;white-space:nowrap;font-family:"Segoe UI",Tahoma,sans-serif;font-size:8.5pt}.passenger-services td.different-stay{background:#c7c7c7;color:#111;font-weight:bold;border:1.5px solid #555}
  .money,.summary-value bdi{font-family:Arial,sans-serif!important;direction:ltr;font-size:10pt;font-variant-numeric:tabular-nums}
  .currency-symbol{display:inline-block;font-family:Tahoma,"Segoe UI",sans-serif!important;font-weight:400;unicode-bidi:isolate}
  .passengers .money{font-size:9pt;overflow-wrap:anywhere}
  bdi{unicode-bidi:isolate}strong{font-weight:bold}.ltr{direction:ltr}
  .financial-summary{break-inside:avoid}.note{font-size:8.5pt;color:#536b85;margin:1mm 0}
  .summary-grid{display:grid;grid-template-columns:minmax(0,1fr);margin-top:1.5mm}
  .summary-card{display:flex;align-items:center;gap:3mm;padding:1.2mm 2mm;border:1px solid #b8c7d8;border-radius:1mm;background:white;color:#102d54;min-width:0}
  .summary-card> b{margin:0;font-size:10.5pt;font-weight:bold;white-space:nowrap}.summary-value{display:flex;flex-wrap:wrap;align-items:center;gap:1mm 2mm;flex:1;min-width:0}.agreement-amount{display:inline-flex;align-items:baseline;gap:1.5mm;direction:ltr;padding:.7mm 2mm;background:#f4f7fb;border-radius:.7mm;max-width:100%}.agreement-currency{font-size:10pt;direction:rtl;white-space:nowrap}.summary-value bdi{font-weight:bold;font-size:10.5pt;overflow-wrap:anywhere}
  .signatures{display:grid;grid-template-columns:1fr 1fr;gap:3mm;text-align:center;min-height:13mm}
  .signatures>div{border:1px solid #b8c7d8;padding:1.2mm}.signature-line{display:block;margin-top:3mm}
  .customer-terms{font-size:8.5pt;line-height:1.35;text-align:right;border-top:1px solid #486582;padding-top:1mm;margin-top:1.5mm;color:#24415f;break-inside:avoid}.customer-terms p{margin:.3mm 0}
  footer{border-top:.5mm solid #244f7e;margin-top:1.5mm;padding-top:1.5mm;color:#102d54;break-inside:avoid;display:flex;direction:rtl;align-items:center;justify-content:space-between;gap:4mm}
  .footer-qr{flex:0 0 49mm;text-align:right}.footer-qr svg{display:block;width:20mm;height:20mm;margin-left:auto}.footer-qr small{font-size:7.5pt;line-height:1.1;margin-top:0}
  .footer-contact{direction:ltr;text-align:left;font-size:10pt;min-width:62mm}.footer-contact strong{display:block;direction:rtl;text-align:left;font-size:13pt;margin-bottom:.7mm}
  .contact-row{display:flex;align-items:center;gap:2mm;margin:.4mm 0}.contact-row svg{width:3.5mm;height:3.5mm;fill:none;stroke:currentColor;stroke-width:1.7;flex-shrink:0}.contact-row bdi{font-family:Arial,sans-serif;font-size:9pt}
  .cancelled{padding:2mm;margin:2mm 0;border:2px solid #a02020;color:#a02020;text-align:center;font-weight:bold}
  @media screen{.contract-closing{order:1}body{background:#edf1f8;padding:12px}.document{max-width:794px;min-width:650px;margin:auto;box-shadow:0 4px 20px #0001}}
  @media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}a{color:inherit;text-decoration:none}}
  /* Compact rows with repeating table headers for larger groups. */
  body{font-size:9.5pt;line-height:1.05}header{min-height:18mm;padding:2mm 4mm}header img{max-height:12mm;max-width:45mm}header h1{font-size:25pt}header .brand{font-size:9pt}
  .meta{padding:1mm 0;margin-bottom:1mm}.meta strong{font-size:10pt}
  section{margin-top:.8mm;padding-bottom:.6mm}h2{min-height:5.5mm;margin-bottom:.7mm}h2 em{font-size:12pt;padding:.6mm 1.6mm}h2 small{font-size:14pt}
  table{font-size:9.5pt}td,th{padding:.4mm}.passengers td{padding:.3mm}.fields>div{padding:.05mm 1mm}
  .summary-card b{margin:0}.summary-value bdi{font-size:10.5pt}
  .signatures{min-height:10mm}.signatures>div{padding:.7mm}.signature-line{margin-top:1.5mm}
  .customer-terms{line-height:1.2;margin-top:1mm;padding-top:.6mm}footer{padding-top:1mm;margin-top:1mm}.contact-row{margin:.2mm 0}.footer-contact strong{font-size:11pt}
  .hotel-room-summary{display:flex;gap:8mm;align-items:center;margin:1mm 0;padding:.6mm 1.5mm;background:#f4f8fc;border:1px solid #dce6ee;font-size:9pt}.hotel-rooms th{background:#e6f1f2}
  .flight-route{font-size:8pt;line-height:1.15;overflow-wrap:anywhere}.contract-closing{break-inside:avoid;page-break-inside:avoid}.footer-qr svg{width:18mm;height:18mm}
  .document-pages{table-layout:fixed;font-size:inherit}.document-content,.document-footer{border:0;padding:0;text-align:inherit}.document-pages>tbody>tr{break-inside:auto;page-break-inside:auto}.document-pages>tfoot{display:table-footer-group}.document-footer{padding-top:3mm}.contract-closing{background:#fff}
  .contract-notice{break-inside:avoid;margin-top:1.5mm;padding:1mm 2mm;background:#f8fafc;border-right:1mm solid #15999e;text-align:right;font-size:8.5pt}
  .contract-notice h3{margin:0 0 .5mm;font-size:9pt;break-after:avoid}.contract-notice h3 span{font-family:Arial,sans-serif;font-size:8pt;margin-right:2mm;color:#536b85}
  .contract-notice p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.3;orphans:2;widows:2}
</style></head><body><article class="document"><table class="document-pages"><tbody><tr><td class="document-content">

  <header><div class="brand${output.company.code === 'JAHAN_BASTAN' ? ' jahan-brand' : ''}">${logo}<div>${e(issuerName)}</div><small>${e(output.company.code === 'JAHAN_BASTAN' ? 'JAHAN BASTAN' : (output.company.latinName ?? ''))}</small></div><div class="title"><h1>قرارداد فروش خدمات مسافرتی</h1><p class="subtitle" dir="ltr">TRAVEL SERVICES CONTRACT</p></div></header>
  ${c.status === 'CANCELLED' ? '<div class="cancelled">این قرارداد لغو شده است</div>' : ''}
  ${options.draft ? '<p class="note"><b>پیش‌نمایش قرارداد — هنوز ثبت و به رزرواسیون ارسال نشده است.</b></p>' : ''}
  <div class="meta"><div>شماره قرارداد<strong><bdi>${e(c.contractNumber)}</bdi></strong></div><div>${options.draft ? 'تاریخ پیش‌نمایش' : 'تاریخ ثبت'}<strong>${e(date(c.createdAt))}</strong></div><div>ساعت<strong>${e(time(c.createdAt))}</strong></div><div>مسئول فروش<strong>${e(output.ownerName)}</strong></div></div>
  <section>${heading(1, 'CONTRACT PARTIES', 'طرفین قرارداد')}<div class="fields"><div>دفتر خریدار / مشتری: <b>${e(contractPartyName)}</b></div><div>شماره مشتری: <bdi>${e(output.customer.phone)}</bdi></div><div>تلفن ثابت: <bdi>${e(output.customer.landline || '—')}</bdi></div><div>نشانی: ${e(output.customer.address)}</div><div>کد پستی: <bdi>${e(output.customer.postalCode)}</bdi></div><div>مقصد: ${e(name(c.destinationId))}</div><div>تعداد: ${partyCount} نفر</div><div>درخواست‌کننده: ${e(contractPartyName)}</div><div class="wide">خدمات: ${e(c.services.map(kind).join('، '))}</div></div></section>
${
  legacyParties
    ? `<section><table><thead><tr><th>خدمت</th><th>بزرگسال</th><th>کودک</th><th>نوزاد</th></tr></thead><tbody>${c.servicesDetail
        .map((service) => {
          const p = legacyParties[service.clientKey]!;
          return `<tr><td>${e(service.titleSnapshot)}</td><td>${p.adults}</td><td>${p.children}</td><td>${p.infants}</td></tr>`;
        })
        .join('')}</tbody></table></section>`
    : `<section class="passengers passenger-services">${heading(2, 'PASSENGER SERVICES', 'خدمات هر مسافر')}<table><colgroup><col width="4%"><col width="19%"><col width="10%"><col width="6%"><col width="6%"><col width="12%"><col width="12%"><col width="7%"><col width="7%"><col width="17%"></colgroup><thead><tr><th>ردیف</th><th>نام مسافر</th><th>رده سنی</th><th>بلیط رفت</th><th>بلیط برگشت</th><th>ورود هتل</th><th>خروج هتل</th><th>ترانسفر رفت</th><th>ترانسفر برگشت</th><th>سایر خدمات</th></tr></thead><tbody>${serviceRows}</tbody></table></section>
<section class="passengers passenger-prices">${heading(3, 'PASSENGERS & PRICING', 'قیمت هر مسافر')}<table><colgroup>${passengerColumns}</colgroup><thead><tr><th>ردیف</th><th>نام مسافر</th><th>رده سنی</th><th>قیمت ریالی</th><th>قیمت ارزی</th>${showDiscount ? '<th>تخفیف</th>' : ''}${showCommission ? '<th>کمیسیون</th>' : ''}<th>توضیحات</th></tr></thead><tbody>${rows}</tbody></table><div class="financial-summary"><div class="summary-grid"><div class="summary-card"><b>قیمت توافق‌شده قرارداد</b><div class="summary-value">${c.paymentTerms?.mode === 'CHECK' || c.servicesDetail.some((s) => s.metadata?.automaticFlightRoomTotalV1 === true) ? moneyRows('amount') : (agreementTotal ?? moneyRows('amount'))}</div></div></div>${chequeTerms}</div></section>
  `
}
<section>${heading(4, 'FLIGHT INFORMATION', 'اطلاعات پرواز')}<table><thead><tr><th>مسیر</th><th>ایرلاین</th><th>شماره</th><th>تاریخ</th><th>ساعت</th><th>کلاس</th></tr></thead><tbody>${flights || '<tr><td colspan="6">پرواز در این قرارداد انتخاب نشده است.</td></tr>'}</tbody></table></section>
  ${hotel ? [hotel, ...(hotel.additionalStays ?? [])].map(hotelSection).join('') : '<section>هتل در این قرارداد انتخاب نشده است.</section>'}
  ${contractNotice ? `<section class="contract-notice"><h3>یادداشت قرارداد <span dir="ltr">NOTICE</span></h3><p>${e(contractNotice)}</p></section>` : ''}
</td></tr></tbody><tfoot><tr><td class="document-footer">  <div class="contract-closing"><section>${heading(6, 'APPROVAL & SIGNATURE', 'تأیید و امضا')}<div class="signatures"><div>نام و امضای مسافر / نماینده<span class="signature-line">....................................</span></div><div>نام و امضای مسئول فروش<span class="signature-line">....................................</span></div></div></section>
  <div class="customer-terms">
    <p>در صورت تأیید نشدن هتل درخواستی، هتل مشابه جایگزین می‌گردد.</p>
    <p>توجه داشته باشید این برگه بدون قبض رسید صندوق فاقد هرگونه اعتبار می‌باشد.</p>
    <p>با آگاهی از مفاد قراردادهای خارج از کشور که توسط سازمان میراث فرهنگی و گردشگری تهیه گردیده است، نسبت به ارسال درخواست به آژانس ${e(niyayeshIssuer ? 'نیایش سیر سحر' : issuerName)} اقدام نموده و ارسال درخواست به منزله قبول تمامی شرایط، مواد و تبصره‌های قرارداد فوق می‌باشد.</p>
  </div>
  <footer>${refs.publicDocumentUrl ? `<div class="footer-qr">${publicDocumentQr(refs.publicDocumentUrl) ?? ''}</div>` : contractPendingQrHtml()}<div class="footer-contact"><strong>${e(issuerName)}</strong>${niyayeshIssuer ? `<div class="contact-row">${websiteIcon}<bdi>Nystkt.ir</bdi></div>` : ''}${niyayeshIssuer ? `<div class="contact-row">${phoneIcon}<bdi>021-72075000</bdi></div><div class="contact-row">${emailIcon}<bdi>support@niyayeshseir.com</bdi></div>` : ''}</div></footer></div></td></tr></tfoot></table></article></body></html>`;
}
