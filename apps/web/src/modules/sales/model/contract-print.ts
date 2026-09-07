import {
  moneyDecimal,
  moneyUnits,
  SALES_ACCOMMODATION_LABELS,
  type SalesContractOutputV1,
} from '@rubi/contracts';

export interface ContractPrintReferences {
  names: Record<string, string>;
  hotelGrade?: string;
  hotelLatinName?: string;
  hotelWebsite?: string;
  logoDataUrl?: string;
}
export const contractOutputTemplateVersion = 'travel-services-v1';

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
  new Intl.DateTimeFormat('fa-IR', {
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
    `<h2><em>${n}</em><span dir="ltr">${en}</span><small>${fa}</small></h2>`;
  const agency = output.customer.kind === 'organization';
  const passengerColumns = (
    agency ? [5, 20, 8, 5, 14, 18, 14, 8, 8] : [5, 22, 9, 5, 15, 20, 15, 9]
  )
    .map((width) => `<col style="width:${width}%">`)
    .join('');
  const hotel = c.hotelSelection;
  const room = hotel
    ? [
        ...new Set(
          c.passengersDetail
            .filter((p) => p.serviceClientKeys.includes(hotel.serviceClientKey))
            .map((p) =>
              p.accommodationKind
                ? SALES_ACCOMMODATION_LABELS[p.accommodationKind]
                : 'ثبت نشده',
            ),
        ),
      ].join('، ')
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
      const accommodation = p.accommodationKind
        ? SALES_ACCOMMODATION_LABELS[p.accommodationKind]
        : 'ثبت نشده';
      return `<tr><td>${i + 1}</td><td>${e(p.displayNameSnapshot)}</td><td>${{ ADT: 'بزرگسال', CHD: 'کودک', INF: 'نوزاد' }[p.ageCategory]}</td><td>${allocated.some((s) => s.kind === 'VISA') ? 'دارد' : '—'}</td><td>${allocated.some((s) => s.kind === 'HOTEL') ? e(accommodation) : '—'}</td><td class="contract-total">${p.agreedPrices?.length ? renderPrices(false) : 'ثبت نشده'}</td><td>${renderPrices(true)}</td>${agency ? '<td>ثبت نشده</td>' : ''}<td>—</td></tr>`;
    })
    .join('');
  const flights = c.ticketSelections
    .map((t) => {
      const business =
        c.servicesDetail.find((s) => s.clientKey === t.serviceClientKey)
          ?.metadata?.businessOutput === true;
      return `<tr><td>${e(name(t.originId))} ← ${e(name(t.destinationId))}<small>${t.direction === 'RETURN' ? 'برگشت' : 'رفت'}</small></td><td>${e(t.carrierNameSnapshot)}</td><td><bdi>${e(t.serviceNumberSnapshot)}</bdi></td><td>${e(date(t.departureAt))}</td><td>${e(time(t.departureAt))}</td><td>${e(business ? 'BUSINESS' : t.cabinClassCode)}</td></tr>`;
    })
    .join('');
  const transfers = c.servicesDetail
    .filter((s) => s.kind === 'TRANSFER')
    .map((s) => s.titleSnapshot)
    .join('، ');
  const logo =
    refs.logoDataUrl &&
    /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(refs.logoDataUrl)
      ? `<img alt="" src="${refs.logoDataUrl}">`
      : '';
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:"><title>قرارداد ${e(c.contractNumber)}</title><style>
  @font-face{font-family:ContractNazanin;src:local('B Nazanin'),local('BNazanin');font-weight:100 900}
  @page{size:A4 portrait;margin:9mm}
  *{box-sizing:border-box}body{margin:0;background:#fff;color:#082053;font-family:ContractNazanin,serif;font-size:11pt;line-height:1.2}
  .document{border:1.5px solid #102360;padding:4mm;border-radius:0 9mm 0 0;position:relative}
  header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #008c8c;padding-bottom:3mm;margin-bottom:4mm}
  header h1{font-family:Arial,sans-serif;font-size:23pt;margin:0;line-height:1.15;letter-spacing:.3px}header .brand{max-width:42%;text-align:center;font-size:15pt;font-weight:bold}
  header img{max-width:43mm;max-height:21mm;object-fit:contain}header p{margin:1mm 0;color:#008c8c}
  .meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2mm;margin-bottom:4mm}.meta>div{border-radius:3mm;background:#eef8f8;padding:2mm;text-align:center}
  small{display:block;font-size:9pt;font-weight:normal;color:#596781;margin-top:1mm}
  section{margin-top:4mm;border:1px solid #142864;border-radius:3mm;padding:0 2.5mm 2.5mm;break-inside:avoid}
  section.passengers{break-inside:auto}h2{display:flex;align-items:center;gap:2mm;margin:-1px -2.5mm 2mm;font-size:11pt;color:#fff;background:#07164b;border-radius:3mm 0 0 0;padding:1.3mm 2mm}
  h2 em{font-family:Arial,sans-serif;background:#008c8c;font-size:17pt;line-height:1;padding:1mm 2mm;border-radius:2mm;font-weight:bold}
  h2 span{font-family:Arial,sans-serif;font-size:10pt}h2 small{margin:0;margin-right:auto;color:#fff;font-size:11pt}
  .fields{display:grid;grid-template-columns:1fr 1fr;gap:1.7mm 4mm}.fields>div{border-bottom:1px dotted #bac4d4;padding-bottom:1mm;overflow-wrap:anywhere}.wide{grid-column:1/-1}
  table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11pt}thead{display:table-header-group}th{background:#008c8c;color:white;font-weight:bold}td,th{border:1px solid #ccd3df;padding:1.8mm 1mm;text-align:center;overflow-wrap:anywhere}tr{break-inside:avoid}td:first-child{white-space:normal}
  .contract-total{background:#f1f7fa}.totals{margin-top:2mm;padding:2mm;background:#07164b;color:white;display:flex;justify-content:space-between;gap:4mm;align-items:center}.totals bdi{font-family:ContractNazanin,serif}
  .note{font-size:10pt;margin:2mm 0 0;color:#55647e}.signatures{display:grid;grid-template-columns:1fr 1fr;text-align:center;gap:5mm;min-height:20mm;padding:2mm}
  footer{margin-top:4mm;padding:2mm 3mm;background:#07164b;color:white;text-align:center;font-size:10pt}
  bdi{unicode-bidi:isolate}strong{font-weight:bold}.ltr{direction:ltr}.financial{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-top:2mm}.financial div{font-size:11pt}
  @media screen{body{background:#edf1f8;padding:12px}.document{max-width:794px;min-width:650px;margin:auto;background:white;box-shadow:0 4px 20px #0001}}
  @media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}.document{border:1px solid #102360}a{color:inherit;text-decoration:none}}
  header{padding-bottom:2mm;margin-bottom:2mm}header h1{font-size:21pt}header img{max-height:17mm}header .brand{font-size:13pt}
  .meta{gap:1.5mm;margin-bottom:2mm}.meta>div{padding:1mm}.meta strong{display:block}
  section{margin-top:2.5mm;padding:0 2mm 2mm}h2{margin:-1px -2mm 1.3mm;padding:.8mm 1.5mm}h2 em{font-size:14pt;padding:.5mm 1.5mm}h2 span{font-size:9pt}h2 small{font-size:10pt}
  .fields{gap:.8mm 3mm}.fields>div{padding-bottom:.5mm}td,th{padding:1mm .8mm}table{font-size:10pt}small{font-size:8pt;margin-top:.5mm}
  .totals{margin-top:1mm;padding:1mm 2mm}.financial{gap:2mm;margin-top:1mm}.financial div{font-size:10pt}
  .note{font-size:9pt;margin:1mm 0 0}.signatures{min-height:13mm;padding:1mm}footer{margin-top:2mm;padding:1mm 2mm;font-size:9pt}
  .cancelled{padding:2mm;margin-bottom:2mm;border:2px solid #a02020;color:#a02020;text-align:center;font-weight:bold}
  body{font-size:10.5pt;line-height:1.12}header h1{font-size:18pt}header img{max-height:15mm}
  section{margin-top:2mm;padding-bottom:1.5mm}table{font-size:9.5pt}td,th{padding:.8mm}.fields{gap:.5mm 3mm}
  .totals>div>div,.financial>div>div{display:inline-block;margin-inline-start:3mm}.financial{padding-block:1mm}
  header{border-color:#173d7a}header p{color:#173d7a}.meta>div{background:#173d7a;color:#fff}
  th,h2 em{background:#173d7a}.contract-total{background:#fff}
  .money,.totals bdi,.financial bdi{font-family:Arial,sans-serif!important;direction:ltr;font-size:9.5pt;font-variant-numeric:tabular-nums}
  .customer-terms{font-size:8.5pt;line-height:1.35;text-align:right;margin-top:2mm;color:#082053;break-inside:avoid}.customer-terms p{margin:.6mm 0}
  .document{padding:3mm}section{margin-top:1mm}header img{max-height:13mm}.signatures{min-height:10mm}
  @page{margin:8mm;@bottom-center{content:counter(page) " / " counter(pages);direction:ltr;unicode-bidi:isolate;font-family:Arial,sans-serif;font-size:8pt;color:#596781}}
  .passengers .money{font-size:9pt;overflow-wrap:anywhere}
  .passengers th{font-size:9pt}.passengers td{padding:.7mm .6mm}
  .passengers h2{break-after:avoid}.passengers thead{display:table-header-group}
  .passengers tr{break-inside:avoid;page-break-inside:avoid}
  .financial-summary{break-inside:avoid}
  header .brand small{margin:0}header{padding-bottom:1mm;margin-bottom:1mm}
  header .brand{display:grid;grid-template-columns:auto auto;align-items:center;column-gap:2mm;font-size:11pt}
  header .brand img{grid-column:1;grid-row:1/3;max-width:28mm;max-height:13mm}header .brand>div,header .brand>small{grid-column:2}
  h2{padding:.5mm 1.5mm}h2 em{font-size:12pt;padding:.2mm 1.5mm}
  /* Reference theme only: preserve the existing document structure and field order. */
  .document{border:0;border-radius:0;padding:2mm;color:#102d54}
  header{background:#10386b;border-bottom:1mm solid #15999e;color:white;padding:3mm;margin:0;min-height:22mm}
  header h1{color:white;font-size:18pt;letter-spacing:.6px}header p{color:white;font-size:12pt;margin-top:1mm}
  header .brand{color:white}header .brand small{color:#e5edf5}header .brand img{background:white;padding:1mm;border-radius:1mm;max-height:16mm;max-width:30mm}
  .meta{gap:0;background:#eaf0f4;margin:0 0 2mm;padding:1.5mm 0;border-bottom:1px solid #cbd6e0}
  .meta>div{background:transparent;color:#15375c;border-radius:0;padding:.5mm 1mm;border-left:1px solid #bdcad7}.meta>div:last-child{border-left:0}
  .meta strong{font-size:11pt;margin-top:.5mm}
  section{border-color:#bac9d8;border-radius:0;margin-top:2mm;padding-bottom:1.5mm}
  h2{background:white;color:#173b65;border-radius:0;border-bottom:1px solid #bac9d8;padding:0 0 .5mm;margin:0 -2mm 1mm;gap:2mm;min-height:6mm}
  h2 em{background:#10386b;color:white;border-radius:0;font-style:normal;min-width:8mm;text-align:center;padding:1mm;font-size:11pt}
  h2 span{color:#385574;font-size:9pt}h2 small{color:#102d54;font-size:12pt;font-weight:bold;padding-inline-end:1mm}
  th{background:#dce6ee;color:#15375c;border-color:#edf2f6}td{border-color:#ced8e3;color:#102d54}.contract-total{background:#fff}
  .fields{background:#f8fafc}.fields>div{border-bottom:1px solid #e0e7ef;padding:.6mm 1mm}
  .totals{background:#10386b;color:white;padding:1.3mm 2mm;border-radius:.5mm}.totals b{font-size:11pt}
  .financial{background:#edf2f6;padding:1mm 2mm;color:#15375c}
  .signatures{gap:3mm;padding:0;min-height:12mm}.signatures>div{border:1px solid #bac9d8;padding:1mm;border-radius:.5mm}
  .customer-terms{border-top:1px solid #466785;padding-top:1mm;margin-top:2mm;color:#24415f}
  footer{background:white;color:#15375c;border-top:.5mm solid #244f7e;text-align:center;padding:1.5mm 0;margin-top:1.5mm;break-inside:avoid}
  @media print{.document{border:0}}
  @page{margin:6mm}
  .document{padding:1mm}
  header{padding:1.5mm 2mm;min-height:17mm}header h1{font-size:15pt}header p{font-size:10pt;margin:.5mm 0}header .brand img{max-height:13mm}
  .meta{padding:.5mm 0;margin-bottom:1mm}.meta strong{font-size:10pt}
  section{margin-top:.8mm;padding-bottom:1mm}h2{min-height:4mm;margin-bottom:.6mm;padding-bottom:0}h2 em{font-size:9pt;min-width:7mm;padding:.5mm 1mm}h2 small{font-size:11pt}
  .fields{gap:.3mm 3mm}.fields>div{padding:.15mm 1mm}.totals{padding:.7mm 2mm}.financial{padding:.5mm 2mm}
  .signatures{min-height:9mm}.signatures>div{padding:.5mm}.customer-terms{line-height:1.2;margin-top:1mm;padding-top:.5mm}
  </style></head><body><article class="document">
  <header><div class="brand">${logo}<div>${e(output.company.persianName)}</div><small>${e(output.company.latinName ?? '')}</small></div><div dir="ltr"><h1>TRAVEL SERVICES<br>CONTRACT</h1><p dir="rtl">قرارداد فروش خدمات مسافرتی</p></div></header>
  ${c.status === 'CANCELLED' ? '<div class="cancelled">این قرارداد لغو شده است</div>' : ''}
  <div class="meta"><div>شماره قرارداد<strong><bdi>${e(c.contractNumber)}</bdi></strong></div><div>تاریخ ثبت<strong>${e(date(c.createdAt))}</strong></div><div>ساعت<strong>${e(time(c.createdAt))}</strong></div><div>مسئول فروش<strong>${e(output.ownerName)}</strong></div></div>
  <section>${heading(1, 'CONTRACT PARTIES', 'طرفین قرارداد')}<div class="fields"><div>دفتر خریدار / مشتری: <b>${e(c.customerNameSnapshot)}</b></div><div>مدیر: —</div><div class="wide">نشانی: ${e(output.customer.address)}</div><div>مقصد: ${e(name(c.destinationId))}</div><div>تعداد: ${c.passengersDetail.length} نفر</div><div>درخواست‌کننده: ${e(c.customerNameSnapshot)}</div><div>خدمات: ${e(c.services.map(kind).join('، '))}</div></div></section>
<section class="passengers">${heading(2, 'PASSENGERS & PRICING', 'مسافران و قیمت')}<table><colgroup>${passengerColumns}</colgroup><thead><tr><th>ردیف</th><th>نام مسافر</th><th>رده سنی</th><th>ویزا</th><th>اتاق</th><th>مبلغ فروش</th><th>ارز</th>${agency ? '<th>کمیسیون</th>' : ''}<th>توضیحات</th></tr></thead><tbody>${rows}</tbody></table><div class="financial-summary"><p class="note">${c.passengersDetail.every((p) => p.agreedPrices?.length) ? 'مبلغ فروش هر مسافر، کل خدمات توافق‌شده همان نفر است.' : 'برای ردیف‌های قدیمی قیمت تفکیکی مسافر ثبت نشده؛ مبلغ حدسی درج نمی‌شود.'}</p><div class="totals"><b>مبلغ توافق‌شده قرارداد</b><div>${agreementTotal ?? moneyRows('amount')}</div></div><div class="financial"><div>پرداخت تأییدشده مالی: ${moneyRows('confirmedPaid')}</div><div>مانده: ${moneyRows('outstanding')}</div></div>${agency ? '<p class="note">کمیسیون آژانس در این قرارداد ثبت نشده؛ هیچ مبلغی بابت آن از جمع قرارداد کسر نشده است.</p>' : ''}</div></section>
  <section>${heading(3, 'FLIGHT INFORMATION', 'اطلاعات پرواز')}<table><thead><tr><th>مسیر</th><th>ایرلاین</th><th>شماره</th><th>تاریخ</th><th>ساعت</th><th>کلاس</th></tr></thead><tbody>${flights || '<tr><td colspan="6">پرواز در این قرارداد انتخاب نشده است.</td></tr>'}</tbody></table></section>
  <section>${heading(4, 'HOTEL INFORMATION', 'اطلاعات هتل')}${hotel ? `<table><thead><tr><th style="width:30%">نام هتل</th><th>درجه</th><th>خدمات</th><th>ورود</th><th>خروج</th><th>نوع اتاق</th></tr></thead><tbody><tr><td><bdi>${e(refs.hotelLatinName || 'ثبت نشده')}</bdi><small><bdi>${e(refs.hotelWebsite || 'وب‌سایت ثبت نشده')}</bdi></small></td><td>${e(refs.hotelGrade)}</td><td>${e(name(hotel.mealServiceId))}</td><td>${e(date(hotel.checkInDate))}</td><td>${e(date(hotel.checkOutDate))}</td><td>${e(room)}</td></tr></tbody></table>` : 'هتل در این قرارداد انتخاب نشده است.'}</section>
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
  <section>${heading(6, 'APPROVAL & SIGNATURE', 'تأیید و امضا')}<div class="signatures"><div>نام و امضای مسافر / نماینده<br>....................................</div><div>نام و امضای مسئول فروش<br>....................................</div></div></section>
  <div class="customer-terms">
    <p>در صورت تأیید نشدن هتل درخواستی، هتل مشابه جایگزین می‌گردد.</p>
    <p>توجه داشته باشید این برگه بدون قبض رسید صندوق فاقد هرگونه اعتبار می‌باشد.</p>
    <p>با آگاهی از مفاد قراردادهای خارج از کشور که توسط سازمان میراث فرهنگی و گردشگری تهیه گردیده است، نسبت به ارسال درخواست به آژانس نیایش سیر سحر اقدام نموده و ارسال درخواست به منزله قبول تمامی شرایط، مواد و تبصره‌های قرارداد فوق می‌باشد.</p>
  </div>
  <footer>${e(output.company.persianName)} · <bdi>Nystkt.ir</bdi></footer>
  </article></body></html>`;
}
