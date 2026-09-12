import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  MasterDataRecord,
  ReservationIntakeV1,
  TravelWorkflowStateV1,
} from '@rubi/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { reservationTickets } from '@/modules/reservations/model/reservation-tickets';
import { ticketPdfHtml } from '@/modules/reservations/server/ticket-pdf-html';
import { renderTicketPdf } from '@/modules/reservations/server/ticket-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const responseHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (message: string, status: number) =>
  Response.json({ message }, { status, headers: responseHeaders });

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!uuid.test(id)) return fail('شناسه درخواست معتبر نیست.', 400);
  const parameters = new URL(request.url).searchParams;
  const passengerId = parameters.get('passengerId');
  const salesContractId = parameters.get('salesContractId');
  if (passengerId && !uuid.test(passengerId))
    return fail('شناسه مسافر معتبر نیست.', 400);
  if (salesContractId && !uuid.test(salesContractId))
    return fail('شناسه قرارداد معتبر نیست.', 400);
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
    const workflowResponse = await get(
      salesContractId
        ? `/sales/contracts/${salesContractId}/travel-documents`
        : `/reservations/requests/${id}/workflow`,
    );
    if (!workflowResponse.ok)
      return fail(
        salesContractId
          ? 'دریافت بلیط در فروش تا تأیید تحویل مدارک توسط مالی مجاز نیست.'
          : 'دریافت بلیط مجاز نیست؛ نشست و دسترسی رزرواسیون را بررسی کنید.',
        workflowResponse.status,
      );
    const { data: intake } = (await workflowResponse.json()) as {
      data: ReservationIntakeV1 & { workflow: TravelWorkflowStateV1 };
    };
    if (salesContractId && intake.id !== id)
      return fail('قرارداد فروش با درخواست رزرواسیون مطابقت ندارد.', 403);
    const branding = intake.workflow.branding;
    if (!branding) return fail('ابتدا سربرگ خروجی را ثبت کنید.', 400);
    if (intake.workflow.supplierStatus === 'CANCELLED')
      return fail('درخواست ابطال شده است.', 409);
    const allTickets = reservationTickets(intake.snapshot);
    const tickets = passengerId
      ? allTickets.filter((ticket) => ticket.passengerId === passengerId)
      : allTickets;
    if (!tickets.length)
      return fail('اطلاعات پرواز و تخصیص بلیط این مسافر موجود نیست.', 409);

    const cityIds = [
      ...new Set(
        tickets.flatMap(({ offers }) =>
          offers.flatMap(({ originId, destinationId }) => [
            originId,
            destinationId,
          ]),
        ),
      ),
    ];
    const cityNames: Record<string, string> = {};
    await Promise.all(
      cityIds.map(async (cityId) => {
        const response = await get(
          `/master-data/cities/${encodeURIComponent(cityId)}`,
        );
        if (!response.ok) return;
        const { data } = (await response.json()) as { data: MasterDataRecord };
        cityNames[cityId] = String(
          data.attributes.englishName || data.name || '—',
        );
      }),
    );

    let logoDataUrl: string;
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
      logoDataUrl = `data:${mime};base64,${bytes.toString('base64')}`;
    } else {
      const asset =
        branding.kind === 'OWN'
          ? (
              {
                NIYAYESH_SEIR_SAHAR: 'niyayesh.png',
                JAHAN_BASTAN: 'jahan-bastan-horizontal.png',
              } as Record<string, string>
            )[branding.companyCode ?? '']
          : undefined;
      if (!asset) return fail('لوگوی سربرگ انتخاب‌شده ثبت نشده است.', 400);
      logoDataUrl =
        'data:image/png;base64,' +
        (await readFile(join(process.cwd(), 'public/brand', asset))).toString(
          'base64',
        );
    }
    const html = ticketPdfHtml(tickets, cityNames, {
      name: branding.name,
      logoDataUrl,
    });
    const bytes = await renderTicketPdf(html);
    const name = intake.snapshot.contractNumber.replace(/[^A-Za-z0-9_-]/g, '_');
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...responseHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="tickets-${name}${passengerId ? '-passenger' : '-all'}.pdf"`,
      },
    });
  } catch (error) {
    const busy = error instanceof Error && error.message === 'PDF_BUSY';
    return fail(
      busy
        ? 'خروجی دیگری در حال آماده‌سازی است؛ دوباره تلاش کنید.'
        : 'PDF بلیط آماده نشد؛ اتصال و تنظیمات موتور PDF را بررسی کنید.',
      busy ? 429 : 503,
    );
  }
}
