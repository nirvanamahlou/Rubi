import { reservationHasTransfer } from '@nora/contracts';
import { createHash, createHmac } from 'node:crypto';
import {
  supplierDocumentScope,
  type SupplierDocumentKind,
} from '@/modules/reservations/model/supplier-document-scope';
import { reservationHotelStays } from '@nora/contracts';
import { isFloatingSalesContract } from '@nora/contracts';
import { hotelFormScope } from '@/modules/reservations/model/hotel-form-scope';
import { loadOutputReferences } from '@/modules/reservations/model/output-references';
import { salesContractFlights } from '@nora/contracts';
import { languageFromCookies } from '@/i18n/language';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPublicApiBaseUrl } from '@/lib/environment';
import type { MasterDataRecord } from '@nora/contracts';
import type {
  ReservationFormIntake,
  ReservationFormReferences,
} from '@/modules/reservations/model/reservation-form';
import { createPublicDocument } from '@/modules/travel-documents/server/public-document-store';
import {
  renderReservationPdf,
  prepareReservationHtml,
} from '@/modules/reservations/server/reservation-pdf';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};
const fail = (message: string, status: number) =>
  Response.json({ message }, { status, headers });
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return buildPdf(request, context);
}
async function buildPdf(
  request: Request,
  context: { params: Promise<{ id: string }> },
  mailVersion?: number,
) {
  const { id } = await context.params;
  const parameters = new URL(request.url).searchParams;
  const salesContractId = parameters.get('salesContractId');
  if (
    salesContractId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      salesContractId,
    )
  )
    return fail('شناسه قرارداد معتبر نیست.', 400);
  const kind = parameters.get('kind');
  if (kind && kind !== 'voucher') return fail('نوع سند معتبر نیست.', 400);
  const voucher = kind === 'voucher';
  if (salesContractId && !voucher) return fail('نوع سند معتبر نیست.', 400);
  const formScope =
    new URL(request.url).searchParams.get('formScope') ?? 'HOTEL';
  if (
    !['HOTEL', 'TRANSFER', 'OUTBOUND', 'RETURN'].includes(formScope) ||
    (voucher && formScope !== 'HOTEL')
  )
    return fail('نوع سند معتبر نیست.', 400);
  const hotelStayKey = new URL(request.url).searchParams.get('hotelStayKey');
  if (voucher && hotelStayKey) return fail('نوع سند معتبر نیست.', 400);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return fail('شناسه درخواست معتبر نیست.', 400);
  const base = getPublicApiBaseUrl();
  if (!base) return fail('سرویس PDF پیکربندی نشده است.', 503);
  const get = (path: string) =>
    fetch(
      base +
        (path.startsWith('/master-data/')
          ? path.replace(
              '/master-data/',
              `/master-data/selections/${salesContractId ? 'sales' : 'reservations'}/`,
            )
          : path),
      {
        headers: { cookie: request.headers.get('cookie') ?? '' },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      },
    );
  try {
    const response = await get(
      salesContractId
        ? `/sales/contracts/${salesContractId}/travel-documents`
        : `/reservations/requests/${id}/workflow`,
    );
    if (!response.ok)
      return fail(
        'دریافت فرم مجاز نیست؛ نشست و دسترسی رزرواسیون را بررسی کنید.',
        response.status,
      );
    const { data: rawIntake } = (await response.json()) as {
      data: ReservationFormIntake;
    };
    if (mailVersion !== undefined && rawIntake.workflow.version !== mailVersion)
      return fail('اطلاعات هم‌زمان تغییر کرده است؛ دوباره بارگذاری کنید.', 409);
    if (
      salesContractId &&
      (rawIntake.id !== id || rawIntake.snapshot.contractId !== salesContractId)
    )
      return fail('قرارداد فروش با درخواست رزرواسیون مطابقت ندارد.', 403);
    let intake: ReservationFormIntake =
      voucher && parameters.get('unbranded') === 'true'
        ? { ...rawIntake, unbranded: true }
        : rawIntake;
    if (hotelStayKey) {
      try {
        intake = hotelFormScope(rawIntake, hotelStayKey);
      } catch {
        return fail('اقامت هتل معتبر نیست.', 400);
      }
    }
    if (
      !voucher &&
      mailVersion === undefined &&
      intake.workflow.sentSupplierFormSettings
    ) {
      intake.workflow.supplierFormSettings =
        intake.workflow.sentSupplierFormSettings;
    }
    if (!voucher) {
      try {
        intake = supplierDocumentScope(
          intake,
          formScope as SupplierDocumentKind,
        );
      } catch {
        return fail('نوع سند معتبر نیست.', 400);
      }
    }
    if (voucher && !intake.workflow.voucherIssued)
      return fail('واچر هنوز صادر نشده است.', 409);
    if (
      voucher &&
      !isFloatingSalesContract(intake.snapshot.serviceSelections) &&
      reservationHasTransfer(intake.snapshot) &&
      (!intake.workflow.voucherSettings?.brokerId ||
        !intake.workflow.voucherSettings?.leaderId)
    )
      return fail('ابتدا کارگزار و تورلیدر واچر را انتخاب کنید.', 409);
    if (
      !voucher &&
      reservationHasTransfer(intake.snapshot) &&
      (!intake.workflow.supplierFormSettings?.brokerId ||
        !intake.workflow.supplierFormSettings?.text.broker?.trim())
    )
      return fail(
        'پیش از صدور فرم رزرواسیون، نام کارگزار گیرنده را ثبت کنید.',
        409,
      );
    const branding = intake.workflow.branding;
    if (!branding) return fail('ابتدا سربرگ فرم را ثبت کنید.', 400);
    if (intake.workflow.supplierStatus === 'CANCELLED')
      return fail('درخواست ابطال شده است.', 409);
    let logo: string;
    if (
      voucher &&
      (intake.unbranded ||
        branding.voucherWithoutLogo === true ||
        intake.workflow.voucherSettings?.flags.withLetterhead === false)
    ) {
      logo = '';
    } else if (
      branding.logoFileId &&
      !(
        branding.kind === 'OWN' &&
        ['JAHAN_BASTAN', 'GHESATI_RO'].includes(branding.companyCode ?? '')
      )
    ) {
      const logoResponse = await get(
        salesContractId
          ? `/sales/contracts/${salesContractId}/travel-documents/branding-logo`
          : `/documents/${encodeURIComponent(branding.logoFileId)}/preview`,
      );
      if (salesContractId && [403, 404].includes(logoResponse.status)) {
        // A legacy brand asset can be unavailable independently of the contract.
        logo = '';
      } else {
        if (!logoResponse.ok)
          return fail(
            'دریافت لوگوی سربرگ مجاز نیست یا لوگو آماده نیست.',
            logoResponse.status,
          );
        const mime = logoResponse.headers.get('content-type')?.split(';')[0];
        if (!mime || !['image/png', 'image/jpeg', 'image/webp'].includes(mime))
          return fail('فرمت لوگو برای PDF پشتیبانی نمی‌شود.', 400);
        const bytes = Buffer.from(await logoResponse.arrayBuffer());
        if (!bytes.length || bytes.length > 5_000_000)
          return fail('اندازه لوگو معتبر نیست.', 400);
        logo = `data:${mime};base64,${bytes.toString('base64')}`;
      }
    } else {
      const asset =
        branding.kind === 'OWN'
          ? (
              {
                NIYAYESH_SEIR_SAHAR: 'niyayesh.png',
                JAHAN_BASTAN: 'jahan-bastan-transparent.png',
                GHESATI_RO: 'ghesati-ro.png',
              } as Record<string, string>
            )[branding.companyCode ?? '']
          : undefined;
      if (!asset) return fail('لوگوی سربرگ انتخاب‌شده ثبت نشده است.', 400);
      logo =
        'data:image/png;base64,' +
        (await readFile(join(process.cwd(), 'public/brand', asset))).toString(
          'base64',
        );
    }
    const refs: ReservationFormReferences = await loadOutputReferences(
      async (path) => {
        const response = await get(path);
        return response.ok ? response.json() : {};
      },
      id,
    );
    const referenceSnapshot =
      intake.workflow.supplierFormSettings?.sharedHotelBroker === true
        ? (intake.supplierHotelSourceSnapshot ?? intake.snapshot)
        : intake.snapshot;
    const hotels = reservationHotelStays(referenceSnapshot).map(
      (stay) => stay.hotel,
    );
    const keys = [
      ...hotels.flatMap((hotel) => [
        ['hotels', hotel.hotelId],
        ['cities', hotel.cityId],
        ['room-types', hotel.roomTypeId],
        ...(hotel.rooms ?? []).map((r) => ['room-types', r.roomTypeId]),
        ['meal-services', hotel.mealServiceId],
      ]),
      ...(!hotels.length
        ? [['cities', intake.snapshot.ticketSelections?.[0]?.destinationId]]
        : []),
    ];
    await Promise.all(
      keys.map(async ([resource, key]) => {
        if (!key) return;
        const r = await get(
          `/master-data/${resource}/${encodeURIComponent(key)}`,
        );
        if (r.ok) {
          const { data } = (await r.json()) as { data: MasterDataRecord };
          refs[key] = data;
        }
      }),
    );
    const airlineNames = new Set(
      salesContractFlights(
        intake.snapshot.serviceSelections,
        intake.snapshot.ticketSelections ?? [],
      ).map((ticket) => ticket.carrierNameSnapshot),
    );
    for (const name of airlineNames) {
      const response = await get(
        '/master-data/airlines?search=' +
          encodeURIComponent(name) +
          '&page=1&pageSize=100',
      );
      if (response.ok) {
        const result = (await response.json()) as { data: MasterDataRecord[] };
        const record = result.data.find((item) =>
          [item.name, item.attributes.englishName].includes(name),
        );
        if (record) refs[name] = record;
      }
    }
    const css = await readFile(
      join(
        process.cwd(),
        'src/modules/reservations/components/reservation-form-sheet.module.css',
      ),
      'utf8',
    );
    const share = intake.unbranded ? undefined : createPublicDocument();
    const language = languageFromCookies(request.headers.get('cookie'));
    if (share) {
      const html = await prepareReservationHtml(
        intake,
        refs,
        logo,
        css,
        voucher,
        '',
        language,
        share.url,
      );
      await share.save(html);
      if (new URL(request.url).searchParams.get('format') === 'share')
        return Response.json({ url: share.url, html }, { headers });
    } else if (new URL(request.url).searchParams.get('format') === 'share')
      return Response.json(
        {
          message: 'Public documents unavailable',
          code: 'PUBLIC_DOCUMENTS_DISABLED',
        },
        { status: 503, headers },
      );
    const bytes = await renderReservationPdf(
      intake,
      refs,
      logo,
      css,
      voucher,
      new URL(request.url).origin,
      language,
      share?.url,
    );
    const name = intake.snapshot.contractNumber.replace(/[^A-Za-z0-9_-]/g, '_');
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...headers,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${voucher ? 'hotel-voucher' : 'reservation-form'}-${name}.pdf"`,
      },
    });
  } catch (error) {
    const busy = error instanceof Error && error.message === 'PDF_BUSY';
    return fail(
      busy
        ? 'خروجی دیگری در حال آماده‌سازی است؛ دوباره تلاش کنید.'
        : 'PDF آماده نشد؛ اتصال، مسیر Chrome و فونت خروجی را بررسی کنید.',
      busy ? 429 : 503,
    );
  }
}

/** Only a saved authorized form is rendered here. Browser-supplied PDF/HTML is never accepted. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') !== origin)
    return fail('دسترسی به این عملیات مجاز نیست.', 403);
  const secret = process.env.RESERVATION_PDF_MAIL_SECRET;
  if (!secret || secret.length < 32)
    return fail('اتصال ایمیل رزرواسیون شرکت هنوز آماده نشده است.', 503);
  const { id } = await context.params;
  let body: { expectedVersion?: unknown; hotelStayKey?: unknown };
  try {
    const reader = request.body?.getReader();
    if (!reader) return fail('درخواست معتبر نیست.', 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 2048) {
        await reader.cancel();
        return fail('درخواست معتبر نیست.', 400);
      }
      chunks.push(part.value);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    body = JSON.parse(raw);
    if (
      !body ||
      !Number.isSafeInteger(body.expectedVersion) ||
      Number(body.expectedVersion) < 0 ||
      (body.hotelStayKey !== undefined &&
        (typeof body.hotelStayKey !== 'string' ||
          body.hotelStayKey.length > 200))
    )
      return fail('درخواست معتبر نیست.', 400);
  } catch {
    return fail('درخواست معتبر نیست.', 400);
  }
  const version = body.expectedVersion as number;
  const scope = typeof body.hotelStayKey === 'string' ? body.hotelStayKey : '';
  const url = new URL(
    `/reservations/requests/${encodeURIComponent(id)}/pdf`,
    origin,
  );
  if (scope) url.searchParams.set('hotelStayKey', scope);
  const rendered = await buildPdf(
    new Request(url, {
      headers: { cookie: request.headers.get('cookie') ?? '' },
    }),
    context,
    version,
  );
  if (!rendered.ok) return rendered;
  const bytes = Buffer.from(await rendered.arrayBuffer());
  if (bytes.length > 10_000_000 || bytes.subarray(0, 5).toString() !== '%PDF-')
    return fail('PDF معتبر فرم رزرواسیون برای ارسال دریافت نشد.', 503);
  const signature = createHmac('sha256', secret)
    .update(
      JSON.stringify([
        'reservation-pdf-v1',
        id,
        version,
        scope,
        createHash('sha256').update(bytes).digest('hex'),
      ]),
    )
    .digest('hex');
  const form = new FormData();
  form.set('expectedVersion', String(version));
  if (scope) form.set('hotelStayKey', scope);
  form.set(
    'pdf',
    new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
    'reservation-form.pdf',
  );
  const base = getPublicApiBaseUrl();
  try {
    const sent = await fetch(
      `${base}/reservations/requests/${encodeURIComponent(id)}/supplier-email`,
      {
        method: 'POST',
        headers: {
          cookie: request.headers.get('cookie') ?? '',
          'x-reservation-pdf-signature': signature,
        },
        body: form,
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
      },
    );
    return new Response(await sent.text(), {
      status: sent.status,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch {
    return fail('عملیات انجام نشد؛ مجوز و اتصال را بررسی کنید.', 503);
  }
}
