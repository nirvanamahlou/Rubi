import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import {
  canViewIntegrationSection,
  type AuthenticatedActor,
} from '@nora/contracts';
import { niyayeshRead, type NiyayeshConnection } from './niyayesh.client';

export const NIYAYESH_RESOURCES = {
  countries: 'کشورها',
  airlines: 'شرکت‌های هواپیمایی',
  destinations: 'مقصدها',
  categories: 'دسته‌بندی تور',
  hotels: 'هتل‌ها',
  visas: 'ویزاها',
  tours: 'تورها',
  'service-offers': 'بلیط و خدمات',
  'editorial-content': 'محتوای سایت',
  'exchange-rates': 'نرخ ارز',
  'customer-accounts': 'مشتریان سایت',
  'customer-travelers': 'مسافران سایت',
  'customer-orders': 'سفارش‌های سایت',
  'customer-cart-items': 'سبدهای خرید',
  'support-threads': 'پشتیبانی',
  'travel-requests': 'درخواست‌های سفر',
} as const;

@Injectable()
export class NiyayeshService {
  // Reload local server configuration for every request: revocation is immediate.
  async binding(actor: AuthenticatedActor, branch: string) {
    if (
      !actor.branchIds.includes(branch) ||
      !canViewIntegrationSection(actor.permissions, 'connections')
    )
      throw new ForbiddenException('مجوز مشاهده اتصال یا شعبه را ندارید.');
    const file = process.env.NIYAYESH_CONNECTION_FILE;
    if (!file) return null;
    let config: NiyayeshConnection;
    try {
      const content = await readFile(file, 'utf8');
      if (content.length > 65536) throw Error();
      config = JSON.parse(content) as NiyayeshConnection;
      if (
        !config.origin ||
        !config.organization ||
        !config.client ||
        !config.system ||
        !config.environment ||
        !config.keyId ||
        typeof config.secret !== 'string' ||
        config.secret.length < 32 ||
        typeof config.local !== 'boolean' ||
        !Array.isArray(config.users)
      )
        throw Error();
    } catch {
      throw new ServiceUnavailableException('تنظیمات امن اتصال کامل نیست.');
    }
    const user = config.users.find(
      (u) => u.userId === actor.userId && u.branchId === branch,
    );
    if (!user?.subject || !Array.isArray(user.resources))
      throw new ForbiddenException('حساب شخصی شما به نیایش متصل نشده است.');
    return { config, user };
  }
  async read(config: NiyayeshConnection, subject: string, path: string) {
    try {
      return await niyayeshRead(config, subject, path);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'UPSTREAM_403')
        throw new ForbiddenException('مجوز این داده در پنل نیایش فعال نیست.');
      throw new ServiceUnavailableException(
        'نیایش پاسخ معتبر نداد؛ وضعیت سرویس و تنظیمات اتصال را بررسی کنید.',
      );
    }
  }
  async status(actor: AuthenticatedActor, branch: string) {
    const binding = await this.binding(actor, branch);
    if (!binding) return { state: 'NOT_CONFIGURED', resources: [] };
    const { config, user } = binding;
    const capabilities = (await this.read(
      config,
      user.subject,
      '/api/v1/integration/capabilities',
    )) as { grants?: string[] };
    if (!Array.isArray(capabilities.grants))
      throw new ServiceUnavailableException('نسخه قرارداد نیایش معتبر نیست.');
    return {
      state: 'CONNECTED',
      environment: config.local ? 'LOCAL' : config.environment,
      checkedAt: new Date().toISOString(),
      resources: Object.entries(NIYAYESH_RESOURCES)
        .filter(
          ([r]) =>
            user.resources.includes(r) &&
            capabilities.grants?.includes(`${r}.read`),
        )
        .map(([code, title]) => ({ code, title })),
    };
  }
  async resources(
    actor: AuthenticatedActor,
    branch: string,
    resource: string,
    after = '0',
    id?: string,
  ) {
    if (
      !Object.hasOwn(NIYAYESH_RESOURCES, resource) ||
      !/^\d{1,15}$/.test(after) ||
      (id !== undefined && !/^\d{1,15}$/.test(id))
    )
      throw new BadRequestException('منبع یا شناسه معتبر نیست.');
    const binding = await this.binding(actor, branch);
    if (!binding)
      throw new ServiceUnavailableException('اتصال تنظیم نشده است.');
    const { config, user } = binding;
    if (!user.resources.includes(resource))
      throw new ForbiddenException('مجوز این منبع برای حساب شما فعال نیست.');
    const suffix = id ? `/${id}` : `?after_id=${after}&limit=25`;
    return this.read(
      config,
      user.subject,
      `/api/v1/integration/resources/${resource}${suffix}`,
    );
  }
}
