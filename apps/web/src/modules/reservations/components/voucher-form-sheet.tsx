'use client';
import { voucherHotelDocuments } from '../model/voucher-hotel-documents';
import { SupplierPriceTable } from './supplier-price-table';
import {
  voucherPassengerServices,
  voucherPassengerCells,
  voucherServiceColumns,
  voucherPassengerPageUnits,
} from '../model/voucher-passenger-services';

import { loadOutputReferences } from '../model/output-references';
import { getPublicApiBaseUrl } from '@/lib/environment';

import { reservationFormFooterHtml } from '../model/reservation-form-footer';
import Image from '@/i18n/image';
import { voucherFormData, supplierFormData } from '../model/voucher-settings';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { MasterDataResource } from '@nora/contracts';
import { salesContractFlights } from '@nora/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';
import {
  reservationPassengerPages,
  reservationRoomAppendices,
  type ReservationFormIntake,
  type ReservationFormReferences,
} from '../model/reservation-form';
import styles from './reservation-form-sheet.module.css';
export function useReservationFormReferences(
  intake: ReservationFormIntake,
  active: boolean,
) {
  const [loaded, setLoaded] = useState<{
    key: string;
    references: ReservationFormReferences;
    failed: boolean;
  }>();
  const hotel = intake.snapshot.hotelSelection;
  const flights = salesContractFlights(
    intake.snapshot.serviceSelections,
    intake.snapshot.ticketSelections ?? [],
  );
  const entries = [
    hotel?.cityId
      ? ['cities', hotel.cityId]
      : flights[0]?.destinationId
        ? ['cities', flights[0].destinationId]
        : null,
    hotel ? ['hotels', hotel.hotelId] : null,
    hotel?.roomTypeId ? ['room-types', hotel.roomTypeId] : null,
    ...(hotel?.rooms ?? []).map((r) => ['room-types', r.roomTypeId]),
    hotel?.mealServiceId ? ['meal-services', hotel.mealServiceId] : null,
    ...flights.map((f) => ['airline-name', f.carrierNameSnapshot]),
  ].filter((entry): entry is string[] => !!entry);
  const key = JSON.stringify({ entries, requestId: intake.id });
  useEffect(() => {
    if (!active) return;
    let live = true;
    const requested = (
      JSON.parse(key) as { entries: [MasterDataResource, string][] }
    ).entries;
    void Promise.all(
      requested.map(async ([resource, id]) => {
        try {
          if (resource === ('airline-name' as MasterDataResource)) {
            const result = await masterDataApi.list(
              'airlines',
              {
                search: id,
                status: 'all',
                sortBy: 'name',
                sortDirection: 'asc',
                page: 1,
                pageSize: 100,
              },
              'reservations',
            );
            const data = result.data.find((record) =>
              [record.name, record.attributes.englishName].includes(id),
            );
            return { id, data };
          }
          const { data } = await masterDataApi.detail(
            resource,
            id,
            'reservations',
          );
          return { id, data };
        } catch {
          return { id, data: undefined };
        }
      }),
    ).then(async (results) => {
      const extra = await loadOutputReferences(async (path) => {
        const response = await fetch(getPublicApiBaseUrl() + path, {
          credentials: 'include',
          cache: 'no-store',
        });
        return response.ok ? response.json() : {};
      }, intake.id).catch(() => ({}));
      if (live)
        setLoaded({
          key,
          references: {
            ...extra,
            ...Object.fromEntries(
              results.flatMap((result) =>
                result.data ? [[result.id, result.data]] : [],
              ),
            ),
          },
          failed: results.some((result) => !result.data),
        });
    });
    return () => {
      live = false;
    };
  }, [key, active, intake.id]);
  return {
    references: loaded?.key === key ? loaded.references : {},
    ready: !active || loaded?.key === key,
    failed: loaded?.key === key && loaded.failed,
  };
}
function Heading({
  number,
  title,
  note,
}: {
  number: string;
  title: string;
  note: string;
}) {
  return (
    <div className={styles.heading}>
      <b>{number}</b>
      <strong>{title}</strong>
      <span>{note}</span>
    </div>
  );
}
const subscribeOrigin = () => () => {};
const browserOrigin = () => window.location.origin;
const serverOrigin = () => '';
type VoucherSheetProps = {
  intake: ReservationFormIntake;
  logo: string;
  references?: ReservationFormReferences;
  voucher?: boolean;
  publicDocumentUrl?: string | undefined;
};
export function VoucherFormSheet(props: VoucherSheetProps) {
  const documents = props.voucher
    ? voucherHotelDocuments(props.intake, props.references ?? {})
    : [];
  if (documents.length > 1)
    return (
      <>
        {documents.map((document) => (
          <VoucherHotelSheet
            {...props}
            key={document.intake.hotelStayKey}
            intake={document.intake}
            pageOffset={document.pageOffset}
            totalPages={document.totalPages}
          />
        ))}
      </>
    );
  return <VoucherHotelSheet {...props} />;
}
function VoucherHotelSheet({
  intake,
  logo,
  references = {},
  voucher = false,
  publicDocumentUrl,
  pageOffset = 0,
  totalPages,
}: {
  intake: ReservationFormIntake;
  logo: string;
  references?: ReservationFormReferences;
  voucher?: boolean;
  publicDocumentUrl?: string | undefined;
  pageOffset?: number;
  totalPages?: number;
}) {
  const data = voucher
    ? voucherFormData(intake, references)
    : supplierFormData(intake, references);
  const passengerServices: ReturnType<typeof voucherPassengerServices> = voucher
    ? voucherPassengerServices(intake, data)
    : {};
  const settings = voucher
    ? intake.workflow.voucherSettings
    : intake.workflow.supplierFormSettings;
  const origin = useSyncExternalStore(
    subscribeOrigin,
    browserOrigin,
    serverOrigin,
  );
  const pages = voucher
    ? reservationPassengerPages(
        data.passengers,
        voucherPassengerPageUnits(settings, data.notes),
      )
    : [data.passengers];
  const roomAppendices =
    !settings || settings.flags.hotel
      ? reservationRoomAppendices(data.roomBreakdown)
      : [];
  const pageCount = totalPages ?? pages.length + roomAppendices.length;
  return (
    <div className={styles.document} lang={voucher ? 'en' : undefined}>
      {pages.map((people, page) => {
        const first = pages
          .slice(0, page)
          .reduce((total, items) => total + items.length, 0);
        return (
          <article
            key={page}
            className={styles.page}
            data-voucher={voucher || undefined}
            dir="ltr"
            data-reservation-form-page
          >
            <header
              className={
                settings?.flags.withLetterhead === false
                  ? styles.plainHeader
                  : styles.header
              }
            >
              <div>
                <h1>{voucher ? 'HOTEL VOUCHER' : 'RESERVATION FORM'}</h1>
                <p>TRAVEL SERVICES / HOTEL / TRANSFER / TOUR LEADER</p>
              </div>
              <div
                className={`${styles.brand} ${intake.workflow.branding?.kind === 'OWN' && intake.workflow.branding.companyCode === 'JAHAN_BASTAN' ? styles.jahanBrand : ''}`}
              >
                {logo && settings?.flags.withLetterhead !== false && (
                  <Image
                    className={
                      intake.workflow.branding?.kind === 'OWN'
                        ? intake.workflow.branding.companyCode ===
                          'JAHAN_BASTAN'
                          ? styles.jahanLogo
                          : styles.logo
                        : styles.agencyLogo
                    }
                    src={
                      logo === '/brand/niyayesh-seir-full.png'
                        ? '/brand/niyayesh.png'
                        : logo
                    }
                    alt={data.brand}
                    width={196}
                    height={64}
                    unoptimized
                  />
                )}
              </div>
            </header>
            <div className={styles.meta}>
              {[
                [voucher ? 'BOOKING NO.' : 'REQUEST NO.', data.request],
                ['SUPPLIER', data.supplier],

                [voucher ? 'BOOKING DATE' : 'DATE OF ISSUE', data.issueDate],
                ['SERVICES', data.services],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <b dir="auto">{value}</b>
                </div>
              ))}
            </div>
            <section className={styles.bookingSection}>
              <Heading
                number="01"
                title="BOOKING SUMMARY"
                note="Reservation details"
              />
              <div className={styles.summary}>
                {[
                  ['ADULTS', data.adults],
                  ['CHILDREN 6-12', data.children6To12],
                  ['CHILDREN 2-6', data.children2To6],
                  ...(data.childrenUnclassified
                    ? [['CHILDREN (UNSPECIFIED)', data.childrenUnclassified]]
                    : []),
                  ['INFANTS', data.infants],
                  ['DESTINATION', data.destination],
                  [
                    'ROOMS / NIGHTS',
                    `${data.rooms} ROOMS / ${data.nights} NIGHTS`,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <b dir="auto">{value}</b>
                  </div>
                ))}
              </div>
            </section>
            <Heading
              number="02"
              title="FLIGHT INFORMATION"
              note="Departure & return · Tehran time"
            />
            <table className={styles.table}>
              <thead>
                <tr>
                  {['AIRLINE', 'FLIGHT NO.', 'DATE', 'TIME'].map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.flights.length
                  ? data.flights
                  : [
                      {
                        leg: '-',
                        airline: '-',
                        number: '-',
                        date: '-',
                        time: '-',
                      },
                    ]
                ).map((f, i) => (
                  <tr key={i}>
                    <td dir="auto">{f.airline}</td>
                    <td>{f.number}</td>
                    <td>{f.date}</td>
                    <td>{f.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!settings || settings.flags.hotel) && (
              <>
                <Heading
                  number="03"
                  title="HOTEL INFORMATION"
                  note="Accommodation"
                />
                <table className={styles.table}>
                  <colgroup>
                    <col
                      style={{
                        width: data.roomBreakdown.length ? '30%' : '24%',
                      }}
                    />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '10%' }} />
                    {!data.roomBreakdown.length && (
                      <col style={{ width: '16%' }} />
                    )}
                    <col
                      style={{
                        width: data.roomBreakdown.length ? '19%' : '14%',
                      }}
                    />
                    <col
                      style={{
                        width: data.roomBreakdown.length ? '19%' : '14%',
                      }}
                    />
                  </colgroup>
                  <thead>
                    <tr>
                      {[
                        'HOTEL',
                        'CITY',
                        'STAR',
                        'SERVICE',
                        ...(!data.roomBreakdown.length ? ['ROOM TYPE'] : []),
                        'CHECK-IN',
                        'CHECK-OUT',
                      ].map((t) => (
                        <th key={t}>{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td dir="auto">{data.hotel}</td>
                      <td dir="auto">{data.destination}</td>
                      <td>{data.stars}</td>
                      <td dir="auto">{data.meal}</td>
                      {!data.roomBreakdown.length && (
                        <td dir="auto">{data.roomType}</td>
                      )}
                      <td>{data.checkIn}</td>
                      <td>{data.checkOut}</td>
                    </tr>
                  </tbody>
                </table>
                {data.roomBreakdown.length ? (
                  <table className={`${styles.table} ${styles.roomBreakdown}`}>
                    <caption>ROOM QUANTITIES BY TYPE</caption>
                    <thead>
                      <tr>
                        {[
                          'ROOM',
                          'ROOM TYPE',
                          'ADULTS',
                          'CHILD AGES',
                          'GUESTS',
                        ].map((t) => (
                          <th key={t}>{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.roomBreakdown.slice(0, 4).map((r) => (
                        <tr key={r.ordinal}>
                          <td>{r.ordinal}</td>
                          <td dir="auto">{r.roomType}</td>
                          <td>{r.adults}</td>
                          <td>{r.childAges.join(', ') || '-'}</td>
                          <td>{r.adults + r.childAges.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </>
            )}
            <Heading number="04" title="TOUR SERVICES" note="Leader & board" />
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>TRANSFER</th>
                  <th>TOUR LEADER</th>
                  <th>BOARD</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{data.transfer}</td>
                  <td dir="auto">{data.leader}</td>
                  <td dir="auto">
                    {settings?.text.transferBoard?.trim() || '-'}
                  </td>
                </tr>
              </tbody>
            </table>
            {voucher ? (
              <>
                <Heading
                  number="05"
                  title="PASSENGER SERVICES"
                  note="Passenger manifest"
                />
                <table className={styles.table + ' ' + styles.voucherServices}>
                  <colgroup>
                    {voucherServiceColumns.map(([label, width]) => (
                      <col key={label} style={{ width: width + '%' }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      {voucherServiceColumns.map(([label]) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {people.length ? (
                      people.map((person, i) => (
                        <tr key={person.id}>
                          {voucherPassengerCells(
                            person,
                            passengerServices[person.id]!,
                            first + i + 1,
                          ).map((cell, column) => (
                            <td
                              key={column}
                              className={
                                passengerServices[person.id]!.different &&
                                [6, 7].includes(column)
                                  ? styles.differentStay
                                  : undefined
                              }
                            >
                              {passengerServices[person.id]!.different &&
                              [6, 7].includes(column) ? (
                                <strong>{cell}</strong>
                              ) : (
                                cell
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={voucherServiceColumns.length}>—</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </>
            ) : (
              <>
                <Heading
                  number="05"
                  title="PASSENGERS"
                  note="Passenger MANIFEST"
                />
                <table className={`${styles.table} ${styles.passengers}`}>
                  <colgroup>
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '56%' }} />
                    <col style={{ width: '17%' }} />
                    <col style={{ width: '21%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>SURNAME / NAME</th>
                      <th>SEX</th>
                      <th>AGE RATE</th>
                      {data.passengers.some((p) => p.checkIn !== undefined) && (
                        <>
                          <th>CHECK-IN</th>
                          <th>CHECK-OUT</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {people.length ? (
                      people.map((p, i) => (
                        <tr key={p.id}>
                          <td>{String(first + i + 1).padStart(2, '0')}</td>
                          <td dir="auto">{p.name}</td>
                          <td>{p.sex}</td>
                          <td>{p.age}</td>
                          {data.passengers.some(
                            (p) => p.checkIn !== undefined,
                          ) && (
                            <>
                              <td>{p.checkIn ?? '—'}</td>
                              <td>{p.checkOut ?? '—'}</td>
                            </>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4}>-</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </>
            )}
            {!voucher && <SupplierPriceTable intake={intake} />}
            <Heading
              number={voucher ? '06' : '07'}
              title="NOTICE"
              note="Notes & confirmation"
            />
            <div className={voucher ? styles.voucherClosing : undefined}>
              <div className={styles.notice}>
                <span>SPECIAL REQUESTS / REMARKS</span>
                <p dir="auto">{data.notes || '\u00a0'}</p>
                <div />
              </div>
              {voucher && (
                <div className={styles.stamp}>
                  <strong>STAMP</strong>
                </div>
              )}
            </div>
            <footer className={styles.footer}>
              {
                <div
                  data-reservation-footer
                  dangerouslySetInnerHTML={{
                    __html: reservationFormFooterHtml(
                      intake.id,
                      origin,
                      intake.workflow.branding?.companyCode,
                      data.brand,
                      publicDocumentUrl,
                      voucher,
                    ),
                  }}
                />
              }
              <div>
                <span>{''}</span>
              </div>
              <b>
                {pageOffset + page + 1} / {pageCount}
              </b>
            </footer>
          </article>
        );
      })}
      {roomAppendices.map((rooms, index) => (
        <article
          className={styles.page}
          key={`rooms-${index}`}
          dir="ltr"
          data-reservation-form-page
        >
          <header className={styles.header}>
            <h1>ROOM DETAILS</h1>
          </header>
          <p>
            {data.request} · {data.hotel} · {data.checkIn} / {data.checkOut}
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                {['ROOM', 'ROOM TYPE', 'ADULTS', 'CHILD AGES', 'GUESTS'].map(
                  (t) => (
                    <th key={t}>{t}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.ordinal}>
                  <td>{r.ordinal}</td>
                  <td dir="auto">{r.roomType}</td>
                  <td>{r.adults}</td>
                  <td>{r.childAges.join(', ') || '-'}</td>
                  <td>{r.adults + r.childAges.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <footer className={styles.footer}>
            <b>
              {pageOffset + pages.length + index + 1} / {pageCount}
            </b>
          </footer>
        </article>
      ))}
    </div>
  );
}
