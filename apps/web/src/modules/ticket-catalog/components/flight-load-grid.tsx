'use client';
import { useState, type ReactNode } from 'react';
import { ticketCalendarDate, type TicketOfferV1 } from '@nora/contracts';
import { Button, FormField, Input } from '@/components/ui';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import {
  companyFlightLegs,
  changeFlightLoadFilter,
  isCompanyLoadOffer,
  companyReturnLegs,
  flightLoadTotals,
  type FlightLoadFilter,
} from '../model/flight-load';
import { TicketDatePicker } from './ticket-date-picker';
import { scheduleWeekdays } from '../model/weekday-schedule';
import styles from './flight-load-grid.module.css';

const cabinLabels = { ECONOMY: 'اکونومی', BUSINESS: 'بیزینس', FIRST: 'فرست' };
const time = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
const weekday = (value: string) =>
  new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    weekday: 'long',
  }).format(new Date(value));
const initial = (): FlightLoadFilter => ({
  from: '',
  to: '',
  origin: '',
  destination: '',
  carrier: '',
  number: '',
  weekday: '',
  cabin: '',
});
export function FlightLoadGrid({
  offers,
  cityName,
  refreshing,
  onRefresh,
  renderActions,
}: {
  offers: readonly TicketOfferV1[];
  cityName: (id: string) => string;
  refreshing: boolean;
  onRefresh: () => void;
  renderActions: (offer: TicketOfferV1) => ReactNode;
}) {
  const [filter, setFilter] = useState(initial);
  const [outboundId, setOutboundId] = useState(''),
    [returnId, setReturnId] = useState('');
  const [sameClass, setSameClass] = useState(false);
  const company = offers.filter(isCompanyLoadOffer);
  const outbounds = companyFlightLegs(offers, filter);
  const outbound = outbounds.find((offer) => offer.id === outboundId);
  const returns = companyReturnLegs(
    offers,
    outbound,
    sameClass,
    filter.carrier,
  );
  const returning = returns.find((offer) => offer.id === returnId);
  const cities = [
    ...new Set(
      company.flatMap((offer) => [offer.originId, offer.destinationId]),
    ),
  ];
  const change = (field: keyof FlightLoadFilter, value: string) => {
    setFilter((c) => changeFlightLoadFilter(c, field, value));
    setOutboundId('');
    setReturnId('');
  };
  const selectLeg = (id: string, back: boolean) => {
    if (back) setReturnId(id);
    else {
      setOutboundId(id);
      setReturnId('');
    }
  };
  const selectFilter = (
    field: keyof FlightLoadFilter,
    label: string,
    options: readonly [string, string][],
  ) => (
    <FormField label={label} id={'load-' + field}>
      <NativeSearchSelect
        id={'load-' + field}
        value={filter[field]}
        onChange={(event) => change(field, event.target.value)}
      >
        <option value="">همه</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </NativeSearchSelect>
    </FormField>
  );
  const table = (rows: readonly TicketOfferV1[], back: boolean) => {
    const selected = back ? returning : outbound,
      totals = flightLoadTotals(rows);
    return (
      <section className={styles.leg}>
        <h3>
          {back ? 'برگشت' : 'رفت'}
          {outbound
            ? ` — ${cityName(back ? outbound.destinationId : outbound.originId)} ← ${cityName(back ? outbound.originId : outbound.destinationId)}`
            : ''}
        </h3>
        <div className={styles.scroller}>
          <table className={styles.table}>
            <thead>
              <tr>
                {[
                  'انتخاب',
                  'وب',
                  'تاریخ',
                  'ایرلاین',
                  'شماره',
                  'ساعت',
                  'کلاس',
                  'ظرفیت کل',
                  'مانده',
                  'تعداد رزرو',
                  'فروش',
                  'O-W',
                  'Min',
                  'Max',
                  'روز هفته',
                  'کلاس همنام',
                ].map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((offer) => (
                <tr
                  key={offer.id}
                  className={selected?.id === offer.id ? styles.selected : ''}
                  onClick={() => selectLeg(offer.id, back)}
                >
                  <td>
                    <input
                      type="radio"
                      name={back ? 'load-return' : 'load-outbound'}
                      aria-label={`انتخاب ${back ? 'برگشت' : 'رفت'} ${offer.serviceNumber} ${ticketCalendarDate(offer.departureAt)}`}
                      checked={selected?.id === offer.id}
                      onChange={() => selectLeg(offer.id, back)}
                    />
                  </td>
                  <td title="وضعیت انتشار وب برای این بلیت ثبت نشده است">—</td>
                  <td dir="ltr">{ticketCalendarDate(offer.departureAt)}</td>
                  <td>{offer.carrierName}</td>
                  <td>{offer.serviceNumber}</td>
                  <td dir="ltr">{time(offer.departureAt)}</td>
                  <td>{cabinLabels[offer.cabinClassCode]}</td>
                  <td>{offer.totalCapacity}</td>
                  <td>{offer.remainingCapacity}</td>
                  <td>{offer.reservedCapacity ?? '—'}</td>
                  <td>{offer.allocatedCapacity ?? '—'}</td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label="قیمت فروش یک‌طرفه دارد"
                      checked={Boolean(offer.standaloneSalePrice)}
                      readOnly
                      disabled
                    />
                  </td>
                  <td>{offer.returnMinDays ?? '—'}</td>
                  <td>{offer.returnMaxDays ?? '—'}</td>
                  <td>{weekday(offer.departureAt)}</td>
                  <td>
                    {back && outbound
                      ? offer.cabinClassCode === outbound.cabinClassCode
                        ? '✓'
                        : '—'
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className={styles.empty}>
              {back && !outbound
                ? 'یک پرواز رفت را انتخاب کنید تا برگشت‌های مجاز نمایش داده شوند.'
                : 'پروازی با این شرایط وجود ندارد.'}
            </p>
          )}
        </div>
        <div className={styles.totals}>
          <span>
            ظرفیت کل: <strong>{totals.total}</strong>
          </span>
          <span>
            فروش: <strong>{totals.sold}</strong>
          </span>
          <span>
            مانده: <strong>{totals.remaining}</strong>
          </span>
          <span>
            رزرو: <strong>{totals.reserved}</strong>
          </span>
          <span>
            درصد فروش:{' '}
            <strong>
              {totals.total
                ? ((100 * totals.sold) / totals.total).toFixed(1)
                : 0}
              %
            </strong>
          </span>
        </div>
      </section>
    );
  };
  const detail = (offer: TicketOfferV1 | undefined, back: boolean) => (
    <section>
      <strong>{back ? 'مشخصات و قیمت برگشت' : 'مشخصات و قیمت رفت'}</strong>
      {offer ? (
        <>
          <p>
            {offer.carrierName} · {offer.serviceNumber} ·{' '}
            <span dir="ltr">
              {ticketCalendarDate(offer.departureAt)} {time(offer.departureAt)}
            </span>{' '}
            · {cabinLabels[offer.cabinClassCode]}
          </p>
          <p>
            بار اکونومی:{' '}
            {offer.economyBaggageKg == null
              ? 'ثبت نشده'
              : offer.economyBaggageKg + ' kg'}{' '}
            · بار بیزینس:{' '}
            {offer.businessBaggageKg == null
              ? 'ثبت نشده'
              : offer.businessBaggageKg + ' kg'}
          </p>
          <p>
            نوع تأمین:{' '}
            {offer.supplyType === 'COMPANY' ? 'ظرفیت شرکت (چارتر)' : 'ثبت نشده'}
          </p>
          {renderActions(offer)}
          <p>
            قیمت یک‌طرفه:{' '}
            {offer.standaloneSalePrice
              ? offer.standaloneSalePrice.amount +
                ' ' +
                offer.standaloneSalePrice.currencyCode
              : 'قیمت‌گذاری نشده'}
          </p>
          {offer.targetedStandaloneSalePrices?.map((price) => (
            <p key={price.salePriceTarget.id}>
              {price.salePriceTarget.name}: {price.amount} {price.currencyCode}
              {offer.saleCommissions?.find(
                (c) =>
                  c.salePriceTargetId === price.salePriceTarget.id &&
                  !c.returnOfferId,
              )?.percent
                ? ' · کمیسیون ' +
                  offer.saleCommissions.find(
                    (c) =>
                      c.salePriceTargetId === price.salePriceTarget.id &&
                      !c.returnOfferId,
                  )!.percent +
                  '%'
                : ''}
            </p>
          ))}
          {!back && returning && (
            <p>
              قیمت کل رفت‌وبرگشت:{' '}
              {offer.roundTripSalePrices?.find(
                (price) => price.returnOfferId === returning.id,
              )?.amount ?? 'قیمت‌گذاری نشده'}{' '}
              {
                offer.roundTripSalePrices?.find(
                  (price) => price.returnOfferId === returning.id,
                )?.currencyCode
              }
            </p>
          )}
        </>
      ) : (
        <p>پرواز را از جدول انتخاب کنید.</p>
      )}
    </section>
  );
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2>لود پروازهای ظرفیت شرکت (چارتر)</h2>
        <Button
          size="sm"
          variant="outline"
          disabled={refreshing}
          onClick={onRefresh}
        >
          {refreshing ? 'در حال دریافت…' : 'به‌روزرسانی لود'}
        </Button>
      </div>
      <div className={styles.filters}>
        <FormField label="از تاریخ" id="load-from">
          <TicketDatePicker
            id="load-from"
            value={filter.from}
            onChange={(value) => change('from', value)}
          />
        </FormField>
        <FormField label="تا تاریخ" id="load-to">
          <TicketDatePicker
            id="load-to"
            value={filter.to}
            onChange={(value) => change('to', value)}
          />
        </FormField>
        {selectFilter(
          'origin',
          'مبدأ',
          cities.map((id) => [id, cityName(id)]),
        )}
        {selectFilter(
          'destination',
          'مقصد',
          cities.map((id) => [id, cityName(id)]),
        )}
        {selectFilter(
          'carrier',
          'ایرلاین',
          [...new Set(company.map((offer) => offer.carrierName))].map(
            (name) => [name, name],
          ),
        )}
        <FormField label="شماره پرواز رفت" id="load-number">
          <Input
            id="load-number"
            value={filter.number}
            onChange={(event) => change('number', event.target.value)}
          />
        </FormField>
        {selectFilter(
          'weekday',
          'روز هفته',
          scheduleWeekdays.map((day) => [String(day.day), day.name]),
        )}
        {selectFilter('cabin', 'کلاس', Object.entries(cabinLabels))}
        <label>
          <input
            type="checkbox"
            checked={sameClass}
            onChange={(event) => {
              setSameClass(event.target.checked);
              setReturnId('');
            }}
          />{' '}
          برگشت با کلاس همنام رفت
        </label>
        <Button
          variant="outline"
          onClick={() => {
            setFilter(initial());
            setOutboundId('');
            setReturnId('');
            setSameClass(false);
          }}
        >
          پاک‌کردن فیلترها
        </Button>
      </div>
      {filter.from && filter.to && filter.from > filter.to ? (
        <p className={styles.help}>تاریخ پایان باید بعد از تاریخ شروع باشد.</p>
      ) : null}
      {!company.length && (
        <p className={styles.help}>بلیتی برای نمایش در لود وجود ندارد.</p>
      )}
      <div className={styles.tables}>
        {table(outbounds, false)}
        {table(returns, true)}
      </div>
      <div className={styles.details}>
        {detail(outbound, false)}
        {detail(returning, true)}
      </div>
      <p className={styles.help}>
        بلیت‌های قدیمی با نوع تأمین ثبت‌نشده نیز نمایش داده می‌شوند؛ نوع تأمین
        آن‌ها در ویرایش قابل انتخاب است. برگشت‌ها از مسیر معکوس همان شعبه و در
        محدودهٔ Min / Max رفت نمایش داده می‌شوند؛ بازهٔ تاریخ بالا فقط پروازهای
        رفت را فیلتر می‌کند. تعداد رزرو، Hold فعال و منقضی‌نشده است؛ فروش،
        صندلی‌های تخصیص‌یافته است. ستون وب برای اطلاعات ثبت‌نشده علامت — دارد.
      </p>
    </div>
  );
}
