import { readContractFlightFacts } from '@/modules/sales/model/contract-flight-facts';
import { enrichContractHotels } from '@/modules/sales/model/contract-hotel-references';
import { languageFromCookies } from '@/i18n/language';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MasterDataRecord, SalesContractOutputV1 } from '@nora/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { legalEntityBrand } from '@/modules/legal-entities/model/context';
import type { ContractPrintReferences } from '@/modules/sales/model/contract-print';
import { createPublicDocument } from '@/modules/travel-documents/server/public-document-store';
import {
  renderContractPdf,
  prepareContractHtml,
} from '@/modules/sales/server/contract-pdf';
import { printCityInternational } from '@/modules/sales/model/contract-print-country';

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
    fetch(new URL(base + path, request.url).toString(), {
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
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: unknown;
        error?: { message?: unknown };
      } | null;
      const message = body?.error?.message ?? body?.message;
      return Response.json(
        {
          message:
            typeof message === 'string'
              ? message
              : 'دریافت قرارداد انجام نشد؛ دوباره تلاش کنید.',
        },
        { status: response.status, headers },
      );
    }
    const { data: output } = (await response.json()) as {
      data: SalesContractOutputV1;
    };
    const c = output.contract;
    const refs: ContractPrintReferences = { names: {} };
    refs.flightFacts = await readContractFlightFacts(output, get);
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
        try {
          const response = await get(
            '/master-data/selections/sales/' +
              resource +
              '/' +
              encodeURIComponent(key),
          );
          if (!response.ok) return;
          const { data } = (await response.json()) as {
            data: MasterDataRecord;
          };
          if (!data || typeof data.name !== 'string') return;
          refs.names[key] = data.name;
          if (
            resource === 'cities' &&
            data.attributes &&
            (await printCityInternational(data, async (id) => {
              const response = await get(
                '/master-data/selections/sales/countries/' +
                  encodeURIComponent(id),
              );
              if (!response.ok) return undefined;
              return ((await response.json()) as { data: MasterDataRecord })
                .data;
            }))
          )
            refs.international = true;
          if (resource === 'hotels' && data.attributes?.starRating != null)
            refs.hotelGrade = String(data.attributes.starRating);
          if (resource === 'hotels' && data.attributes) {
            if (typeof data.attributes.englishName === 'string')
              refs.hotelLatinName = data.attributes.englishName.trim();
            if (typeof data.attributes.website === 'string')
              refs.hotelWebsite = data.attributes.website.trim();
          }
        } catch {
          // Reference enrichment is optional; the saved authorized contract is authoritative.
        }
      }),
    );
    await enrichContractHotels(output, refs, async (resource, key) => {
      const response = await get(
        '/master-data/selections/sales/' +
          resource +
          '/' +
          encodeURIComponent(key),
      );
      if (!response.ok) return undefined;
      return ((await response.json()) as { data: MasterDataRecord }).data;
    });
    const logo = legalEntityBrand(output.company.code).src;
    refs.logoDataUrl =
      'data:image/png;base64,' +
      (await readFile(join(process.cwd(), 'public', logo))).toString('base64');
    const share = createPublicDocument();
    const language = languageFromCookies(request.headers.get('cookie'));
    if (share) {
      refs.publicDocumentUrl = share.url;
      const html = await prepareContractHtml(output, refs, language);
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
    const bytes = await renderContractPdf(
      output,
      refs,
      languageFromCookies(request.headers.get('cookie')),
    );
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
