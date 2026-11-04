import {
  Injectable,
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';
export interface TravisSandboxCatalog {
  providerStatus: 'SANDBOX_CONNECTED';
  countries: Array<{ id: number; title: string; standardCode: string }>;
  durations: Array<{ days: number; title: string }>;
  plans: Array<{ id: number; title: string; englishTitle: string }>;
}
const origin = 'https://sandboxapi.travis.ir';
const unavailable = () =>
  new ServiceUnavailableException('اتصال آزمایشی بیمه تنظیم نشده است.');
const invalid = () => new BadGatewayException('اطلاعات بیمه دریافت نشد.');
/** Read-only sandbox transport. Never accepts URLs, credentials or policy actions from a browser. */
@Injectable()
export class TravisSandboxService {
  configured() {
    return (
      process.env.TRAVIS_SANDBOX_ENABLED === 'true' &&
      (process.env.TRAVIS_SANDBOX_BASE_URL ?? origin) === origin &&
      Boolean(process.env.TRAVIS_SANDBOX_API_KEY?.trim())
    );
  }
  private async read(
    path:
      | '/api/General/Countries'
      | '/api/General/Duration-Of-Stays'
      | '/api/Plans/Search',
    body?: object,
  ): Promise<Record<string, unknown>[]> {
    if (!this.configured()) throw unavailable();
    try {
      const response = await fetch(origin + path, {
        method: 'POST',
        redirect: 'error',
        cache: 'no-store',
        headers: {
          'x-api-key': process.env.TRAVIS_SANDBOX_API_KEY!.trim(),
          'content-type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok || !response.body) throw invalid();
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const item = await reader.read();
          if (item.done) break;
          size += item.value.byteLength;
          if (size > 2_000_000) throw invalid();
          chunks.push(item.value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
        code?: number;
        data?: unknown;
      };
      if (
        value.code !== 200 ||
        !Array.isArray(value.data) ||
        value.data.length > 5000 ||
        value.data.some((v) => !v || typeof v !== 'object' || Array.isArray(v))
      )
        throw invalid();
      return value.data as Record<string, unknown>[];
    } catch {
      throw invalid();
    } // Never expose upstream bodies, URLs or credentials in an error.
  }
  async catalog(): Promise<TravisSandboxCatalog> {
    const [countries, durations, plans] = await Promise.all([
      this.read('/api/General/Countries', {}),
      this.read('/api/General/Duration-Of-Stays'),
      this.read('/api/Plans/Search', {}),
    ]);
    const id = (v: unknown) => {
      if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 1)
        throw invalid();
      return v;
    };
    const text = (v: unknown) => {
      if (typeof v !== 'string' || !v.trim() || v.length > 500) throw invalid();
      return v.trim();
    };
    return {
      providerStatus: 'SANDBOX_CONNECTED',
      countries: countries.map((v) => ({
        id: id(v.id),
        title: text(v.title),
        standardCode:
          typeof v.standardCode === 'string' &&
          /^[A-Z]{2,3}$/.test(v.standardCode)
            ? v.standardCode
            : '',
      })),
      durations: durations.map((v) => ({
        days: id(v.toDOS),
        title: text(v.display),
      })),
      plans: plans.map((v) => ({
        id: id(v.id),
        title: text(v.title),
        englishTitle:
          typeof v.titleEnglish === 'string'
            ? v.titleEnglish.slice(0, 500)
            : '',
      })),
    };
  }
}
