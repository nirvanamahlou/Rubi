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
  const { id } = await context.params;
  const kind = new URL(request.url).searchParams.get('kind');
  if (kind && kind !== 'voucher') return fail('نوع سند معتبر نیست.', 400);
  const voucher = kind === 'voucher';
  const hotelStayKey = new URL(request.url).searchParams.get('hotelStayKey');
  if (voucher && hotelStayKey) return fail('نوع سند معتبر نیست.', 400);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return fail('شناسه درخواست معتبر نیست.', 400);
  const base = getPublicApiBaseUrl();
  if (!base) return fail('سرویس PDF پیکربندی نشده است.', 503);
  const get = (path: string) =>
    fetch(base + path, {
      headers: { cookie: request.headers.get('cookie') ?? '' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
  try {
    const response = await get(`/reservations/requests/${id}/workflow`);
    if (!response.ok)
      return fail(
        'دریافت فرم مجاز نیست؛ نشست و دسترسی رزرواسیون را بررسی کنید.',
        response.status,
      );
    const { data: rawIntake } = (await response.json()) as {
      data: ReservationFormIntake;
    };
    let intake = rawIntake;
    if (hotelStayKey) {
      try {
        intake = hotelFormScope(rawIntake, hotelStayKey);
      } catch {
        return fail('اقامت هتل معتبر نیست.', 400);
      }
    }
    if (!voucher && intake.workflow.sentSupplierFormSettings) {
      intake.workflow.supplierFormSettings =
        intake.workflow.sentSupplierFormSettings;
    }
    if (voucher && !intake.workflow.voucherIssued)
      return fail('واچر هنوز صادر نشده است.', 409);
    if (
      voucher &&
      (!intake.workflow.voucherSettings?.brokerId ||
        !intake.workflow.voucherSettings?.leaderId)
    )
      return fail('ابتدا کارگزار و تورلیدر واچر را انتخاب کنید.', 409);
    if (
      !voucher &&
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
      intake.workflow.voucherSettings?.flags.withLetterhead === false
    ) {
      logo = '';
    } else if (
      branding.logoFileId &&
      !(branding.kind === 'OWN' && branding.companyCode === 'JAHAN_BASTAN')
    ) {
      const logoResponse = await get(
        `/documents/${encodeURIComponent(branding.logoFileId)}/preview`,
      );
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
    } else {
      const asset =
        branding.kind === 'OWN'
          ? (
              {
                NIYAYESH_SEIR_SAHAR: 'niyayesh.png',
                JAHAN_BASTAN: 'jahan-bastan-transparent.png',
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
    const hotel = intake.snapshot.hotelSelection;
    const keys = [
      ['hotels', hotel?.hotelId],
      [
        'cities',
        hotel?.cityId ?? intake.snapshot.ticketSelections?.[0]?.destinationId,
      ],
      ['room-types', hotel?.roomTypeId],
      ...(hotel?.rooms ?? []).map((r) => ['room-types', r.roomTypeId]),
      ['meal-services', hotel?.mealServiceId],
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
    const share = createPublicDocument();
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
