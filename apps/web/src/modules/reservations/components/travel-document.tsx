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
import { DocumentPreview } from './document-preview';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
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
  const [downloading, setDownloading] = useState(false);
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
    if (printing || !enabled || !formReferences.ready) return;
    setPrintError('');
    const previousTitle = document.title;
    document.title = `${voucher ? 'voucher' : 'reservation-form'}-${intake.snapshot.contractNumber}`;
    flushSync(() => setPrinting(true));
    try {
      await document.fonts.ready;
      await Promise.all(
        Array.from(
          document.querySelectorAll<HTMLImageElement>(
            '[data-travel-document] img',
          ),
        ).map((img) => {
          // Off-screen pages must load their logos before opening print/PDF.
          img.loading = 'eager';
          return img.decode();
        }),
      );
      window.print();
    } catch {
      setPrintError('چاپ آماده نشد؛ دریافت لوگو را بررسی کنید.');
    } finally {
      setPrinting(false);
      document.title = previousTitle;
    }
  }
  async function downloadPdf() {
    if (downloading || !enabled) return;
    setDownloading(true);
    setPrintError('');
    try {
      const send = () =>
        fetch(`/reservations/requests/${encodeURIComponent(intake.id)}/pdf`, {
          credentials: 'include',
          cache: 'no-store',
        });
      let response = await send();
      const base = getPublicApiBaseUrl();
      if (
        response.status === 401 &&
        base &&
        (await refreshAuthenticatedSession(base))
      )
        response = await send();
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message || 'دریافت PDF انجام نشد.');
      }
      if (!response.headers.get('content-type')?.includes('application/pdf'))
        throw new Error('پاسخ سرور فایل PDF نیست؛ دوباره وارد حساب شوید.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `reservation-form-${intake.snapshot.contractNumber.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setPrintError(e instanceof Error ? e.message : 'دریافت PDF انجام نشد.');
    } finally {
      setDownloading(false);
    }
  }
  return (
    <div className="grid min-w-0 gap-3">
      {(error || printError) && <p role="alert">{error || printError}</p>}
      {!voucher && (
        <Button
          disabled={downloading || !enabled}
          onClick={() => void downloadPdf()}
        >
          {downloading
            ? 'در حال آماده‌سازی PDF…'
            : 'دانلود مستقیم PDF فرم رزرواسیون'}
        </Button>
      )}
      <Button
        disabled={printing || !enabled || !formReferences.ready}
        onClick={() => void print()}
      >
        چاپ / ذخیره PDF {voucher ? 'واچر' : 'فرم رزرواسیون'}
      </Button>
      <p className="text-sm text-muted-foreground">
        برای خروجی PDF، در پنجرهٔ چاپ مقصد «Save as PDF» را انتخاب کنید.
        پیش‌نمایش متناسب با پنجره است؛ خروجی در اندازهٔ کامل A4 ذخیره می‌شود.
      </p>
      {!voucher && formReferences.failed && (
        <p role="status">
          برخی اطلاعات تکمیلی مرجع دریافت نشد؛ فیلدهای خالی را پیش از ارسال
          بررسی کنید.
        </p>
      )}
      {enabled && <DocumentPreview>{sheet}</DocumentPreview>}
      {printing &&
        createPortal(
          <div data-travel-document>
            <style media="print">
              {`${voucher ? '@page{size:A4;margin:10mm}' : '@page{size:A4;margin:0}'}body>:not([data-travel-document]){display:none!important}html,body{overflow:visible!important;height:auto!important;margin:0!important} [data-travel-document]{display:block!important;width:100%!important;zoom:1!important}`}
            </style>
            {sheet}
          </div>,
          document.body,
        )}
    </div>
  );
}
