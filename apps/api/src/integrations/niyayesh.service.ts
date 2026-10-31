import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import {
  canViewIntegrationSection,
  canViewScreen,
  type AuthenticatedActor,
} from '@nora/contracts';
import {
  niyayeshRead,
  NiyayeshUpstreamError,
  type NiyayeshConnection,
} from './niyayesh.client';

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
  readonly editors = [
    'tours',
    'hotels',
    'service-offers',
    'visas',
    'destinations',
    'countries',
    'airlines',
    'categories',
    'editorial-content',
  ];
  canEdit(actor: AuthenticatedActor, resource: string) {
    return (
      this.editors.includes(resource) &&
      canViewScreen(
        actor.permissions,
        `integrations.niyayesh.manage.${resource}`,
      )
    );
  }
  async editor(
    actor: AuthenticatedActor,
    branch: string,
    resource: string,
    id?: string,
  ) {
    if (
      !this.canEdit(actor, resource) ||
      (id !== undefined && !/^[1-9]\d{0,14}$/.test(id))
    )
      throw new ForbiddenException('مجوز مدیریت این بخش سایت را ندارید.');
    const binding = await this.binding(actor, branch);
    if (!binding || !binding.user.resources.includes(resource))
      throw new ForbiddenException();
    const path = `/api/v1/integration/catalogue/${resource}`;
    const schema = (await this.read(
      binding.config,
      binding.user.subject,
      `${path}/schema`,
    )) as Record<string, unknown>;
    const data = id
      ? await this.read(
          binding.config,
          binding.user.subject,
          `${path}/value/${id}`,
        )
      : null;
    return {
      ...schema,
      canPublish:
        schema.canPublish === true &&
        canViewScreen(actor.permissions, 'integrations.niyayesh.publish'),
      record: data,
    };
  }
  async saveCatalogue(
    actor: AuthenticatedActor,
    branch: string,
    resource: string,
    input: unknown,
  ) {
    if (!this.canEdit(actor, resource))
      throw new ForbiddenException('مجوز مدیریت این بخش سایت را ندارید.');
    const value = input as {
      id?: string;
      version?: string;
      command?: string;
      value?: Record<string, unknown>;
    };
    if (
      !value ||
      !value.value ||
      typeof value.value !== 'object' ||
      Array.isArray(value.value) ||
      !/^[A-Za-z0-9_-]{16,80}$/.test(value.command ?? '') ||
      (value.id &&
        (!/^[1-9]\d{0,14}$/.test(value.id) ||
          !/^\d{1,15}$/.test(value.version ?? '')))
    )
      throw new BadRequestException('اطلاعات فرم یا نسخه معتبر نیست.');
    if (
      value.value.status === 'published' &&
      !canViewScreen(actor.permissions, 'integrations.niyayesh.publish')
    )
      throw new ForbiddenException('مجوز انتشار در سایت را ندارید.');
    const binding = await this.binding(actor, branch);
    if (!binding || !binding.user.resources.includes(resource))
      throw new ForbiddenException();
    return this.read(
      binding.config,
      binding.user.subject,
      `/api/v1/admin/${resource}${value.id ? `/${value.id}` : ''}`,
      {
        method: value.id ? 'PATCH' : 'POST',
        command: value.command!,
        body: JSON.stringify(value.value),
        ...(value.id ? { version: value.version! } : {}),
      },
    );
  }
  async report(
    actor: AuthenticatedActor,
    branch: string,
    from: string,
    to: string,
    systemId?: string,
  ) {
    if (!canViewScreen(actor.permissions, 'integrations.niyayesh.analytics'))
      throw new ForbiddenException('مجوز گزارش سایت را ندارید.');
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(from ?? '') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(to ?? '') ||
      from > to
    )
      throw new BadRequestException('بازه گزارش معتبر نیست.');
    const binding = await this.binding(actor, branch, 'brands', systemId);
    if (!binding || !binding.user.resources.includes('site-analytics'))
      throw new ForbiddenException();
    const result = (await this.read(
      binding.config,
      binding.user.subject,
      `/api/v1/integration/report?from=${from}&to=${to}`,
    )) as Record<string, unknown> & {
      metrics: Record<string, { value: number | null; state: string }>;
      totals: Record<string, number | null>;
      trends: Record<string, unknown>;
      activity: { resource: string }[];
    };
    for (const [metric, resource] of Object.entries({
      users: 'customer-accounts',
      orders: 'customer-orders',
      sales: 'customer-orders',
      pending: 'customer-orders',
    })) {
      if (!binding.user.resources.includes(resource)) {
        result.metrics[metric] = { value: null, state: 'FORBIDDEN' };
        delete result.trends[metric];
        if (metric === 'sales') result.salesByCurrency = null;
      }
    }
    for (const resource of Object.keys(result.totals))
      if (!binding.user.resources.includes(resource))
        result.totals[resource] = null;
    result.activity = canViewIntegrationSection(actor.permissions, 'logs')
      ? result.activity.filter((row) =>
          binding.user.resources.includes(row.resource),
        )
      : [];
    return {
      ...result,
      activityAvailable:
        result.activityAvailable === true &&
        canViewIntegrationSection(actor.permissions, 'logs'),
      registrySystemId: binding.config.registrySystemId,
      environment: binding.config.local ? 'LOCAL' : binding.config.environment,
    };
  }
  async hotelExport(actor: AuthenticatedActor, branch: string, city: string) {
    if (typeof city !== 'string' || !city.trim() || city.length > 120)
      throw new BadRequestException('شهر را انتخاب کنید.');
    if (!this.canImport(actor, 'hotels')) throw new ForbiddenException();
    const binding = await this.binding(actor, branch);
    if (!binding || !binding.user.resources.includes('hotels'))
      throw new ForbiddenException();
    return this.read(
      binding.config,
      binding.user.subject,
      `/api/v1/integration/workbooks/hotels/export?city=${encodeURIComponent(city.trim())}`,
    );
  }
  async dashboard(actor: AuthenticatedActor, branch: string) {
    const binding = await this.binding(actor, branch);
    if (!binding) return { state: 'NOT_CONFIGURED', metrics: [], imports: [] };
    const { config, user } = binding;
    const data = (await this.read(
      config,
      user.subject,
      '/api/v1/integration/dashboard',
    )) as {
      checkedAt: string;
      metrics: {
        key: string;
        resource: string;
        title: string;
        definition: string;
        value: number | null;
        state: string;
      }[];
      imports: { kind: string; canApply: boolean }[];
    };
    return {
      ...data,
      state: 'CONNECTED',
      environment: config.local ? 'LOCAL' : config.environment,
      metrics: data.metrics.map((m) =>
        user.resources.includes(m.resource)
          ? m
          : { ...m, value: null, state: 'FORBIDDEN' },
      ),
      imports: data.imports.filter(
        (w) =>
          this.canImport(actor, w.kind) &&
          user.resources.includes(this.importTarget(w.kind)),
      ),
    };
  }
  importTarget(kind: string) {
    const targets: Record<string, string> = {
      hotels: 'hotels',
      'tour-prices': 'tours',
      tickets: 'service-offers',
    };
    if (!targets[kind])
      throw new BadRequestException('نوع ورود فایل معتبر نیست.');
    return targets[kind];
  }
  canImport(actor: AuthenticatedActor, kind: string) {
    return canViewScreen(
      actor.permissions,
      `integrations.niyayesh.import.${kind}`,
    );
  }
  async workbook(
    actor: AuthenticatedActor,
    branch: string,
    kind: string,
    file?: { buffer: Buffer; originalname: string },
    apply = false,
    tourId?: string,
    proof?: string,
    command?: string,
  ) {
    const target = this.importTarget(kind);
    if (!this.canImport(actor, kind))
      throw new ForbiddenException('مجوز ورود فایل این بخش را ندارید.');
    const binding = await this.binding(actor, branch);
    if (!binding || !binding.user.resources.includes(target))
      throw new ForbiddenException('حساب یا منبع مجاز نیست.');
    const path = `/api/v1/integration/workbooks/${kind}`;
    if (!file)
      return this.read(
        binding.config,
        binding.user.subject,
        `${path}/template`,
      );
    if (
      file.buffer.length > 4 * 1024 * 1024 ||
      !/^[^/\\]{1,155}\.xlsx$/.test(file.originalname) ||
      (tourId && !/^[1-9]\d{0,14}$/.test(tourId)) ||
      !/^[A-Za-z0-9_-]{16,80}$/.test(command ?? '')
    )
      throw new BadRequestException(
        'فایل، شناسه تور یا شناسه عملیات معتبر نیست.',
      );
    return this.read(binding.config, binding.user.subject, path, {
      method: 'POST',
      command: command!,
      body: JSON.stringify({
        filename: file.originalname,
        content: file.buffer.toString('base64'),
        apply,
        ...(tourId ? { tourId: Number(tourId) } : {}),
        ...(proof ? { proof } : {}),
      }),
    });
  }
  // Reload local server configuration for every request: revocation is immediate.
  async configuration(systemId?: string) {
    const file = process.env.NIYAYESH_CONNECTION_FILE;
    if (!file) return null;
    let config: NiyayeshConnection;
    try {
      const content = await readFile(file, 'utf8');
      if (content.length > 65536) throw Error();
      config = JSON.parse(content) as NiyayeshConnection;
      if (systemId !== undefined) {
        if (!/^[a-zA-Z0-9-]{1,80}$/.test(systemId))
          throw new BadRequestException('شناسه سایت معتبر نیست.');
        if (
          !Array.isArray(config.reportConnections ?? []) ||
          (config.reportConnections?.length ?? 0) > 50
        )
          throw Error();
        const connections = [config, ...(config.reportConnections ?? [])];
        const matches = connections.filter(
          (connection) => connection.registrySystemId === systemId,
        );
        if (!matches.length)
          throw new NotFoundException('اتصال گزارش این سایت تنظیم نشده است.');
        if (matches.length !== 1) throw Error();
        config = matches[0]!;
      }
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
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new ServiceUnavailableException('تنظیمات امن اتصال کامل نیست.');
    }
    return config;
  }
  async binding(
    actor: AuthenticatedActor,
    branch: string,
    section: 'connections' | 'brands' = 'connections',
    systemId?: string,
  ) {
    if (
      !actor.branchIds.includes(branch) ||
      !canViewIntegrationSection(actor.permissions, section)
    )
      throw new ForbiddenException('مجوز مشاهده اتصال یا شعبه را ندارید.');
    const config = await this.configuration(systemId);
    if (!config) {
      if (systemId)
        throw new NotFoundException('اتصال گزارش این سایت تنظیم نشده است.');
      return null;
    }
    let user = config.users.find(
      (u) => u.userId === actor.userId && u.branchId === branch,
    );
    if (
      !user &&
      canViewScreen(actor.permissions, 'integrations.niyayesh.login') &&
      config.managedAccess?.branchIds.includes(branch) &&
      Array.isArray(config.managedAccess.resources)
    ) {
      user = {
        userId: actor.userId,
        branchId: branch,
        subject: actor.userId,
        resources: config.managedAccess.resources.filter(
          (r) => Object.hasOwn(NIYAYESH_RESOURCES, r) || r === 'site-analytics',
        ),
      };
    }
    if (!user?.subject || !Array.isArray(user.resources))
      throw new ForbiddenException('حساب شخصی شما به نیایش متصل نشده است.');
    return { config, user };
  }
  async read(
    config: NiyayeshConnection,
    subject: string,
    path: string,
    options?: {
      method?: string;
      body?: string;
      command?: string;
      version?: string;
      ifMatch?: string;
    },
  ) {
    try {
      return await niyayeshRead(config, subject, path, options);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'UPSTREAM_409')
        throw new ConflictException(
          error instanceof NiyayeshUpstreamError && error.details
            ? error.details
            : 'اطلاعات سایت تغییر کرده یا پیش‌نمایش منقضی شده است؛ دوباره پیش‌نمایش بگیرید.',
        );
      if (code === 'UPSTREAM_422')
        throw new BadRequestException(
          error instanceof NiyayeshUpstreamError && error.details
            ? error.details
            : 'فایل یا تنظیمات آن معتبر نیست؛ پیش‌نمایش و خطاها را بررسی کنید.',
        );
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
      registrySystemId: config.registrySystemId,
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
    metric?: string,
    reportMetric?: string,
    from?: string,
    to?: string,
    systemId?: string,
  ) {
    if (
      !Object.hasOwn(NIYAYESH_RESOURCES, resource) ||
      !/^\d{1,15}$/.test(after) ||
      (id !== undefined && !/^\d{1,15}$/.test(id)) ||
      (metric !== undefined &&
        ![
          'customers',
          'tours',
          'hotels',
          'shopping',
          'sales',
          'pending',
        ].includes(metric))
    )
      throw new BadRequestException('منبع یا شناسه معتبر نیست.');
    if (
      reportMetric &&
      (!['users', 'orders', 'sales', 'pending'].includes(reportMetric) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(from ?? '') ||
        !/^\d{4}-\d{2}-\d{2}$/.test(to ?? '') ||
        !canViewScreen(actor.permissions, 'integrations.niyayesh.analytics'))
    )
      throw new ForbiddenException();
    const binding = await this.binding(
      actor,
      branch,
      reportMetric ? 'brands' : 'connections',
      reportMetric ? systemId : undefined,
    );
    if (!binding)
      throw new ServiceUnavailableException('اتصال تنظیم نشده است.');
    const { config, user } = binding;
    if (!user.resources.includes(resource))
      throw new ForbiddenException('مجوز این منبع برای حساب شما فعال نیست.');
    const effectiveMetric = reportMetric
      ? undefined
      : (metric ?? (resource === 'tours' ? 'tours' : undefined));
    const suffix = id
      ? `/${id}`
      : `?after_id=${after}&limit=25${effectiveMetric ? `&metric=${effectiveMetric}` : ''}${reportMetric ? `&report_metric=${reportMetric}&from=${from}&to=${to}` : ''}`;
    return this.read(
      config,
      user.subject,
      `/api/v1/integration/resources/${resource}${suffix}`,
    );
  }
}
