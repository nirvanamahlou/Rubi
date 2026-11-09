import type { InsuranceRateBandV1 } from '@nora/contracts';
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
/** Only locally generated diagnostics may cross into policy history. */
export class TravisDiagnosticError extends BadGatewayException {}
const diagnostic = (path: string, code: number, value?: unknown) => {
  const stage = path.endsWith('/Create')
    ? 'ثبت درخواست'
    : path.endsWith('/Confirm')
      ? 'تأیید صدور'
      : 'دریافت اطلاعات';
  const labels: Record<string, string> = {
    nationalCode: 'کد ملی',
    passportNo: 'شماره پاسپورت',
    firstName: 'نام فارسی',
    lastName: 'نام خانوادگی فارسی',
    firstNameLatin: 'نام لاتین',
    lastNameLatin: 'نام خانوادگی لاتین',
    birthDate: 'تاریخ تولد',
    gender: 'جنسیت',
    mobile: 'موبایل',
    email: 'ایمیل',
    isIranian: 'ملیت',
    sourceCountryId: 'کشور مبدا',
    destinationCountryId: 'کشور مقصد',
    durationOfStay: 'مدت سفر',
    planId: 'طرح بیمه',
    travelKind: 'نوع ویزا',
    travelTypeId: 'نوع سفر',
    person: 'مشخصات مسافر',
  };
  const fields =
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.keys(value)
          .slice(0, 50)
          .flatMap((key) => {
            const field = key
              .replace(/^\$?\.?person\./i, '')
              .replace(/^\$\./, '');
            const known = Object.keys(labels).find(
              (name) => name.toLowerCase() === field.toLowerCase(),
            );
            return known ? [labels[known]!] : [];
          })
      : [];
  const reason =
    code === 401 || code === 403
      ? 'دسترسی یا کلید اتصال بیمه تأیید نشد'
      : code === 429
        ? 'تعداد درخواست‌ها بیش از حد مجاز است'
        : code >= 500
          ? 'خطای داخلی سرویس بیمه'
          : code === 400 || code === 422
            ? 'اطلاعات درخواست از سوی بیمه پذیرفته نشد'
            : 'پاسخ ناموفق سرویس بیمه';
  return new TravisDiagnosticError(
    `${stage} بیمه: ${reason} (کد ${code}).${fields.length ? ' فیلدهای نیازمند بررسی: ' + [...new Set(fields)].join('، ') : ''}`,
  );
};
/** Fixed sandbox transport. Never accepts URLs, credentials or customer policy payloads from a browser. */
@Injectable()
export class TravisSandboxService {
  configured() {
    return (
      process.env.TRAVIS_SANDBOX_ENABLED === 'true' &&
      (process.env.TRAVIS_SANDBOX_BASE_URL ?? origin) === origin &&
      Boolean(process.env.TRAVIS_SANDBOX_API_KEY?.trim())
    );
  }
  private async request(
    path:
      | '/api/General/Countries'
      | '/api/General/Duration-Of-Stays'
      | '/api/Plans/Search'
      | '/api/Policies/Create'
      | '/api/Policies/Search'
      | '/api/Policies/Confirm',
    body?: object,
    method: 'POST' | 'PUT' = 'POST',
  ): Promise<unknown> {
    if (!this.configured()) throw unavailable();
    try {
      const response = await fetch(origin + path, {
        method,
        redirect: 'error',
        cache: 'no-store',
        headers: {
          'x-api-key': process.env.TRAVIS_SANDBOX_API_KEY!.trim(),
          'content-type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.body) throw diagnostic(path, response.status);
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
      let parsed: unknown;
      try {
        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        if (!response.ok) throw diagnostic(path, response.status);
        throw invalid();
      }
      const value = parsed as {
        code?: number;
        data?: unknown;
        errors?: unknown;
      };
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw invalid();
      if (!response.ok || value.code !== 200)
        throw diagnostic(
          path,
          !response.ok
            ? response.status
            : Number.isSafeInteger(value.code) &&
                Number(value.code) >= 100 &&
                Number(value.code) <= 599
              ? Number(value.code)
              : response.status,
          value.errors,
        );
      if (value.data === undefined || value.data === null) throw invalid();
      return value.data;
    } catch (error) {
      if (error instanceof TravisDiagnosticError) throw error;
      if (
        error instanceof Error &&
        ['TimeoutError', 'AbortError'].includes(error.name)
      )
        throw new TravisDiagnosticError(
          'مهلت پاسخ سرویس بیمه تمام شد؛ وضعیت درخواست پیش از تلاش مجدد بررسی می‌شود.',
        );
      throw invalid();
    } // Never expose upstream bodies, URLs or credentials in an error.
  }
  private async read(
    path:
      | '/api/General/Countries'
      | '/api/General/Duration-Of-Stays'
      | '/api/Plans/Search'
      | '/api/Policies/Search',
    body?: object,
  ): Promise<Record<string, unknown>[]> {
    const data = await this.request(path, body);
    if (
      !Array.isArray(data) ||
      data.length > 5000 ||
      data.some((v) => !v || typeof v !== 'object' || Array.isArray(v))
    )
      throw invalid();
    return data as Record<string, unknown>[];
  }

  async createPolicy(input: object): Promise<number> {
    const result = (await this.request('/api/Policies/Create', input)) as {
      policyId?: number;
    };
    if (
      !Number.isSafeInteger(result?.policyId) ||
      !result.policyId ||
      result.policyId < 1
    )
      throw invalid();
    return result.policyId;
  }
  async confirmPolicy(policyId: number) {
    const result = (await this.request(
      '/api/Policies/Confirm',
      { policyId },
      'PUT',
    )) as { policyId?: number };
    if (result?.policyId !== policyId) throw invalid();
  }
  async policy(
    policyId: number,
    expected?: {
      contractNo: string;
      planId: number;
      passportNo: string;
      nationalCode: string;
    },
  ) {
    const rows = await this.read('/api/Policies/Search', {
      policyId,
      pageNumber: 1,
      pageSize: 10,
    });
    const row = rows.find((r) => r.policyId === policyId);
    if (
      row &&
      expected &&
      (row.contractNo !== expected.contractNo ||
        row.planId !== expected.planId ||
        row.passportNo !== expected.passportNo ||
        (row.person as { nationalCode?: unknown } | undefined)?.nationalCode !==
          expected.nationalCode)
    )
      throw invalid();
    return row ? this.projectPolicy(row) : null;
  }
  async findCorrelatedPolicy(
    nationalCode: string,
    planId: number,
    contractNo: string,
  ) {
    for (let pageNumber = 1; pageNumber <= 10; pageNumber++) {
      const rows = await this.read('/api/Policies/Search', {
        nationalCode,
        planId,
        pageNumber,
        pageSize: 100,
      });
      const matches = rows.filter(
        (r) => r.contractNo === contractNo && r.planId === planId,
      );
      if (matches.length > 1) throw invalid();
      if (matches[0]) return this.projectPolicy(matches[0]);
      if (rows.length < 100) return null;
    }
    throw invalid();
  }
  private projectPolicy(row: Record<string, unknown>) {
    if (!Number.isSafeInteger(row.policyId) || Number(row.policyId) < 1)
      throw invalid();
    const active = row.lastStatus === 'Active';
    const plan = row.plan as { premiumCurrencyCode?: string } | undefined;
    if (
      active &&
      (typeof row.policyNo !== 'string' ||
        !row.policyNo.trim() ||
        row.policyNo.length > 100 ||
        !/^\d{1,15}(?:\.\d{1,4})?$/.test(String(row.payablePremium)) ||
        !/^[A-Z]{3}$/.test(plan?.premiumCurrencyCode ?? ''))
    )
      throw invalid();
    return {
      providerId: String(row.policyId),
      active,
      policyNumber: active ? String(row.policyNo) : null,
      amount: active ? String(row.payablePremium) : null,
      currencyCode: active ? plan!.premiumCurrencyCode! : null,
      pdfUrl:
        active && typeof row.pdfUrl === 'string'
          ? this.policyPdfUrl(row.pdfUrl)
          : null,
    };
  }
  policyPdfUrl(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw invalid();
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.hostname !== 'sandbox.travis.ir' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/Print\/PolicyPdf\/[0-9a-f-]{36}\/true$/i.test(url.pathname)
    )
      throw invalid();
    url.protocol = 'https:';
    return url.toString();
  }
  async policyPdf(value: string) {
    if (!this.configured()) throw unavailable();
    try {
      const response = await fetch(this.policyPdfUrl(value), {
        redirect: 'error',
        cache: 'no-store',
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
          if (size > 10_000_000) throw invalid();
          chunks.push(item.value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      const bytes = Buffer.concat(chunks);
      if (bytes.subarray(0, 5).toString() !== '%PDF-') throw invalid();
      return bytes;
    } catch {
      throw invalid();
    }
  }

  /** Explicit synthetic sandbox smoke test. Never reads or writes a customer's policy. */
  async testIssuance() {
    const created = (await this.request('/api/Policies/Create', {
      sourceCountryId: 1,
      destinationCountryId: 5,
      durationOfStay: 7,
      travelKind: 1,
      planId: 76,
      travelTypeId: 1,
      passportNo: 'SANDBOXTEST',
      person: {
        nationalCode: 'SANDBOXTEST',
        isIranian: false,
        firstName: 'آزمایشی',
        lastName: 'سامانه',
        firstNameLatin: 'SANDBOX',
        lastNameLatin: 'TEST',
        gender: 1,
        birthDate: '1990-01-01T00:00:00Z',
        mobile: '00000000000',
        email: 'insurance-test@example.invalid',
      },
    })) as { policyId?: number };
    if (
      !Number.isSafeInteger(created?.policyId) ||
      !created.policyId ||
      created.policyId < 1
    )
      throw invalid();
    const confirmed = (await this.request(
      '/api/Policies/Confirm',
      { policyId: created.policyId },
      'PUT',
    )) as { policyId?: number };
    if (confirmed?.policyId !== created.policyId) throw invalid();
    return {
      providerStatus: 'SANDBOX_CONNECTED' as const,
      sandboxOnly: true as const,
      policyId: created.policyId,
      confirmed: true as const,
    };
  }

  async festivalRates() {
    const catalog = await this.catalog();
    const plan = catalog.plans.find((p) => p.id === 76);
    if (!plan) throw invalid();
    const destinations = [
      { code: 'TR', id: 5 },
      { code: 'CN', id: 59 },
      { code: 'GE', id: 29 },
      { code: 'MY', id: 30 },
    ];
    const ages = [
      [0, 12],
      [13, 65],
      [66, 70],
      [71, 75],
      [76, 80],
      [81, 120],
    ] as const;
    const caps = [...new Set(catalog.durations.map((d) => d.days))]
      .filter((d) => d <= 365)
      .sort((a, b) => a - b);
    const jobs = destinations.flatMap((destination) =>
      ages.flatMap(([minAge, maxAge]) =>
        caps.map((maxDays, i) => ({
          destination,
          minAge,
          maxAge,
          minDays: i ? caps[i - 1]! + 1 : 1,
          maxDays,
        })),
      ),
    );
    const output = destinations.map((d) => {
      const country = catalog.countries.find(
        (c) => c.id === d.id && c.standardCode === d.code,
      );
      if (!country) throw invalid();
      return {
        ...d,
        name: country.title,
        title: plan.title,
        rates: [] as InsuranceRateBandV1[],
        unsupported: 0,
      };
    });
    let cursor = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        for (;;) {
          const job = jobs[cursor++];
          if (!job) return;
          const birthDate =
            String(new Date().getUTCFullYear() - job.minAge) +
            '-01-01T00:00:00Z';
          const quote = (durationOfStay: number) =>
            this.read('/api/Plans/Search', {
              sourceCountryId: 1,
              destinationCountryId: job.destination.id,
              planId: 76,
              birthDate,
              durationOfStay,
            });
          const values = await quote(job.maxDays);
          const found = values.find((v) => v.id === 76);
          const target = output.find((d) => d.id === job.destination.id)!;
          if (!found) {
            target.unsupported++;
            continue;
          }
          const lower =
            job.minDays === job.maxDays
              ? found
              : (await quote(job.minDays)).find((v) => v.id === 76);
          if (!lower || lower.priceTotal !== found.priceTotal) throw invalid();
          const amount = String(found.priceTotal);
          if (
            found.premiumCurrencyCode !== 'IRR' ||
            !/^\d{1,15}(?:\.\d{1,4})?$/.test(amount)
          )
            throw invalid();
          target.rates.push({
            minAge: job.minAge,
            maxAge: job.maxAge,
            minDays: job.minDays,
            maxDays: job.maxDays,
            amount,
            currencyCode: 'IRR',
          });
        }
      }),
    );
    for (const destination of output) {
      destination.rates.sort(
        (a, b) => a.minDays - b.minDays || a.minAge - b.minAge,
      );
      if (!destination.rates.length) throw invalid();
    }
    return output;
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
