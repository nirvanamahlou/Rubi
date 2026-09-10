import {
  voucherTextKeys,
  voucherNumberKeys,
  voucherFlagKeys,
  moneyDecimal,
  moneyUnits,
  salesContractFlights,
  type SalesContractOutputV1,
  type VoucherSettingsV1,
} from '@rubi/contracts';
import { contractPendingQrHtml } from './contract-pending-qr';
const amendmentLabels: Record<string, string> = {
  country: 'کشور',
  city: 'شهر',
  hotel: 'نام هتل (انگلیسی)',
  stars: 'درجه هتل',
  meal: 'سرویس هتل',
  roomType: 'نوع اتاق',
  checkIn: 'ورود',
  checkOut: 'خروج',
  website: 'وب‌سایت هتل',
  stayNotes: 'توضیح اقامت',
  broker: 'کارگزار',
  leaderLanguage: 'زبان راهنما',
  leaderName: 'نام راهنما',
  leaderPhone: 'تلفن راهنما',
  transferBoard: 'تابلوی ترانسفر',
  transferPhone: 'تلفن ترانسفر',
  transferKind: 'نوع ترانسفر (RT / OW)',
  excursionDescription: 'گشت (لاتین)',
  extraServices: 'سایر خدمات',
  remarks: 'توضیحات برای کارگزار (لاتین)',
  arrivalAirline: 'ایرلاین ورود',
  arrivalFlight: 'شماره پرواز ورود',
  arrivalDate: 'تاریخ ورود پرواز',
  arrivalTime: 'ساعت ورود',
  departureAirline: 'ایرلاین خروج',
  departureFlight: 'شماره پرواز خروج',
  departureDate: 'تاریخ خروج پرواز',
  departureTime: 'ساعت خروج',
};

export interface ContractPrintReferences {
  names: Record<string, string>;
  hotelGrade?: string;
  hotelLatinName?: string;
  hotelWebsite?: string;
  logoDataUrl?: string;
}
export const contractOutputTemplateVersion = 'travel-services-v1';

/** Purchased room quantities, never inferred from passenger accommodation. */
export function contractRoomSummary(
  hotel: SalesContractOutputV1['contract']['hotelSelection'],
): string {
  if (!hotel) return 'ندارد';
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
    hour12: false,
  }).format(new Date(value));

export function contractPrintHtml(
  output: SalesContractOutputV1,
  refs: ContractPrintReferences,
): string {
  const c = output.contract,
    e = escapeContractText;
  const name = (id?: string | null) =>
    id ? (refs.names[id] ?? 'نام مرجع در دسترس نیست') : '—';
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
            `<div dir="rtl"><bdi>${contractMoney(moneyDecimal(amount))}</bdi> ${e(code === 'IRR' ? 'ریال' : code)}</div>`,
        )
        .join('')
    : null;
  const moneyRows = (field: 'amount' | 'confirmedPaid' | 'outstanding') =>
    c.balances
      .map(
        (b) =>
          `<div dir="rtl"><bdi>${contractMoney(b[field])}</bdi> ${e(b.currencyCode === 'IRR' ? 'ریال' : b.currencyCode)}</div>`,
      )
      .join('');
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
  const passengerColumns = (
    agency ? [5, 26, 8, 6, 22, 17, 8, 8] : [5, 28, 9, 6, 24, 18, 10]
  )
    .map((width) => `<col style="width:${width}%">`)
    .join('');
  let savedAmendment: { settings?: VoucherSettingsV1 } | undefined;
  try {
    const raw = c.servicesDetail
      .map((s) => s.metadata?.reservationFormAmendment)
      .find(Boolean);
    if (typeof raw === 'string')
      savedAmendment = JSON.parse(raw) as typeof savedAmendment;
  } catch {
    /* Legacy invalid metadata is not an amendment. */
  }
  const candidate = savedAmendment?.settings;
  const amended =
    candidate &&
    candidate.text &&
    candidate.numbers &&
    candidate.flags &&
    voucherTextKeys.every((k) => typeof candidate.text[k] === 'string') &&
    voucherNumberKeys.every((k) =>
      Number.isSafeInteger(candidate.numbers[k]),
    ) &&
    voucherFlagKeys.every((k) => typeof candidate.flags[k] === 'boolean')
      ? candidate
      : undefined;
  const hotel =
    amended && c.hotelSelection
      ? {
          ...c.hotelSelection,
          hotelNameSnapshot: amended.text.hotel,
          checkInDate: amended.text.checkIn,
          checkOutDate: amended.text.checkOut,
          roomCount:
            amended.numbers.singleRooms +
            amended.numbers.doubleRooms +
            amended.numbers.customRooms,
          singleRoomCount: amended.numbers.singleRooms,
          doubleRoomCount: amended.numbers.doubleRooms,
          extraBedCount: amended.numbers.extraBeds,
        }
      : c.hotelSelection;
  // Hotel room product is a Master Data reference, not a passenger bed/age category.
  const room = amended
    ? amended.text.roomType
    : hotel
      ? name(hotel.roomTypeId)
      : '—';
  const rows = c.passengersDetail
    .map((p, i) => {
      const allocated = c.servicesDetail.filter((s) =>
        p.serviceClientKeys.includes(s.clientKey),
      );
      const renderPrices = (foreign: boolean) =>
        (p.agreedPrices ?? [])
          .filter((price) => (price.currencyCode !== 'IRR') === foreign)
          .map(
            (price) =>
              '<div><bdi class="money">' +
              contractMoney(price.amount) +
              (foreign ? ' ' + e(price.currencyCode) : '') +
              '</bdi></div>',
          )
          .join('');
      return `<tr><td>${i + 1}</td><td>${e(p.displayNameSnapshot)}</td><td>${{ ADT: 'بزرگسال', CHD: 'کودک', INF: 'نوزاد' }[p.ageCategory]}</td><td>${allocated.some((s) => s.kind === 'VISA') ? 'دارد' : '—'}</td><td class="contract-total">${p.agreedPrices?.length ? renderPrices(false) : 'ثبت نشده'}</td><td>${renderPrices(true)}</td>${agency ? '<td>ثبت نشده</td>' : ''}<td>—</td></tr>`;
    })
    .join('');
  const flights = salesContractFlights(c.servicesDetail, c.ticketSelections)
    .map((t) => {
      const business =
        c.servicesDetail.find((s) => s.clientKey === t.serviceClientKey)
          ?.metadata?.businessOutput === true;
      return `<tr><td>${e(name(t.originId))} ← ${e(name(t.destinationId))}<small>${t.direction === 'RETURN' ? 'برگشت' : 'رفت'}${t.source === 'CONTRACT_ONLY' ? ' · شناور، نیازمند تأیید رزرو' : ''}</small></td><td>${e(t.carrierNameSnapshot)}</td><td><bdi>${e(t.serviceNumberSnapshot)}</bdi></td><td>${e(date(t.departureAt))}</td><td>${e(time(t.departureAt))}</td><td>${e(business ? 'BUSINESS' : t.cabinClassCode)}</td></tr>`;
    })
    .join('');
  const transfers = c.servicesDetail
    .filter((s) => s.kind === 'TRANSFER')
    .map((s) => s.titleSnapshot)
    .join('، ');
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
  @page{size:A4 portrait;margin:7mm;@bottom-center{content:counter(page) " / " counter(pages);direction:ltr;unicode-bidi:isolate;font-family:Arial,sans-serif;font-size:8pt;color:#596781}}
  *{box-sizing:border-box}body{margin:0;background:white;color:#102d54;font-family:ContractNazanin,serif;font-size:10.5pt;line-height:1.2}
  .document{padding:0;border:0;background:white}
  header{display:flex;align-items:center;justify-content:space-between;gap:4mm;background:#10386b;background:linear-gradient(115deg,#10386b,#092b56);color:white;border-bottom:1mm solid #15999e;padding:4mm 5mm;min-height:27mm}
  header .title{order:-1;flex:1;text-align:right}header h1{margin:0;font-family:ContractNazanin,serif;font-size:25pt;line-height:1.2;white-space:nowrap}
  header .subtitle{display:flex;align-items:center;gap:2mm;margin:1mm 0 0;font-family:Arial,sans-serif;font-size:8pt;letter-spacing:2.2px;white-space:nowrap}
  header .subtitle:before,header .subtitle:after{content:"";height:1px;background:#38aeb1;flex:1;min-width:6mm}
  header .brand{width:54mm;flex-shrink:0;text-align:center;font-size:10.5pt}
  header img{display:block;max-width:52mm;max-height:17mm;margin:0 auto 1mm;object-fit:contain;filter:brightness(0) invert(1)}
  header .brand small{color:white}
  .meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:#eaf0f4;padding:2mm 0;margin-bottom:2mm}
  .meta>div{text-align:center;border-left:1px solid #aebccc;font-size:10pt}.meta>div:last-child{border-left:0}.meta strong{display:block;font-size:11pt;margin-top:.4mm}
  small{display:block;font-size:8pt;color:#59708b;font-weight:normal;margin-top:.5mm}
  section{margin-top:1.5mm;break-inside:avoid;border:1px solid #b8c7d8;padding:0 1.3mm 1.2mm}
  h2{display:flex;direction:ltr;align-items:center;gap:2mm;background:white;border-bottom:1px solid #b8c7d8;margin:-1px -1.3mm 1.2mm;font-size:11pt;min-height:7mm}
  h2 em{background:#10386b;color:white;font-family:Arial,sans-serif;font-style:normal;font-weight:bold;font-size:13pt;padding:1mm 1.6mm;min-width:9mm;text-align:center;align-self:stretch;display:flex;align-items:center;justify-content:center}
  h2 span{font-family:Arial,sans-serif;font-size:9pt;color:#385574}h2 small{direction:rtl;margin:0 0 0 auto;padding-right:1mm;font-size:15pt;font-weight:bold;color:#102d54}
  .fields{display:grid;grid-template-columns:1fr 1fr;gap:.3mm 3mm;background:#f8fafc}.fields>div{border-bottom:1px solid #dfe6ee;padding:.4mm 1mm;overflow-wrap:anywhere}.wide{grid-column:1/-1}
  table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10pt}thead{display:table-header-group}th{background:#dce6ee;color:#15375c;border-color:white;font-weight:bold}td,th{border:1px solid #cdd7e1;padding:1mm .7mm;text-align:center;overflow-wrap:anywhere}
  tr{break-inside:avoid;page-break-inside:avoid}td:first-child{white-space:normal}
  .passengers{break-inside:auto}.passengers h2{break-after:avoid}.passengers th{font-size:9.5pt}.passengers td{padding:.8mm .6mm}
  .money,.summary-value bdi{font-family:Arial,sans-serif!important;direction:ltr;font-size:10pt;font-variant-numeric:tabular-nums}
  .passengers .money{font-size:9pt;overflow-wrap:anywhere}
  bdi{unicode-bidi:isolate}strong{font-weight:bold}.ltr{direction:ltr}
  .financial-summary{break-inside:avoid}.note{font-size:8.5pt;color:#536b85;margin:1mm 0}
  .summary-grid{display:grid;grid-template-columns:minmax(0,1fr);background:#eaf0f4;margin-top:1.2mm}
  .summary-card{padding:1.2mm 2mm;text-align:center;border-left:1px solid #bbc9d7;min-width:0}.summary-card:last-child{border:0;background:#0a2c57;color:white}
  .summary-card b{display:block;font-size:10pt;font-weight:normal;margin-bottom:.8mm}.summary-value>div{display:block;white-space:normal}.summary-value bdi{font-weight:bold;font-size:12pt}
  .signatures{display:grid;grid-template-columns:1fr 1fr;gap:3mm;text-align:center;min-height:13mm}
  .signatures>div{border:1px solid #b8c7d8;padding:1.2mm}.signature-line{display:block;margin-top:3mm}
  .customer-terms{font-size:8.5pt;line-height:1.35;text-align:right;border-top:1px solid #486582;padding-top:1mm;margin-top:1.5mm;color:#24415f;break-inside:avoid}.customer-terms p{margin:.3mm 0}
  footer{border-top:.5mm solid #244f7e;margin-top:1.5mm;padding-top:1.5mm;color:#102d54;break-inside:avoid;display:flex;direction:rtl;align-items:center;justify-content:space-between;gap:4mm}
  .footer-qr{flex:0 0 49mm;text-align:right}.footer-qr svg{display:block;width:20mm;height:20mm;margin-left:auto}.footer-qr small{font-size:7.5pt;line-height:1.1;margin-top:0}
  .footer-contact{direction:ltr;text-align:left;font-size:10pt;min-width:62mm}.footer-contact strong{display:block;direction:rtl;text-align:left;font-size:13pt;margin-bottom:.7mm}
  .contact-row{display:flex;align-items:center;gap:2mm;margin:.4mm 0}.contact-row svg{width:3.5mm;height:3.5mm;fill:none;stroke:currentColor;stroke-width:1.7;flex-shrink:0}.contact-row bdi{font-family:Arial,sans-serif;font-size:9pt}
  .cancelled{padding:2mm;margin:2mm 0;border:2px solid #a02020;color:#a02020;text-align:center;font-weight:bold}
  @media screen{body{background:#edf1f8;padding:12px}.document{max-width:794px;min-width:650px;margin:auto;box-shadow:0 4px 20px #0001}}
  @media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}a{color:inherit;text-decoration:none}}
  /* Keep six passengers on A4 while retaining the reference hierarchy. */
  body{font-size:9.5pt;line-height:1.12}header{min-height:22mm;padding:2mm 4mm}header img{max-height:12mm;max-width:45mm}header h1{font-size:25pt}header .brand{font-size:9pt}
  .meta{padding:1mm 0;margin-bottom:1mm}.meta strong{font-size:10pt}
  section{margin-top:1mm;padding-bottom:.8mm}h2{min-height:5.5mm;margin-bottom:.7mm}h2 em{font-size:12pt;padding:.6mm 1.6mm}h2 small{font-size:14pt}
  table{font-size:9.5pt}td,th{padding:.6mm}.passengers td{padding:.55mm}.fields>div{padding:.15mm 1mm}
  .summary-card{padding:.8mm 1mm}.summary-card b{margin-bottom:.4mm}.summary-value bdi{font-size:10.5pt}
  .signatures{min-height:10mm}.signatures>div{padding:.7mm}.signature-line{margin-top:1.5mm}
  .customer-terms{line-height:1.2;margin-top:1mm;padding-top:.6mm}footer{padding-top:1mm;margin-top:1mm}.contact-row{margin:.2mm 0}.footer-contact strong{font-size:11pt}
  </style></head><body><article class="document">
  <header><div class="brand">${logo}<div>${e(output.company.persianName)}</div><small>${e(output.company.latinName ?? '')}</small></div><div class="title"><h1>قرارداد فروش خدمات مسافرتی</h1><p class="subtitle" dir="ltr">TRAVEL SERVICES CONTRACT</p></div></header>
  ${c.status === 'CANCELLED' ? '<div class="cancelled">این قرارداد لغو شده است</div>' : ''}
  <div class="meta"><div>شماره قرارداد<strong><bdi>${e(c.contractNumber)}</bdi></strong></div><div>تاریخ ثبت<strong>${e(date(c.createdAt))}</strong></div><div>ساعت<strong>${e(time(c.createdAt))}</strong></div><div>مسئول فروش<strong>${e(output.ownerName)}</strong></div></div>
  <section>${heading(1, 'CONTRACT PARTIES', 'طرفین قرارداد')}<div class="fields"><div>دفتر خریدار / مشتری: <b>${e(c.customerNameSnapshot)}</b></div><div>مدیر: —</div><div class="wide">نشانی: ${e(output.customer.address)}</div><div>مقصد: ${e(name(c.destinationId))}</div><div>تعداد: ${c.passengersDetail.length} نفر</div><div>درخواست‌کننده: ${e(c.customerNameSnapshot)}</div><div>خدمات: ${e(c.services.map(kind).join('، '))}</div></div></section>
<section class="passengers">${heading(2, 'PASSENGERS & PRICING', 'مسافران و قیمت')}<table><colgroup>${passengerColumns}</colgroup><thead><tr><th>ردیف</th><th>نام مسافر</th><th>رده سنی</th><th>ویزا</th><th>مبلغ فروش</th><th>ارز</th>${agency ? '<th>کمیسیون</th>' : ''}<th>توضیحات</th></tr></thead><tbody>${rows}</tbody></table><div class="financial-summary"><p class="note">${c.passengersDetail.every((p) => p.agreedPrices?.length) ? 'مبلغ فروش هر مسافر، کل خدمات توافق‌شده همان نفر است.' : 'برای ردیف‌های قدیمی قیمت تفکیکی مسافر ثبت نشده؛ مبلغ حدسی درج نمی‌شود.'}</p><div class="summary-grid"><div class="summary-card"><b>مبلغ توافق‌شده قرارداد</b><div class="summary-value">${agreementTotal ?? moneyRows('amount')}</div></div></div>${agency ? '<p class="note">کمیسیون آژانس در این قرارداد ثبت نشده؛ هیچ مبلغی بابت آن از جمع قرارداد کسر نشده است.</p>' : ''}</div></section>
  <section>${heading(3, 'FLIGHT INFORMATION', 'اطلاعات پرواز')}<table><thead><tr><th>مسیر</th><th>ایرلاین</th><th>شماره</th><th>تاریخ</th><th>ساعت</th><th>کلاس</th></tr></thead><tbody>${flights || '<tr><td colspan="6">پرواز در این قرارداد انتخاب نشده است.</td></tr>'}</tbody></table></section>
  <section>${heading(4, 'HOTEL INFORMATION', 'اطلاعات هتل')}${hotel ? `<table><thead><tr><th style="width:30%">نام هتل</th><th>درجه</th><th>خدمات</th><th>ورود</th><th>خروج</th><th>نوع اتاق</th></tr></thead><tbody><tr><td><bdi>${e(amended?.text.hotel ?? refs.hotelLatinName ?? 'ثبت نشده')}</bdi><small><bdi>${e(amended?.text.website ?? refs.hotelWebsite ?? 'وب‌سایت ثبت نشده')}</bdi></small></td><td>${e(amended?.text.stars ?? refs.hotelGrade)}</td><td>${e(amended?.text.meal ?? name(hotel.mealServiceId))}</td><td>${e(date(hotel.checkInDate))}</td><td>${e(date(hotel.checkOutDate))}</td><td>${e(room)}</td></tr></tbody></table><p class="note"><b>اتاق‌های قرارداد: ${e(contractRoomSummary(hotel))}</b></p>` : 'هتل در این قرارداد انتخاب نشده است.'}</section>
  ${
    amended
      ? `<section><h3>اصلاحات عملیاتی ثبت‌شده در قرارداد</h3><div class="fields">${Object.entries(
          amended.text,
        )
          .filter(([, value]) => value)
          .map(
            ([key, value]) =>
              `<div><bdi>${e(amendmentLabels[key] ?? key)}: ${e(value)}</bdi></div>`,
          )
          .join(
            '',
          )}</div><p>مبالغ و تعهدات مالی قرارداد با این اصلاح تغییر نکرده‌اند.</p></section>`
      : ''
  }
  <section>${heading(5, 'OTHER SERVICES', 'سایر خدمات')}<div class="fields"><div>ترانسفر: ${e(transfers || 'ندارد')}</div><div>گشت شهری: ${e(
    c.servicesDetail
      .filter((s) => s.kind === 'TOUR')
      .map((s) => s.titleSnapshot)
      .join('، ') || '—',
  )}</div><div>راهنما: —</div><div>وقت سفارت: —</div><div class="wide">سایر: ${e(
    c.servicesDetail
      .filter((s) =>
        ['OTHER', 'CIP', 'INSURANCE', 'BUS', 'TRAIN'].includes(s.kind),
      )
      .map((s) => s.titleSnapshot)
      .join('، ') || '—',
  )}</div></div></section>
  <section>${heading(6, 'APPROVAL & SIGNATURE', 'تأیید و امضا')}<div class="signatures"><div>نام و امضای مسافر / نماینده<span class="signature-line">....................................</span></div><div>نام و امضای مسئول فروش<span class="signature-line">....................................</span></div></div></section>
  <div class="customer-terms">
    <p>در صورت تأیید نشدن هتل درخواستی، هتل مشابه جایگزین می‌گردد.</p>
    <p>توجه داشته باشید این برگه بدون قبض رسید صندوق فاقد هرگونه اعتبار می‌باشد.</p>
    <p>با آگاهی از مفاد قراردادهای خارج از کشور که توسط سازمان میراث فرهنگی و گردشگری تهیه گردیده است، نسبت به ارسال درخواست به آژانس نیایش سیر سحر اقدام نموده و ارسال درخواست به منزله قبول تمامی شرایط، مواد و تبصره‌های قرارداد فوق می‌باشد.</p>
  </div>
  <footer>${contractPendingQrHtml()}<div class="footer-contact"><strong>${e(output.company.persianName)}</strong><div class="contact-row">${websiteIcon}<bdi>Nystkt.ir</bdi></div>${niyayeshIssuer ? `<div class="contact-row">${phoneIcon}<bdi>021-72075000</bdi></div><div class="contact-row">${emailIcon}<bdi>support@niyayeshseir.com</bdi></div>` : ''}</div></footer>
  </article></body></html>`;
}
