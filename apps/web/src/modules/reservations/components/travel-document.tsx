'use client';
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
  historical = false,
}: {
  intake: ReservationIntakeV1 & { workflow: TravelWorkflowStateV1 };
  voucher?: boolean;
  historical?: boolean;
}) {
  const { logo, error } = useTravelLogo(intake.workflow.branding);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const state = intake.workflow;
  const formReferences = useReservationFormReferences(intake, true);
  const enabled =
    (!!logo ||
      (voucher && state.voucherSettings?.flags.withLetterhead === false)) &&
    !!state.branding &&
    state.supplierStatus !== 'CANCELLED' &&
    (!voucher || state.voucherIssued);
  const sheet = (
    <ReservationFormSheet
      intake={intake}
      logo={logo}
      references={formReferences.references}
      voucher={voucher}
    />
  );
  async function print() {
    if (printing || !enabled || !formReferences.ready) return;
    setPrintError('');
    const previousTitle = document.title;
    document.title = `${voucher ? 'voucher' : 'reservation-form'}-${intake.snapshot.contractNumber}-v${state.version}`;
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
      {!voucher && !historical && (
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
      {formReferences.failed && (
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
              {`@page{size:A4;margin:0}body>:not([data-travel-document]){display:none!important}html,body{overflow:visible!important;height:auto!important;margin:0!important} [data-travel-document]{display:block!important;width:100%!important;zoom:1!important}`}
            </style>
            {sheet}
          </div>,
          document.body,
        )}
    </div>
  );
}
