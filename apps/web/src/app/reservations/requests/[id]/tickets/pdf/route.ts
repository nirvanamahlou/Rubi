import type {
  MasterDataListResponse,
  MasterDataRecord,
  ReservationIntakeV1,
  TravelWorkflowStateV1,
} from '@nora/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { reservationTickets } from '@/modules/reservations/model/reservation-tickets';
import { readTicketBrandAsset } from '@/modules/reservations/server/ticket-pdf-assets';
import { ticketPdfHtml } from '@/modules/reservations/server/ticket-pdf-html';
import { renderTicketPdf } from '@/modules/reservations/server/ticket-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const responseHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const carrierKey = (value: string) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replaceAll('ي', 'ی')
    .replaceAll('ك', 'ک')
    .replace(/[^\p{L}\p{N}]/gu, '');
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
    let passengerNames: Record<string, string> = {};
    if (
      intake.snapshot.passengerAssignments?.some(
        (passenger) => !passenger.displayNameSnapshot?.trim(),
      )
    ) {
      const passengersResponse = await get(
        `/reservations/requests/${id}/passengers`,
      ).catch(() => null);
      if (passengersResponse?.ok) {
        const result = (await passengersResponse.json()) as {
          data?: Array<{ id: string; displayName: string }>;
        };
        passengerNames = Object.fromEntries(
          (result.data ?? []).map((passenger) => [
            passenger.id,
            passenger.displayName,
          ]),
        );
      }
    }
    const allTickets = reservationTickets(intake.snapshot, passengerNames);
    const tickets = passengerId
      ? allTickets.filter((ticket) => ticket.passengerId === passengerId)
      : allTickets;
    if (!tickets.length)
      return fail('اطلاعات پرواز و تخصیص بلیط این مسافر موجود نیست.', 409);

    // The passenger file is the current source of gender and spelling. A snapshot
    // remains usable if that separate read is unavailable to this actor.
    const passengerResponse = await get(
      `/reservations/requests/${id}/passengers`,
    ).catch(() => null);
    if (passengerResponse?.ok) {
      const body = (await passengerResponse.json().catch(() => null)) as {
        data?: readonly {
          id: string;
          displayName?: string;
          passportFirstName?: string | null;
          passportLastName?: string | null;
          gender?: 'M' | 'F' | null;
        }[];
      } | null;
      if (Array.isArray(body?.data))
        for (const ticket of tickets) {
          const person = body.data.find(
            (item) => item.id === ticket.passengerId,
          );
          if (!person) continue;
          const passportName = [
            person.passportFirstName,
            person.passportLastName,
          ]
            .map((part) => part?.trim())
            .filter(Boolean)
            .join(' ');
          if (passportName) ticket.passengerName = passportName;
          else if (person.displayName?.trim())
            ticket.passengerName = person.displayName.trim();
          if (person.gender === 'M' || person.gender === 'F')
            ticket.gender = person.gender;
        }
    }

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
    const cityNames: Record<string, { name: string; code: string }> = {};
    await Promise.all(
      cityIds.map(async (cityId) => {
        const response = await get(
          `/master-data/cities/${encodeURIComponent(cityId)}`,
        ).catch(() => null);
        if (!response?.ok) return;
        const body = (await response.json().catch(() => null)) as {
          data: MasterDataRecord;
        } | null;
        const data = body?.data;
        if (!data) return;
        cityNames[cityId] = {
          name: String(data.attributes.englishName || data.name || '—'),
          code: /^[A-Z]{3}$/.test(data.code || '') ? data.code : '',
        };
      }),
    );

    const airlineLogos: Record<string, { name: string; logoDataUrl?: string }> =
      {};
    const carrierNames = [
      ...new Set(
        tickets.flatMap(({ offers }) =>
          offers.map(({ carrierName }) => carrierName),
        ),
      ),
    ];
    await Promise.all(
      carrierNames.map(async (carrierName) => {
        const query = new URLSearchParams({
          search: carrierName,
          status: 'active',
          page: '1',
          pageSize: '25',
        });
        const response = await get(`/master-data/airlines?${query}`).catch(
          () => null,
        );
        if (!response?.ok) return;
        const body = (await response
          .json()
          .catch(() => null)) as MasterDataListResponse | null;
        if (!Array.isArray(body?.data)) return;
        const matchesCarrier = (item: MasterDataRecord) =>
          [item.name, item.attributes.englishName, item.code].some(
            (value) =>
              typeof value === 'string' &&
              carrierKey(value) === carrierKey(carrierName),
          );
        let airline = body.data.find(matchesCarrier);
        if (!airline) {
          const fallback = await get(
            '/master-data/airlines?status=active&page=1&pageSize=100',
          ).catch(() => null);
          if (fallback?.ok) {
            const result = (await fallback
              .json()
              .catch(() => null)) as MasterDataListResponse | null;
            airline = result?.data.find(matchesCarrier);
          }
        }
        if (!airline) return;
        airlineLogos[carrierName] = {
          name: String(airline.attributes.englishName || airline.name),
        };
        const logoId = airline.attributes.logoFileReference;
        if (typeof logoId !== 'string' || !uuid.test(logoId)) return;
        const logo = await get(`/documents/${logoId}/preview`).catch(
          () => null,
        );
        if (!logo?.ok) return;
        const mime = logo.headers.get('content-type')?.split(';')[0];
        if (!mime || !['image/png', 'image/jpeg', 'image/webp'].includes(mime))
          return;
        const bytes = Buffer.from(await logo.arrayBuffer());
        if (!bytes.length || bytes.length > 5_000_000) return;
        airlineLogos[carrierName].logoDataUrl =
          `data:${mime};base64,${bytes.toString('base64')}`;
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
                NIYAYESH_SEIR_SAHAR: 'niyayesh-seir-full.png',
                JAHAN_BASTAN: 'jahan-bastan-horizontal.png',
              } as Record<string, string>
            )[branding.companyCode ?? '']
          : undefined;
      if (!asset) return fail('لوگوی سربرگ انتخاب‌شده ثبت نشده است.', 400);
      logoDataUrl =
        'data:image/png;base64,' +
        (await readTicketBrandAsset(asset)).toString('base64');
    }
    const html = ticketPdfHtml(
      tickets,
      cityNames,
      {
        name: branding.name,
        logoDataUrl,
        companyCode: branding.companyCode ?? '',
      },
      airlineLogos,
    );
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
    const code = error instanceof Error ? error.message : '';
    const busy = code === 'PDF_BUSY';
    const runtimeUnavailable = code === 'PDF_RUNTIME_UNAVAILABLE';
    const brandAssetUnavailable = code === 'PDF_BRAND_ASSET_UNAVAILABLE';
    return fail(
      busy
        ? 'خروجی دیگری در حال آماده‌سازی است؛ دوباره تلاش کنید.'
        : runtimeUnavailable
          ? 'مرورگر Chrome یا Edge برای ساخت PDF پیدا نشد.'
          : brandAssetUnavailable
            ? 'لوگوی سربرگ بلیط پیدا نشد؛ تنظیمات برند را بررسی کنید.'
            : 'PDF بلیط آماده نشد؛ دوباره تلاش کنید.',
      busy ? 429 : 503,
    );
  }
}
