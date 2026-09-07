import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MasterDataRecord, SalesContractOutputV1 } from '@rubi/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { legalEntityBrand } from '@/modules/legal-entities/model/context';
import type { ContractPrintReferences } from '@/modules/sales/model/contract-print';
import { renderContractPdf } from '@/modules/sales/server/contract-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return Response.json(
      { message: 'شناسه قرارداد معتبر نیست.' },
      { status: 400, headers },
    );
  const base = getPublicApiBaseUrl();
  if (!base)
    return Response.json(
      { message: 'سرویس خروجی پیکربندی نشده است.' },
      { status: 503, headers },
    );
  const get = (path: string) =>
    fetch(base + path, {
      headers: {
        cookie: request.headers.get('cookie') ?? '',
        accept: 'application/json',
      },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
  try {
    const response = await get('/sales/contracts/' + id + '/output');
    if (!response.ok)
      return Response.json(
        { message: 'دریافت قرارداد مجاز نیست یا قرارداد هنوز تأیید نشده است.' },
        { status: response.status, headers },
      );
    const { data: output } = (await response.json()) as {
      data: SalesContractOutputV1;
    };
    const c = output.contract;
    const refs: ContractPrintReferences = { names: {} };
    const keys = [
      ['cities', c.originId],
      ['cities', c.destinationId],
      ['room-types', c.hotelSelection?.roomTypeId],
      ['meal-services', c.hotelSelection?.mealServiceId],
      ['hotels', c.hotelSelection?.hotelId],
    ];
    await Promise.all(
      keys.map(async ([resource, key]) => {
        if (!key) return;
        const response = await get(
          '/master-data/' + resource + '/' + encodeURIComponent(key),
        );
        if (!response.ok) return;
        const { data } = (await response.json()) as { data: MasterDataRecord };
        refs.names[key] = data.name;
        if (resource === 'hotels' && data.attributes.starRating != null)
          refs.hotelGrade = String(data.attributes.starRating);
        if (resource === 'hotels') {
          if (typeof data.attributes.englishName === 'string')
            refs.hotelLatinName = data.attributes.englishName.trim();
          if (typeof data.attributes.website === 'string')
            refs.hotelWebsite = data.attributes.website.trim();
        }
      }),
    );
    const logo = legalEntityBrand(output.company.code).src;
    refs.logoDataUrl =
      'data:image/png;base64,' +
      (await readFile(join(process.cwd(), 'public', logo))).toString('base64');
    const bytes = await renderContractPdf(output, refs);
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...headers,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="contract-' + id + '.pdf"',
      },
    });
  } catch {
    return Response.json(
      {
        message:
          'ساخت PDF انجام نشد؛ تنظیمات موتور PDF و فونت ب‌نازنین را بررسی کنید و دوباره تلاش کنید.',
      },
      { status: 503, headers },
    );
  }
}
