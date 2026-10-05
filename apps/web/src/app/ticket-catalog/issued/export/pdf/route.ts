import { getPublicApiBaseUrl } from '@/lib/environment';
import {
  renderIssuedPdf,
  type IssuedPdfData,
} from '@/modules/ticket-catalog/server/issued-pdf';
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
      { message: 'نشانی سرور تنظیم نشده است.' },
      { status: 503, headers },
    );
  const query = new URL(request.url).searchParams.toString();
  if (query.length > 4000)
    return Response.json(
      { message: 'فیلتر بیش از حد طولانی است.' },
      { status: 400, headers },
    );
  try {
    const response = await fetch(
      base + '/reservations/requests/issued-tickets?' + query,
      {
        headers: {
          cookie: request.headers.get('cookie') ?? '',
          accept: 'application/json',
        },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok)
      return Response.json(
        { message: 'دریافت گزارش انجام نشد؛ تاریخ‌ها و دسترسی را بررسی کنید.' },
        { status: response.status, headers },
      );
    const snapshot = (await response.json()) as IssuedPdfData;
    const bytes = await renderIssuedPdf(snapshot);
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...headers,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="issued-tickets.pdf"',
      },
    });
  } catch {
    return Response.json(
      { message: 'ساخت PDF انجام نشد؛ مرورگر PDF سرور را بررسی کنید.' },
      { status: 503, headers },
    );
  }
}
