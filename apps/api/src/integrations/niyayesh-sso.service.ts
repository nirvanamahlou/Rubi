import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  canViewScreen,
  canViewIntegrationSection,
  type AuthenticatedActor,
} from '@nora/contracts';
import { IamService } from '../iam/iam.service';
import { NiyayeshService } from './niyayesh.service';

type SitePolicy = {
  enabled: boolean;
  launchUrl: string;
  noraOrigin?: string;
  serviceSecret: string;
  grants: string[];
  permissions: string[];
  organization: string;
  system: string;
};

@Injectable()
export class NiyayeshSsoService {
  constructor(
    @Inject(IamService) private readonly iam: IamService,
    @Inject(NiyayeshService) private readonly site: NiyayeshService,
  ) {}
  async policy(): Promise<SitePolicy> {
    const file = process.env.NORA_SSO_POLICY_FILE;
    if (!file)
      throw new ServiceUnavailableException('ورود یکپارچه تنظیم نشده است.');
    try {
      const text = await readFile(file, 'utf8');
      if (text.length > 65536) throw Error();
      const policy = JSON.parse(text) as SitePolicy;
      const url = new URL(policy.launchUrl);
      if (policy.noraOrigin) {
        const origin = new URL(policy.noraOrigin);
        if (
          origin.username ||
          origin.password ||
          origin.search ||
          origin.hash ||
          origin.pathname !== '/' ||
          (origin.protocol !== 'https:' &&
            !(
              process.env.NODE_ENV === 'development' &&
              origin.origin === 'http://nora.localhost:3100'
            ))
        )
          throw Error();
      }
      const local =
        process.env.NODE_ENV === 'development' &&
        url.protocol === 'http:' &&
        ['127.0.0.1', 'localhost', 'niyayesh.localhost'].includes(
          url.hostname,
        ) &&
        url.port === '18025';
      if (
        (!local && url.protocol !== 'https:') ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !policy.enabled ||
        typeof policy.serviceSecret !== 'string' ||
        policy.serviceSecret.length < 32 ||
        !Array.isArray(policy.grants) ||
        !Array.isArray(policy.permissions) ||
        !policy.organization ||
        !policy.system
      )
        throw Error();
      return policy;
    } catch {
      throw new ServiceUnavailableException('ورود یکپارچه آماده نیست.');
    }
  }
  async claims(actor: AuthenticatedActor, branch: string) {
    const policy = await this.policy();
    const binding = await this.site.binding(actor, branch);
    if (
      !binding ||
      !canViewIntegrationSection(actor.permissions, 'connections') ||
      !canViewScreen(actor.permissions, 'integrations.niyayesh.login')
    )
      throw new ForbiddenException('مجوز ورود به نیایش فعال نیست.');
    const importKinds: Record<string, string> = {
      'hotel-imports': 'hotels',
      'tour-price-imports': 'tour-prices',
      'ticket-imports': 'tickets',
    };
    const targetKinds: Record<string, string> = {
      hotels: 'hotels',
      tours: 'tour-prices',
      'service-offers': 'tickets',
    };
    const grants = policy.grants.filter((g) => {
      if (g === 'panel.login') return true;
      const [resource, operation] = g.split('.');
      if (
        !resource ||
        !operation ||
        resource === 'users' ||
        resource === 'management-reports'
      )
        return false;
      const kind = importKinds[resource];
      if (kind)
        return (
          binding.user.resources.includes(this.site.importTarget(kind)) &&
          this.site.canImport(actor, kind)
        );
      if (resource === 'site-analytics')
        return (
          operation === 'read' &&
          binding.user.resources.includes(resource) &&
          canViewScreen(actor.permissions, 'integrations.niyayesh.analytics')
        );
      if (resource === 'events')
        return (
          operation === 'read' &&
          canViewScreen(actor.permissions, 'integrations.niyayesh.analytics') &&
          canViewIntegrationSection(actor.permissions, 'logs')
        );
      if (!binding.user.resources.includes(resource)) return false;
      if (operation === 'publish')
        return (
          (canViewScreen(actor.permissions, 'integrations.niyayesh.publish') &&
            this.site.canEdit(actor, resource)) ||
          (!!targetKinds[resource] &&
            this.site.canImport(actor, targetKinds[resource]))
        );
      if (operation !== 'read')
        return (
          ['create', 'update', 'bulk', 'export'].includes(operation) &&
          (this.site.canEdit(actor, resource) ||
            (!!targetKinds[resource] &&
              this.site.canImport(actor, targetKinds[resource])))
        );
      return true;
    });
    if (!grants.includes('panel.login'))
      throw new ForbiddenException('مجوز ورود فعال نیست.');
    const modules: Record<string, string> = {
      countries: 'catalog',
      airlines: 'catalog',
      destinations: 'catalog',
      categories: 'catalog',
      hotels: 'hotels',
      visas: 'visas',
      tours: 'tours',
      'service-offers': 'tickets',
      'editorial-content': 'content',
      'exchange-rates': 'rates',
      'customer-accounts': 'customers',
      'customer-travelers': 'customers',
      'customer-orders': 'customers',
      'customer-cart-items': 'customers',
      'support-threads': 'customers',
      'travel-requests': 'customers',
      'hotel-imports': 'excel',
      'tour-price-imports': 'excel',
      'ticket-imports': 'excel',
      'site-analytics': 'catalog',
    };
    const permittedModules = new Set(
      grants.map((g) => modules[g.split('.')[0]!]),
    );
    const permissions = policy.permissions.filter((p) =>
      permittedModules.has(p),
    );
    return {
      sub: actor.userId,
      nora_session: actor.sessionId,
      nora_branch: branch,
      nora_actor: binding.user.subject,
      nora_system: policy.system,
      nora_organization: policy.organization,
      nora_permissions: permissions,
      nora_grants: grants,
      nora_provision: canViewScreen(
        actor.permissions,
        'integrations.niyayesh.provision',
      ),
    };
  }
  async access(actor: AuthenticatedActor, branch: string) {
    try {
      await this.claims(actor, branch);
      return {
        enabled: true,
        noraOrigin: (await this.policy()).noraOrigin,
        launchUrl: `${(await this.policy()).launchUrl}?branchId=${encodeURIComponent(branch)}`,
      };
    } catch {
      return { enabled: false };
    }
  }
  async inspect(authorization: string | undefined, input: unknown) {
    const policy = await this.policy();
    const supplied = Buffer.from(authorization?.replace(/^Bearer /, '') ?? '');
    const expected = Buffer.from(policy.serviceSecret);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      throw new ForbiddenException('درخواست سرویس معتبر نیست.');
    const value = input as {
      userId?: string;
      sessionId?: string;
      branchId?: string;
      intent?: string;
    };
    if (
      ![value?.userId, value?.sessionId, value?.branchId].every(
        (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v),
      )
    )
      return { active: false };
    try {
      const actor = await this.iam.authenticateSessionReferenceV1(
        value.userId!,
        value.sessionId!,
        true,
      );
      const claims = await this.claims(actor, value.branchId!);
      if (value.intent === 'LOGIN')
        await this.iam.recordSelfActivity(
          actor,
          'integrations.niyayesh.sso.authorize',
          'external_identity',
          `${value.branchId}:niyayesh`,
        );
      return { active: true, ...claims };
    } catch {
      return { active: false };
    }
  }
}
