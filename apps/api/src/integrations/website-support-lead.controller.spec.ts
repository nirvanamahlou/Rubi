import { createHmac } from 'node:crypto';
import { Module, type RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { Request } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureApplication } from '../configure-application';
import { CustomerAffairsMarketingIntakeService } from '../customer-affairs/customer-affairs-marketing-intake.service';
import { commerceSites } from '../site-commerce/commerce-sites';
import { WebsiteSupportLeadController } from './website-support-lead.controller';

vi.mock(
  '../customer-affairs/customer-affairs-marketing-intake.service',
  () => ({
    CustomerAffairsMarketingIntakeService: class {},
  }),
);

const secret = 'support-intake-unit-test-secret-longer-than-32-bytes';
const contact = {
  questionId: 'support-12-46',
  fullName: 'نام آزمایشی',
  phone: '09120000000',
  askedAt: '2026-01-24T12:30:05.123456+00:00',
};

function signed(
  site: string,
  input: unknown,
  timestamp = String(Math.floor(Date.now() / 1000)),
) {
  const rawBody = Buffer.from(JSON.stringify(input));
  const signature = createHmac('sha256', secret)
    .update(`support-lead.v1.${site}.${timestamp}.`)
    .update(rawBody)
    .digest('hex');
  return {
    rawBody,
    get: (name: string) =>
      ({ 'x-erp-timestamp': timestamp, 'x-erp-signature': signature })[
        name as 'x-erp-timestamp' | 'x-erp-signature'
      ],
  } as RawBodyRequest<Request>;
}

function setup() {
  const captureWebsiteSupportLead = vi.fn();
  const bindings = Object.fromEntries(
    Object.entries(commerceSites).map(([site, config]) => {
      vi.stubEnv(config.signingKey, secret);
      return [site, { branchId: `branch-${site}`, userId: `service-${site}` }];
    }),
  );
  vi.stubEnv('SITE_COMMERCE_BINDINGS', JSON.stringify(bindings));
  return {
    captureWebsiteSupportLead,
    controller: new WebsiteSupportLeadController({
      captureWebsiteSupportLead,
    } as never),
  };
}

afterEach(() => vi.unstubAllEnvs());

describe('website support lead intake', () => {
  it.each([
    ['jahan-bastan', 'سایت جهان باستان'],
    ['ghestiroo', 'سایت قسطی رو'],
    ['nss', 'سایت نیایش سیر سحر'],
  ])(
    'binds %s to its own active source and original date',
    async (site, source) => {
      const { controller, captureWebsiteSupportLead } = setup();
      await expect(
        controller.capture(site, signed(site, contact)),
      ).resolves.toEqual({
        accepted: true,
      });
      expect(captureWebsiteSupportLead).toHaveBeenCalledWith(
        {
          firstName: 'نام',
          lastName: 'آزمایشی',
          phone: contact.phone,
          entryDate: '2026-01-24T12:30:05.123Z',
          sourceCategory: source,
          status: 'NEW',
        },
        expect.objectContaining({
          userId: `service-${site}`,
          branchIds: [`branch-${site}`],
        }),
        `support-lead:${site}:${contact.questionId}`,
      );
    },
  );

  it('rejects cross-site, stale and body-modified signatures and extra data', async () => {
    const { controller, captureWebsiteSupportLead } = setup();
    const site = 'jahan-bastan';
    const stale = String(Math.floor(Date.now() / 1000) - 301);
    const modified = signed(site, contact);
    modified.rawBody = Buffer.from(
      JSON.stringify({ ...contact, phone: '09121111111' }),
    );
    for (const request of [
      signed('nss', contact),
      signed(site, contact, stale),
      modified,
    ]) {
      await expect(controller.capture(site, request)).rejects.toMatchObject({
        status: 401,
      });
    }
    await expect(
      controller.capture(site, signed(site, { ...contact, question: 'extra' })),
    ).rejects.toMatchObject({ status: 400 });
    expect(captureWebsiteSupportLead).not.toHaveBeenCalled();
  });

  it('authenticates the exact JSON bytes over the configured HTTP stack', async () => {
    const { captureWebsiteSupportLead } = setup();
    @Module({
      controllers: [WebsiteSupportLeadController],
      providers: [
        {
          provide: CustomerAffairsMarketingIntakeService,
          useValue: { captureWebsiteSupportLead },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) =>
              ({
                API_PREFIX: 'api/v1',
                CORS_ORIGINS: '',
                ENABLE_SWAGGER: false,
              })[key as 'API_PREFIX'],
          },
        },
      ],
    })
    class TestModule {}
    const app = await NestFactory.create(TestModule, { logger: false });
    configureApplication(app);
    await app.listen(0, '127.0.0.1');
    try {
      const request = signed('nss', { ...contact, fullName: 'الف'.repeat(50) });
      const response = await fetch(
        `${await app.getUrl()}/api/v1/site-commerce/nss/support-lead`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-erp-timestamp': request.get('x-erp-timestamp')!,
            'x-erp-signature': request.get('x-erp-signature')!,
          },
          body: request.rawBody!.toString('utf8'),
        },
      );
      expect(response.status).toBe(202);
      expect(captureWebsiteSupportLead).toHaveBeenCalledOnce();
    } finally {
      await app.close();
    }
  });
});
