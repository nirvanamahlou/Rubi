'use client';
import { reservationFormData } from '../model/reservation-form';
import Image from 'next/image';
import {
  ReservationFormSheet,
  useReservationFormReferences,
} from './reservation-form-sheet';
import { useEffect, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import type {
  ReservationIntakeV1,
  TravelBrandingV1,
  TravelWorkflowStateV1,
} from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { documentsApi } from '@/modules/documents/api/client';
export function useTravelLogo(branding: TravelBrandingV1 | null) {
  const [loaded, setLoaded] = useState<{
    id: string;
    logo: string;
    error: string;
  }>();
  const fileId = branding?.logoFileId;
  useEffect(() => {
    if (!fileId) return;
    let active = true;
    let url = '';
    void documentsApi
      .preview(fileId)
      .then(({ blob }) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setLoaded({ id: fileId, logo: url, error: '' });
      })
      .catch(() => {
        if (active)
          setLoaded({
            id: fileId,
            logo: '',
            error:
              'لوگوی سربرگ در دسترس نیست؛ خروجی تا دریافت لوگو آماده نمی‌شود.',
          });
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId]);
  if (fileId) return loaded?.id === fileId ? loaded : { logo: '', error: '' };
  if (!branding) return { logo: '', error: '' };
  if (branding.kind === 'OWN' && branding.companyCode === 'NIYAYESH_SEIR_SAHAR')
    return { logo: '/brand/niyayesh-seir-full.png', error: '' };
  if (branding.kind === 'OWN' && branding.companyCode === 'JAHAN_BASTAN')
    return { logo: '/brand/jahan-bastan-horizontal.png', error: '' };
  return { logo: '', error: 'برای شرکت انتخاب‌شده لوگو ثبت نشده است.' };
}

export function TravelDocument({
  intake,
  voucher = false,
}: {
  intake: ReservationIntakeV1 & { workflow: TravelWorkflowStateV1 };
  voucher?: boolean;
}) {
  const { logo, error } = useTravelLogo(intake.workflow.branding);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState('');
  const state = intake.workflow;
  const formReferences = useReservationFormReferences(intake, true);
  const enabled =
    !!logo &&
    !!state.branding &&
    state.supplierStatus !== 'CANCELLED' &&
    (!voucher || state.voucherIssued);
  const sheet = !voucher ? (
    <ReservationFormSheet
      intake={intake}
      logo={logo}
      references={formReferences.references}
    />
  ) : (
    <article
      dir="rtl"
      style={{ background: 'white', color: '#111', padding: 32, fontSize: 14 }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '2px solid #333',
          paddingBottom: 16,
        }}
      >
        <div>
          <h1>{voucher ? 'واچر اقامت' : 'فرم درخواست رزرواسیون'}</h1>
          <p>{state.branding?.name}</p>
          <p>
            {intake.snapshot.contractNumber} · نسخه {state.version}
          </p>
        </div>
        {logo && (
          <Image
            src={logo}
            alt={state.branding?.name ?? ''}
            width={150}
            height={95}
            unoptimized
          />
        )}
      </header>
      <p>
        هتل:{' '}
        {intake.snapshot.hotelSelection
          ? reservationFormData(intake, formReferences.references).hotel
          : 'بدون خدمت هتل'}
      </p>
      <p>
        ورود: {intake.snapshot.hotelSelection?.checkInDate ?? '—'} · خروج:{' '}
        {intake.snapshot.hotelSelection?.checkOutDate ?? '—'}
      </p>
      <p>
        تعداد اتاق طبق قرارداد:{' '}
        {intake.arrangement?.roomCount ??
          intake.snapshot.hotelSelection?.roomCount ??
          '—'}
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>ردیف اسکان</th>
            <th>مسافر</th>
            <th>رده سنی عملیاتی</th>
          </tr>
        </thead>
        <tbody>
          {(state.roomOrder.length
            ? state.roomOrder
            : intake.snapshot.passengerIds
          ).map((id, index) => (
            <tr key={id}>
              <td style={{ borderBottom: '1px solid #ccc', padding: 8 }}>
                {index + 1}
              </td>
              <td>
                {intake.snapshot.passengerAssignments?.find(
                  (p) => p.customerId === id,
                )?.displayNameSnapshot ?? 'نام دریافت نشده'}
              </td>
              <td>
                {state.ageOverrides[id] === 'ADULT'
                  ? 'بزرگسال'
                  : state.ageOverrides[id] === 'CHILD'
                    ? 'کودک'
                    : state.ageOverrides[id] === 'INFANT'
                      ? 'نوزاد'
                      : intake.snapshot.passengerAssignments?.find(
                            (p) => p.customerId === id,
                          )?.ageCategory === 'ADT'
                        ? 'بزرگسال'
                        : intake.snapshot.passengerAssignments?.find(
                              (p) => p.customerId === id,
                            )?.ageCategory === 'CHD'
                          ? 'کودک'
                          : intake.snapshot.passengerAssignments?.find(
                                (p) => p.customerId === id,
                              )?.ageCategory === 'INF'
                            ? 'نوزاد'
                            : 'طبق قرارداد'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        خدمات:{' '}
        {intake.snapshot.serviceSelections
          .map((s) => s.titleSnapshot)
          .join('، ')}
      </p>
      <p>مرجع تأیید کارگزار: {state.supplierReference || 'در انتظار تأیید'}</p>
      <p>
        بیمه: {state.insuranceIssued ? state.insuranceReference : 'صادر نشده'}
      </p>
      <p>{state.note}</p>
      <p>
        {state.updatedAt
          ? new Date(state.updatedAt).toLocaleString('fa-IR')
          : ''}
      </p>
      {!voucher && (
        <p>درخواست رزرو؛ تا تأیید کارگزار به منزله تأیید اقامت نیست.</p>
      )}
    </article>
  );
  async function print() {
    flushSync(() => setPrinting(true));
    try {
      await Promise.all(
        Array.from(
          document.querySelectorAll<HTMLImageElement>(
            '[data-travel-document] img',
          ),
        ).map((img) => img.decode()),
      );
      window.print();
    } catch {
      setPrintError('چاپ آماده نشد؛ دریافت لوگو را بررسی کنید.');
    } finally {
      setPrinting(false);
    }
  }
  return (
    <div className="grid gap-3">
      {(error || printError) && <p role="alert">{error || printError}</p>}
      <Button
        disabled={!enabled || !formReferences.ready}
        onClick={() => void print()}
      >
        چاپ / ذخیره PDF {voucher ? 'واچر' : 'فرم رزرواسیون'}
      </Button>
      {!voucher && formReferences.failed && (
        <p role="status">
          برخی اطلاعات تکمیلی مرجع دریافت نشد؛ فیلدهای خالی را پیش از ارسال
          بررسی کنید.
        </p>
      )}
      {enabled && sheet}
      {printing &&
        createPortal(
          <div data-travel-document>
            <style media="print">
              {`${voucher ? '@page{size:A4;margin:10mm}' : '@page{size:A4;margin:0}'}body>:not([data-travel-document]){display:none!important}body{overflow:visible!important} [data-travel-document]{display:block!important}`}
            </style>
            {sheet}
          </div>,
          document.body,
        )}
    </div>
  );
}
