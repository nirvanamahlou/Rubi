'use client';
import { reservationHasTransfer } from '@nora/contracts';
import {
  supplierDocumentKinds,
  supplierDocumentScope,
  type SupplierDocumentKind,
} from '../model/supplier-document-scope';
import { sharedHotelSupplierScopes } from '../model/shared-hotel-supplier-form';
import { hotelFormScope } from '../model/hotel-form-scope';
import { reservationHotelStays } from '@nora/contracts';
import { isFloatingSalesContract } from '@nora/contracts';
import type { ReservationFormIntake } from '../model/reservation-form';
import { usePublicDocumentLink } from '@/modules/travel-documents/public/use-public-document-link';
import {
  ReservationFormSheet,
  useReservationFormReferences,
} from './reservation-form-sheet';
import { useEffect, useState } from 'react';
import type { TravelBrandingV1, VoucherSettingsV1 } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { documentsApi } from '@/modules/documents/api/client';
import { DocumentPreview } from './document-preview';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
export async function readTravelLogo(fileId: string, salesContractId?: string) {
  if (!salesContractId) return documentsApi.preview(fileId);
  const url =
    getPublicApiBaseUrl() +
    '/sales/contracts/' +
    encodeURIComponent(salesContractId) +
    '/travel-documents/branding-logo';
  const options = {
    credentials: 'include' as const,
    cache: 'no-store' as const,
  };
  let response = await fetch(url, options);
  if (response.status === 401 && (await refreshAuthenticatedSession()))
    response = await fetch(url, options);
  if (!response.ok) throw new Error('لوگوی مدرک در دسترس نیست.');
  return { blob: await response.blob() };
}
export function useTravelLogo(
  branding: TravelBrandingV1 | null,
  withoutLogo = false,
  salesContractId?: string,
) {
  const [loaded, setLoaded] = useState<{
    id: string;
    logo: string;
    error: string;
  }>();
  const fileId =
    withoutLogo ||
    (branding?.kind === 'OWN' &&
      ['JAHAN_BASTAN', 'GHESATI_RO'].includes(branding.companyCode ?? ''))
      ? null
      : branding?.logoFileId;
  const contextKey = `${salesContractId ?? ''}:${fileId ?? ''}`;
  useEffect(() => {
    if (!fileId) return;
    let active = true;
    let url = '';
    void readTravelLogo(fileId, salesContractId)
      .then(({ blob }) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setLoaded({ id: contextKey, logo: url, error: '' });
      })
      .catch(() => {
        if (active)
          setLoaded({
            id: contextKey,
            logo: '',
            error:
              'لوگوی سربرگ در دسترس نیست؛ خروجی تا دریافت لوگو آماده نمی‌شود.',
          });
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId, salesContractId, contextKey]);
  if (withoutLogo) return { logo: '', error: '' };
  if (fileId)
    return loaded?.id === contextKey ? loaded : { logo: '', error: '' };
  if (!branding) return { logo: '', error: '' };
  if (branding.kind === 'OWN' && branding.companyCode === 'NIYAYESH_SEIR_SAHAR')
    return { logo: '/brand/niyayesh-seir-full.png', error: '' };
  if (branding.kind === 'OWN' && branding.companyCode === 'JAHAN_BASTAN')
    return { logo: '/brand/jahan-bastan-transparent.png', error: '' };
  if (branding.kind === 'OWN' && branding.companyCode === 'GHESATI_RO')
    return { logo: '/brand/ghesati-ro.png', error: '' };
  return { logo: '', error: 'برای شرکت انتخاب‌شده لوگو ثبت نشده است.' };
}

export function TravelDocument({
  intake: sourceIntake,
  formScope = 'HOTEL',
  voucher = false,
  historical = false,
  previewSettings: sourcePreviewSettings,
  dirty = false,
  downloadLabel,
  salesContractId,
  unbranded = false,
}: {
  intake: ReservationFormIntake;
  formScope?: SupplierDocumentKind;
  voucher?: boolean;
  historical?: boolean;
  previewSettings?: VoucherSettingsV1 | undefined;
  dirty?: boolean;
  downloadLabel?: string;
  salesContractId?: string;
  unbranded?: boolean;
}) {
  const intake = voucher
    ? { ...sourceIntake, unbranded }
    : supplierDocumentScope(sourceIntake, formScope, sourcePreviewSettings);
  const previewSettings =
    sourcePreviewSettings && !voucher
      ? intake.workflow.supplierFormSettings
      : undefined;
  const { logo, error } = useTravelLogo(
    intake.workflow.branding,
    voucher &&
      (unbranded || intake.workflow.branding?.voucherWithoutLogo === true),
    salesContractId,
  );
  const [printError, setPrintError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const state = intake.workflow;
  const formReferences = useReservationFormReferences(
    intake,
    true,
    salesContractId,
  );
  const savedSupplier = state.supplierFormSettings?.text.broker?.trim() ?? '';
  const supplierReady =
    !reservationHasTransfer(intake.snapshot) ||
    historical ||
    (voucher && isFloatingSalesContract(intake.snapshot.serviceSelections)) ||
    (voucher
      ? !!state.voucherSettings?.brokerId && !!state.voucherSettings?.leaderId
      : !!(previewSettings ?? state.supplierFormSettings)?.brokerId &&
        !!(
          (
            previewSettings ?? state.supplierFormSettings
          )?.text.broker?.trim() || savedSupplier
        ));
  const enabled =
    ((voucher && unbranded) ||
      !!logo ||
      (voucher && state.branding?.voucherWithoutLogo === true) ||
      (voucher && state.voucherSettings?.flags.withLetterhead === false)) &&
    !!state.branding &&
    state.supplierStatus !== 'CANCELLED' &&
    (!voucher || state.voucherIssued);
  const previewIntake =
    previewSettings && !voucher
      ? {
          ...intake,
          workflow: { ...state, supplierFormSettings: previewSettings },
        }
      : intake;
  const publicDocument = usePublicDocumentLink(
    !unbranded && !historical && enabled && supplierReady && !dirty
      ? '/reservations/requests/' +
          encodeURIComponent(intake.id) +
          '/pdf?' +
          new URLSearchParams({
            ...(voucher ? { kind: 'voucher' } : {}),
            ...(voucher && salesContractId ? { salesContractId } : {}),
            ...(!voucher && formScope !== 'HOTEL' ? { formScope } : {}),
            ...(!voucher && intake.hotelStayKey
              ? { hotelStayKey: intake.hotelStayKey }
              : {}),
          })
      : undefined,
    JSON.stringify([state, intake.snapshot]),
  );
  const sheet = (
    <ReservationFormSheet
      intake={previewIntake}
      logo={logo}
      references={formReferences.references}
      voucher={voucher}
      publicDocumentUrl={unbranded ? undefined : publicDocument?.url}
    />
  );
  async function downloadPdf() {
    if (downloading || !enabled || !supplierReady || dirty) return;
    setDownloading(true);
    setPrintError('');
    try {
      const send = () =>
        fetch(
          `/reservations/requests/${encodeURIComponent(intake.id)}/pdf?${new URLSearchParams({ ...(voucher ? { kind: 'voucher' } : {}), ...(voucher && unbranded ? { unbranded: 'true' } : {}), ...(voucher && salesContractId ? { salesContractId } : {}), ...(!voucher && formScope !== 'HOTEL' ? { formScope } : {}), ...(!voucher && intake.hotelStayKey ? { hotelStayKey: intake.hotelStayKey } : {}) })}`,
          {
            credentials: 'include',
            cache: 'no-store',
          },
        );
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
      link.download = `${voucher ? 'hotel-voucher' : formScope === 'HOTEL' ? 'reservation-form' : 'transfer-' + formScope.toLowerCase()}-${intake.snapshot.contractNumber.replace(/[^A-Za-z0-9_-]/g, '_')}${!voucher && intake.hotelStayKey ? '-' + (intake.snapshot.hotelSelection?.hotelNameSnapshot ?? intake.hotelStayKey).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60) : ''}.pdf`;
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
      {!historical && (
        <Button
          disabled={downloading || !enabled || !supplierReady || dirty}
          onClick={() => void downloadPdf()}
        >
          {downloading
            ? 'در حال آماده‌سازی PDF…'
            : (downloadLabel ??
              (voucher ? 'دانلود واچر' : 'دانلود مستقیم PDF فرم رزرواسیون'))}
        </Button>
      )}
      {formReferences.failed && (
        <p role="status">
          برخی اطلاعات تکمیلی مرجع دریافت نشد؛ فیلدهای خالی را پیش از ارسال
          بررسی کنید.
        </p>
      )}
      {enabled &&
        supplierReady &&
        (unbranded ||
        historical ||
        dirty ||
        publicDocument?.status === 'ready' ||
        publicDocument?.status === 'disabled' ? (
          <DocumentPreview>{sheet}</DocumentPreview>
        ) : (
          <p role="status">
            {publicDocument?.status === 'failed'
              ? 'آماده‌سازی بارکد انجام نشد؛ دوباره فرم را باز کنید.'
              : 'در حال آماده‌سازی بارکد مدرک…'}
          </p>
        ))}
    </div>
  );
}

export function SupplierHotelDocuments(
  props: Omit<Parameters<typeof TravelDocument>[0], 'voucher'>,
) {
  const stays = reservationHotelStays(props.intake.snapshot);
  if (!stays.length) return <TravelDocument {...props} />;
  const primary = hotelFormScope(props.intake, stays[0]!.key);
  if (primary.workflow.sentSupplierFormSettings)
    primary.workflow.supplierFormSettings =
      primary.workflow.sentSupplierFormSettings;
  const grouped = sharedHotelSupplierScopes(primary).length > 1;
  return (
    <div className="grid gap-4">
      {stays
        .filter(
          (stay, index) =>
            !index ||
            !grouped ||
            supplierDocumentKinds(
              props.intake.workflow.hotelSupplierForms?.[stay.key]
                ?.sentSettings ??
                props.intake.workflow.hotelSupplierForms?.[stay.key]?.settings,
            ).some((kind) => kind !== 'HOTEL'),
        )
        .map((stay) => {
          const intake = hotelFormScope(props.intake, stay.key);
          if (intake.workflow.sentSupplierFormSettings)
            intake.workflow.supplierFormSettings =
              intake.workflow.sentSupplierFormSettings;
          return (
            <section key={stay.key} className="grid gap-2">
              <h3>{stay.hotel.hotelNameSnapshot}</h3>
              <SupplierScopedDocuments
                {...props}
                intake={intake}
                omitHotel={grouped && stay.key !== stays[0]!.key}
              />
            </section>
          );
        })}
    </div>
  );
}

export function SupplierScopedDocuments({
  omitHotel,
  ...props
}: Omit<Parameters<typeof TravelDocument>[0], 'voucher' | 'formScope'> & {
  omitHotel?: boolean;
}) {
  const settings =
    props.previewSettings ?? props.intake.workflow.supplierFormSettings;
  return (
    <div className="grid gap-4">
      {supplierDocumentKinds(settings)
        .filter((kind) => !omitHotel || kind !== 'HOTEL')
        .map((kind) => (
          <section key={kind} className="grid gap-2">
            {kind !== 'HOTEL' && (
              <h3>
                {kind === 'OUTBOUND'
                  ? 'فرم ترانسفر رفت'
                  : kind === 'RETURN'
                    ? 'فرم ترانسفر برگشت'
                    : 'فرم جداگانه ترانسفر'}
              </h3>
            )}
            <TravelDocument {...props} formScope={kind} />
          </section>
        ))}
    </div>
  );
}
