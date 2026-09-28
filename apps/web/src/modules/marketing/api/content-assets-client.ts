import type { MarketingContentAssetV1 } from '@nora/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';

export interface MarketingContentAssetOptions {
  branches: readonly { id: string; name: string; code: string }[];
  kinds: readonly string[];
  allowedMimeTypesByKind: Readonly<Record<string, readonly string[]>>;
}

export class MarketingAssetScanBlockedError extends Error {
  constructor(
    message: string,
    readonly asset: MarketingContentAssetV1,
  ) {
    super(message);
  }
}

export function marketingAssetStatusLabel(scanStatus: string): string {
  switch (scanStatus) {
    case 'CLEAN':
      return 'آماده دریافت';
    case 'PENDING_SCAN':
      return 'در انتظار اسکن';
    case 'AWAITING_ANTIVIRUS_ADAPTER':
      return 'در انتظار فعال‌شدن اسکن امنیتی';
    case 'INFECTED':
      return 'فایل آلوده؛ دریافت مسدود';
    case 'SCAN_FAILED':
      return 'اسکن ناموفق؛ دریافت مسدود';
    case 'QUARANTINED':
      return 'فایل قرنطینه؛ دریافت مسدود';
    default:
      return 'دریافت مسدود';
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی API پیکربندی نشده است.');
  const response = await fetch(`${base}/marketing/content/assets${path}`, {
    credentials: 'include',
    ...init,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
      code?: string;
      data?: MarketingContentAssetV1;
    } | null;
    if (body?.code === 'MARKETING_ASSET_SCAN_BLOCKED' && body.data)
      throw new MarketingAssetScanBlockedError(
        typeof body.message === 'string'
          ? body.message
          : 'فایل ثبت شد، اما بررسی امنیتی آن را مسدود کرد.',
        body.data,
      );
    throw new Error(
      Array.isArray(body?.message)
        ? body.message.join('، ')
        : (body?.message ?? 'عملیات فایل مارکتینگ ناموفق بود.'),
    );
  }
  return response;
}

export const marketingContentAssetsApi = {
  async options(): Promise<MarketingContentAssetOptions> {
    return (
      (await (await request('/options')).json()) as {
        data: MarketingContentAssetOptions;
      }
    ).data;
  },
  async list(page = 1): Promise<{
    data: readonly MarketingContentAssetV1[];
    meta: { page: number; totalPages: number; total: number };
  }> {
    return (await (await request(`?page=${page}`)).json()) as {
      data: MarketingContentAssetV1[];
      meta: { page: number; totalPages: number; total: number };
    };
  },
  async upload(form: FormData): Promise<MarketingContentAssetV1> {
    return (
      (await (await request('', { method: 'POST', body: form })).json()) as {
        data: MarketingContentAssetV1;
      }
    ).data;
  },
  async detail(id: string): Promise<MarketingContentAssetV1> {
    return (
      (await (await request(`/${encodeURIComponent(id)}`)).json()) as {
        data: MarketingContentAssetV1;
      }
    ).data;
  },
  async download(id: string): Promise<Blob> {
    return (await request(`/${encodeURIComponent(id)}/download`)).blob();
  },
};
