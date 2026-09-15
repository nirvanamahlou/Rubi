import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CustomerAffairsSiteController,
  CustomerAffairsSiteGuard,
  SiteTicketDto,
} from './customer-affairs-site.controller';
import { CustomerAffairsInternalController } from './customer-affairs-internal.controller';
import { CustomerAffairsService } from './customer-affairs.service';
import { createHash } from 'node:crypto';

const actor = {
  userId: 'connector',
  branchIds: ['branch', 'other'],
  permissions: [
    'customer_affairs.ticket.create',
    'customer_affairs.ticket.read',
  ],
};
function guardSetup(
  config: unknown = {
    jahanbastan: { userId: 'connector', branchId: 'branch' },
  },
) {
  const iam = {
    authenticate: vi.fn().mockResolvedValue(actor),
    assertPermissions: vi.fn(),
  };
  const request = {
    params: { site: 'jahanbastan' },
    method: 'POST',
    headers: { authorization: 'Bearer signed-access' },
    actor,
  };
  const guard = new CustomerAffairsSiteGuard(
    iam as never,
    {
      get: () => (typeof config === 'string' ? config : JSON.stringify(config)),
    } as never,
  );
  const context = { switchToHttp: () => ({ getRequest: () => request }) };
  return { guard, iam, request, context };
}
describe('Website integration boundary', () => {
  it('authenticates through IAM, enforces existing permission and narrows to bound branch', async () => {
    const { guard, iam, request, context } = guardSetup();
    expect(await guard.canActivate(context as never)).toBe(true);
    expect(iam.authenticate).toHaveBeenCalledWith('signed-access');
    expect(iam.assertPermissions).toHaveBeenCalledWith(actor, [
      'customer_affairs.ticket.create',
    ]);
    expect(request.actor.branchIds).toEqual(['branch']);
  });
  it('fails closed for missing, invalid or wrong-site bindings', async () => {
    for (const config of [
      {},
      '{invalid',
      null,
      { nystkt: { userId: 'connector', branchId: 'branch' } },
    ]) {
      const { guard, iam, context } = guardSetup(config);
      await expect(guard.canActivate(context as never)).rejects.toThrow();
      expect(iam.authenticate).not.toHaveBeenCalled();
    }
  });
  it('rejects wrong account, foreign branch and revoked IAM session', async () => {
    for (const config of [
      { jahanbastan: { userId: 'other', branchId: 'branch' } },
      { jahanbastan: { userId: 'connector', branchId: 'foreign' } },
    ]) {
      const { guard, context } = guardSetup(config);
      await expect(guard.canActivate(context as never)).rejects.toThrow();
    }
    const { guard, iam, context } = guardSetup();
    iam.authenticate.mockRejectedValueOnce(new Error('revoked'));
    await expect(guard.canActivate(context as never)).rejects.toThrow(
      'revoked',
    );
  });
  it('requires Bearer authentication and existing read permission for status', async () => {
    const { guard, request, iam, context } = guardSetup();
    request.headers.authorization = '';
    await expect(guard.canActivate(context as never)).rejects.toThrow();
    request.headers.authorization = 'Bearer signed-access';
    request.method = 'GET';
    await guard.canActivate(context as never);
    expect(iam.assertPermissions).toHaveBeenCalledWith(actor, [
      'customer_affairs.ticket.read',
    ]);
  });
  it('rejects forged assignment, priority and customer fields at the DTO boundary', async () => {
    const input = plainToInstance(SiteTicketDto, {
      externalId: 'order-1',
      subject: 'تیکت سایت',
      description: 'پیگیری سفارش سایت',
      occurredAt: '2026-09-12T10:00:00Z',
      priority: 'CRITICAL',
      customerId: 'victim',
    });
    const errors = await validate(input, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['priority', 'customerId']),
    );
  });
  it('uses a stable site-scoped key and only returns safe status fields', async () => {
    const affairs = {
      createTicket: vi.fn().mockResolvedValue({
        data: {
          trackingNumber: 'CA-1',
          status: 'NEW',
          updatedAt: 'now',
          description: 'private',
          timeline: ['private'],
          customerOwnerUserId: 'private',
        },
      }),
    };
    const repository = { findSite: vi.fn().mockResolvedValue({ id: 'site' }) };
    const controller = new CustomerAffairsSiteController(
      affairs as never,
      repository as never,
    );
    const input = {
      externalId: 'order-1',
      subject: 'تیکت سایت',
      description: 'پیگیری سفارش سایت',
      occurredAt: '2026-09-12T10:00:00Z',
    };
    const request = { actor: { ...actor, branchIds: ['branch'] } } as never;
    const first = await controller.create('jahanbastan', input, request);
    await controller.create('jahanbastan', input, request);
    expect(affairs.createTicket.mock.calls[0]).toEqual(
      affairs.createTicket.mock.calls[1],
    );
    expect(affairs.createTicket.mock.calls[0]?.[0]).toMatchObject({
      channel: 'WEBSITE',
      priority: 'NORMAL',
    });
    expect(first).toEqual({
      data: { trackingNumber: 'CA-1', status: 'NEW', updatedAt: 'now' },
    });
  });
  it('cannot fetch an external ID from another site', async () => {
    const affairs = { getTicket: vi.fn() };
    const repository = {
      findSite: vi.fn().mockResolvedValue({ id: 'site' }),
      findSiteTicket: vi.fn().mockResolvedValue(null),
    };
    const controller = new CustomerAffairsSiteController(
      affairs as never,
      repository as never,
    );
    await expect(
      controller.status('nystkt', 'order-1', { actor } as never),
    ).rejects.toThrow();
    expect(repository.findSiteTicket).toHaveBeenCalledWith('site', 'order-1');
    expect(affairs.getTicket).not.toHaveBeenCalled();
  });
});

describe('Internal unit referral API', () => {
  it('delegates an authorized response to the existing transactional workflow', async () => {
    const repository = {
      findReferral: vi.fn().mockResolvedValue({
        destinationModule: 'sales',
        ticket: { branchId: 'branch' },
      }),
    };
    const affairs = { respondReferral: vi.fn().mockResolvedValue({}) };
    const controller = new CustomerAffairsInternalController(
      repository as never,
      affairs as never,
    );
    const input = { status: 'DONE' as const, responseSummary: 'انجام شد' };
    const request = {
      actor: { ...actor, permissions: ['sales.contracts.read.branch'] },
    };
    expect(
      await controller.respond('sales', 'referral', input, request as never),
    ).toEqual({ data: { id: 'referral', status: 'DONE' } });
    expect(affairs.respondReferral).toHaveBeenCalledWith(
      'referral',
      input,
      request.actor,
    );
  });
  it('scopes the queue to the destination, recipient and authorized branches', async () => {
    const repository = { workbenchReferrals: vi.fn().mockResolvedValue([]) };
    const controller = new CustomerAffairsInternalController(
      repository as never,
      {} as never,
    );
    await controller.list('finance', {
      actor: { ...actor, permissions: ['finance.read'] },
    } as never);
    expect(repository.workbenchReferrals).toHaveBeenCalledWith(
      'connector',
      ['branch', 'other'],
      'finance',
    );
    await expect(
      controller.list('reservations', { actor } as never),
    ).rejects.toThrow();
  });
  it('does not allow another unit to respond to a referral', async () => {
    const repository = {
      findReferral: vi.fn().mockResolvedValue({
        destinationModule: 'sales',
        ticket: { branchId: 'branch' },
      }),
    };
    const affairs = { respondReferral: vi.fn() };
    const controller = new CustomerAffairsInternalController(
      repository as never,
      affairs as never,
    );
    await expect(
      controller.respond(
        'finance',
        'referral',
        { status: 'DONE', responseSummary: 'انجام شد' },
        { actor: { ...actor, permissions: ['finance.read'] } } as never,
      ),
    ).rejects.toThrow();
    expect(affairs.respondReferral).not.toHaveBeenCalled();
  });
});

describe('Site ticket persistence boundary', () => {
  const input = {
    subject: 'درخواست سایت',
    description: 'پیگیری درخواست',
    channel: 'WEBSITE' as const,
  };
  const origin = { siteId: 'site', externalId: 'order-1' };
  function setup(hash: string) {
    const repository = {
      findSiteTicket: vi
        .fn()
        .mockResolvedValue({ ticketId: 'ticket', fingerprint: hash }),
      transaction: vi.fn(),
    };
    const service = new CustomerAffairsService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const get = vi
      .spyOn(service, 'getTicket')
      .mockResolvedValue({ data: { id: 'ticket' } } as never);
    return { service, repository, get };
  }
  it('replays a site identity without another write even after account rotation', async () => {
    const hash = createHash('sha256')
      .update(JSON.stringify({ input, siteOrigin: origin }))
      .digest('hex');
    const { service, repository, get } = setup(hash);
    const rotated = { ...actor, userId: 'rotated', branchIds: ['branch'] };
    await service.createTicket(
      input as never,
      rotated as never,
      'branch',
      'site:key',
      undefined,
      origin,
    );
    expect(repository.transaction).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledWith('ticket', rotated);
  });
  it('rejects reuse of an external identity with changed content', async () => {
    const { service, repository, get } = setup('different');
    await expect(
      service.createTicket(
        input as never,
        actor as never,
        'branch',
        'site:key',
        undefined,
        origin,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(repository.transaction).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });
});
