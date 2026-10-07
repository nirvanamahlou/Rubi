import { languageFromCookies } from '@/i18n/language';
import type { FinanceExportSnapshotV1 } from '@nora/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { renderFinancePdf } from '@/modules/finance/server/finance-pdf';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};
export async function GET(request: Request) {
  const base = getPublicApiBaseUrl();
  if (!base)
    return Response.json(
      { message: 'سرویس مالی پیکربندی نشده است.' },
      { status: 503, headers },
    );
  const query = new URL(request.url).searchParams.toString();
  if (query.length > 4000)
    return Response.json(
      { message: 'فیلتر بیش از حد طولانی است.' },
      { status: 400, headers },
    );
  try {
    const response = await fetch(base + '/finance/export-data?' + query, {
      headers: {
        cookie: request.headers.get('cookie') ?? '',
        accept: 'application/json',
      },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      return Response.json(
        {
          message:
            response.status === 403
              ? 'مجوز خروجی مالی ندارید.'
              : 'دریافت داده مالی انجام نشد؛ فیلتر و دسترسی را بررسی کنید.',
        },
        { status: response.status, headers },
      );
    const snapshot = (await response.json()) as FinanceExportSnapshotV1;
    const bytes = await renderFinancePdf(
      snapshot,
      languageFromCookies(request.headers.get('cookie')),
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...headers,
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          'attachment; filename="finance-' +
          snapshot.scope.toLowerCase() +
          '.pdf"',
      },
    });
  } catch {
    return Response.json(
      {
        message:
          'ساخت PDF انجام نشد. مسیر FINANCE_PDF_CHROME_PATH را روی سرور بررسی کنید و دوباره تلاش کنید.',
      },
      { status: 503, headers },
    );
  }
}
