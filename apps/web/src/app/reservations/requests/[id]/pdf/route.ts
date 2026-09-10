import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPublicApiBaseUrl } from '@/lib/environment';
import type { MasterDataRecord } from '@rubi/contracts';
import type {
  ReservationFormIntake,
  ReservationFormReferences,
} from '@/modules/reservations/model/reservation-form';
import { renderReservationPdf } from '@/modules/reservations/server/reservation-pdf';
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
    const { data: intake } = (await response.json()) as {
      data: ReservationFormIntake;
    };
    const branding = intake.workflow.branding;
    if (!branding) return fail('ابتدا سربرگ فرم را ثبت کنید.', 400);
    if (intake.workflow.supplierStatus === 'CANCELLED')
      return fail('درخواست ابطال شده است.', 409);
    let logo: string;
    if (branding.logoFileId) {
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
                NIYAYESH_SEIR_SAHAR: 'niyayesh-seir-full.png',
                JAHAN_BASTAN: 'jahan-bastan-horizontal.png',
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
    const refs: ReservationFormReferences = {};
    const hotel = intake.snapshot.hotelSelection;
    const keys = [
      ['hotels', hotel?.hotelId],
      [
        'cities',
        hotel?.cityId ?? intake.snapshot.ticketSelections?.[0]?.destinationId,
      ],
      ['room-types', hotel?.roomTypeId],
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
    const css = await readFile(
      join(
        process.cwd(),
        'src/modules/reservations/components/reservation-form-sheet.module.css',
      ),
      'utf8',
    );
    const bytes = await renderReservationPdf(intake, refs, logo, css);
    const name = intake.snapshot.contractNumber.replace(/[^A-Za-z0-9_-]/g, '_');
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...headers,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="reservation-form-${name}.pdf"`,
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
