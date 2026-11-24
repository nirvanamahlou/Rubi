import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Controller,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CustomerAffairsMarketingIntakeService } from '../customer-affairs/customer-affairs-marketing-intake.service';
import { commerceSites, isDeliverySite } from '../site-commerce/commerce-sites';
import { websiteSupportActor } from '../site-commerce/site-commerce.policy';

const sourceNames = {
  'jahan-bastan': 'سایت جهان باستان',
  ghestiroo: 'سایت قسطی رو',
  nss: 'سایت نیایش سیر سحر',
} as const;

function supportQuestion(body: Buffer) {
  let data: unknown;
  try {
    data = JSON.parse(body.toString('utf8'));
  } catch {
    throw new BadRequestException();
  }
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    Object.keys(data).length !== 4
  )
    throw new BadRequestException();
  const { questionId, fullName, phone, askedAt } = data as Record<
    string,
    unknown
  >;
  if (
    typeof questionId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(questionId) ||
    typeof fullName !== 'string' ||
    !fullName.trim() ||
    fullName.length > 150 ||
    /\p{Cc}/u.test(fullName) ||
    typeof phone !== 'string' ||
    !/^\+?[0-9]{10,15}$/.test(phone) ||
    typeof askedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|\+00:00)$/.test(
      askedAt,
    )
  )
    throw new BadRequestException();
  const time = new Date(askedAt);
  if (
    !Number.isFinite(time.getTime()) ||
    time.getTime() > Date.now() + 300_000 ||
    time.toISOString().slice(0, 19) !== askedAt.slice(0, 19)
  )
    throw new BadRequestException();
  const name = fullName.trim().replace(/\s+/gu, ' ');
  const [first, ...parts] = name.split(' ');
  const rest = parts.join(' ');
  const points = Array.from(name);
  // Keep valid long names within the existing two 100-character columns.
  const firstName =
    first!.length <= 100 && rest.length <= 100
      ? first!
      : points.slice(0, 75).join('').trimEnd();
  const lastName =
    first!.length <= 100 && rest.length <= 100
      ? rest
      : points.slice(75).join('').trimStart();
  return {
    questionId,
    phone,
    firstName,
    lastName,
    entryDate: time.toISOString(),
  };
}

@Controller('site-commerce/:site/support-lead')
export class WebsiteSupportLeadController {
  constructor(
    @Inject(CustomerAffairsMarketingIntakeService)
    private readonly intakes: CustomerAffairsMarketingIntakeService,
  ) {}

  @Post()
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  async capture(
    @Param('site') site: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    if (!isDeliverySite(site)) throw new UnauthorizedException();
    const key = process.env[commerceSites[site].signingKey];
    const timestamp = request.get('x-erp-timestamp') ?? '';
    const signature = request.get('x-erp-signature') ?? '';
    const body = request.rawBody;
    if (
      !key ||
      Buffer.byteLength(key) < 32 ||
      !body?.length ||
      body.length > 2048 ||
      !/^\d{10}$/.test(timestamp) ||
      Math.abs(Date.now() - Number(timestamp) * 1000) > 300_000 ||
      !/^[a-f0-9]{64}$/.test(signature)
    )
      throw new UnauthorizedException();
    const expected = createHmac('sha256', key)
      .update(`support-lead.v1.${site}.${timestamp}.`, 'utf8')
      .update(body)
      .digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex')))
      throw new UnauthorizedException();
    const { questionId, ...contact } = supportQuestion(body);
    await this.intakes.captureWebsiteSupportLead(
      { ...contact, sourceCategory: sourceNames[site], status: 'NEW' },
      websiteSupportActor(site),
      `support-lead:${site}:${questionId}`,
    );
    return { accepted: true };
  }
}
