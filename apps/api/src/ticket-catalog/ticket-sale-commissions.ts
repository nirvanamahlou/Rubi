import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@nora/database';
import type {
  AuthenticatedActor,
  TicketOfferV1,
  TicketSalePriceTargetV1,
  TicketSaleCommissionUpdateV1,
} from '@nora/contracts';
import * as Joi from 'joi';
import type { DatabaseService } from '../database/database.service';

export function commissionAmount(amount: string, percent: string) {
  const Decimal = Prisma.Decimal.clone({ precision: 40 });
  return new Decimal(amount)
    .mul(new Decimal(100).minus(percent))
    .div(100)
    .toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
    .toString();
}
export type CommissionRow = {
  returnOfferId: string | null;
  salePriceTargetId: string | null;
  revision: number;
  percent: Prisma.Decimal;
  target?: TicketSalePriceTargetV1 | null;
};
export function applySaleCommissions(
  offer: TicketOfferV1,
  rows: readonly CommissionRow[],
): TicketOfferV1 {
  const latest = new Map<string, CommissionRow>();
  for (const row of rows) {
    const key =
      (row.returnOfferId ?? 'ONEWAY') +
      ':' +
      (row.salePriceTargetId ?? 'DIRECT');
    if (!latest.has(key) || latest.get(key)!.revision < row.revision)
      latest.set(key, row);
  }
  const base = offer.standaloneSalePrice ?? null;
  const commissions = [...latest.values()].flatMap((row) => {
    const fare = row.returnOfferId
      ? offer.roundTripSalePrices?.find(
          (p) => p.returnOfferId === row.returnOfferId,
        )
      : base;
    return fare
      ? [
          {
            returnOfferId: row.returnOfferId,
            salePriceTargetId: row.salePriceTargetId,
            revision: row.revision,
            percent: row.percent.toString(),
            amount: commissionAmount(fare.amount, row.percent.toString()),
            currencyCode: fare.currencyCode,
            ...(fare.tiers?.length
              ? {
                  tiers: fare.tiers.map((tier) => ({
                    seatCount: tier.seatCount,
                    amount: commissionAmount(
                      tier.amount,
                      row.percent.toString(),
                    ),
                  })),
                }
              : {}),
          },
        ]
      : [];
  });
  const targeted = new Map(
    (offer.targetedStandaloneSalePrices ?? []).map((price) => [
      price.salePriceTarget.id,
      price,
    ]),
  );
  for (const row of latest.values()) {
    if (row.returnOfferId || !row.target) continue;
    const price = commissions.find(
      (c) => !c.returnOfferId && c.salePriceTargetId === row.salePriceTargetId,
    );
    if (price)
      targeted.set(row.target.id, {
        revision: price.revision,
        amount: price.amount,
        currencyCode: price.currencyCode,
        ...(price.tiers?.length ? { tiers: price.tiers } : {}),
        salePriceTarget: row.target,
      });
  }
  const direct = commissions.find(
    (c) => !c.returnOfferId && !c.salePriceTargetId,
  );
  return {
    ...offer,
    baseStandaloneSalePrice: base,
    saleCommissions: commissions,
    standaloneSalePrice:
      base && direct
        ? { ...base, amount: direct.amount, tiers: direct.tiers }
        : base,
    targetedStandaloneSalePrices: [...targeted.values()].map((price) => {
      const c = commissions.find(
        (c) =>
          !c.returnOfferId && c.salePriceTargetId === price.salePriceTarget.id,
      );
      return c
        ? {
            ...price,
            amount: c.amount,
            currencyCode: c.currencyCode,
            tiers: c.tiers,
          }
        : price;
    }),
    roundTripSalePrices: (offer.roundTripSalePrices ?? []).map((price) => {
      const c = commissions.find(
        (c) => c.returnOfferId === price.returnOfferId && !c.salePriceTargetId,
      );
      return {
        ...price,
        baseAmount: price.amount,
        baseTiers: price.tiers,
        amount: c?.amount ?? price.amount,
        tiers: c?.tiers ?? price.tiers,
      };
    }),
  };
}

const uuid = Joi.string().guid();
const schema = Joi.object({
  offerId: uuid.required(),
  returnOfferId: uuid.allow(null).optional(),
  salePriceTargetId: uuid.allow(null).optional(),
  percent: Joi.string()
    .pattern(/^(?:0|[1-9]\d?|100)(?:\.\d{1,4})?$/)
    .required(),
  expectedRevision: Joi.number().integer().min(0).required(),
  expectedBaseRevision: Joi.number().integer().min(1).required(),
  copyToAll: Joi.boolean().optional(),
});
const scopeKey = (
  offerId: string,
  returnId: string | null,
  targetId: string | null,
) => [offerId, returnId ?? 'ONEWAY', targetId ?? 'DIRECT'].join(':');

export async function saveTicketSaleCommission(
  database: DatabaseService,
  input: TicketSaleCommissionUpdateV1,
  actor: AuthenticatedActor,
  key?: string,
) {
  if (!actor.permissions.includes('ticket_catalog.manage'))
    throw new ForbiddenException('مجوز قیمت‌گذاری بلیت لازم است.');
  if (
    schema.validate(input, { convert: false }).error ||
    !key?.trim() ||
    key.length > 160 ||
    new Prisma.Decimal(input.percent).gt(100) ||
    input.returnOfferId === input.offerId
  )
    throw new BadRequestException(
      'درصد کمیسیون باید بین صفر و صد باشد و اطلاعات بلیت معتبر باشد.',
    );
  const targetId = input.salePriceTargetId ?? null;
  const returnId = input.returnOfferId ?? null;
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ ...input, actorUserId: actor.userId }))
    .digest('hex');
  try {
    return await database.client.$transaction(
      async (tx) => {
        const source = await tx.ticketPublishedOffer.findFirst({
          where: {
            id: input.offerId,
            branchId: { in: actor.branchIds },
            audit: { none: { action: 'ticket.offer.archived' } },
          },
          select: { id: true, branchId: true },
        });
        if (!source)
          throw new ForbiddenException('بلیت در شعبه مجاز یافت نشد.');
        if (
          targetId &&
          !(await tx.ticketSalePriceTarget.findFirst({
            where: { id: targetId, branchId: source.branchId, isActive: true },
            select: { id: true },
          }))
        )
          throw new BadRequestException(
            'مقصد فروش باید فعال و متعلق به شعبه بلیت باشد.',
          );
        // Lock all affected offers in a stable order, shared with base-fare writers.
        const ids = input.copyToAll
          ? (
              await tx.ticketPublishedOffer.findMany({
                where: {
                  branchId: source.branchId,
                  departureAt: { gt: new Date() },
                  audit: { none: { action: 'ticket.offer.archived' } },
                },
                select: { id: true },
              })
            ).map((o) => o.id)
          : [input.offerId, ...(returnId ? [returnId] : [])];
        ids.sort();
        if (ids.length)
          await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM "TicketPublishedOffer" WHERE "id" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY "id" FOR UPDATE`,
          );
        const replay = await tx.ticketSaleCommissionRevision.findUnique({
          where: {
            scopeKey_commandKey: {
              scopeKey: scopeKey(input.offerId, returnId, targetId),
              commandKey: key,
            },
          },
        });
        if (replay) {
          if (replay.fingerprint !== fingerprint)
            throw new ConflictException(
              'کلید درخواست با اطلاعات متفاوت استفاده شده است.',
            );
          return {
            data: {
              count: await tx.ticketSaleCommissionRevision.count({
                where: { commandKey: key, fingerprint },
              }),
              revision: replay.revision,
            },
          };
        }
        const offers = await tx.ticketPublishedOffer.findMany({
          where: {
            id: { in: ids },
            branchId: source.branchId,
            departureAt: { gt: new Date() },
            audit: { none: { action: 'ticket.offer.archived' } },
          },
          include: {
            standaloneSalePrices: {
              where: { salePriceTargetId: null },
              orderBy: { revision: 'desc' },
              take: 1,
            },
            outboundRoundTripSalePrices: { orderBy: { revision: 'desc' } },
            saleCommissions: {
              where: { salePriceTargetId: targetId },
              orderBy: { revision: 'desc' },
            },
          },
        });
        const availableIds = new Set(offers.map((offer) => offer.id));
        const items = offers.flatMap((offer) => {
          const pairs = new Map<
            string,
            (typeof offer.outboundRoundTripSalePrices)[number]
          >();
          for (const price of offer.outboundRoundTripSalePrices)
            if (
              availableIds.has(price.returnOfferId) &&
              !pairs.has(price.returnOfferId)
            )
              pairs.set(price.returnOfferId, price);
          return [
            ...(offer.standaloneSalePrices[0]
              ? [
                  {
                    offer,
                    returnId: null as string | null,
                    base: offer.standaloneSalePrices[0],
                  },
                ]
              : []),
            ...[...pairs.values()].map((base) => ({
              offer,
              returnId: base.returnOfferId,
              base,
            })),
          ];
        });
        const sourceItem = items.find(
          (i) => i.offer.id === input.offerId && i.returnId === returnId,
        );
        if (!sourceItem)
          throw new BadRequestException(
            'ابتدا قیمت پایه بلیت را ثبت کنید؛ بلیت باید تاریخ آینده داشته باشد.',
          );
        const current = sourceItem.offer.saleCommissions.find(
          (c) => c.returnOfferId === returnId,
        );
        if (
          sourceItem.base.revision !== input.expectedBaseRevision ||
          (current?.revision ?? 0) !== input.expectedRevision
        )
          throw new ConflictException(
            'قیمت یا کمیسیون تغییر کرده است؛ فهرست را به‌روزرسانی کنید.',
          );
        const selected = input.copyToAll ? items : [sourceItem];
        let sourceRevision = 0;
        for (const item of selected) {
          const previous = item.offer.saleCommissions.find(
            (c) => c.returnOfferId === item.returnId,
          );
          const revision = (previous?.revision ?? 0) + 1;
          await tx.ticketSaleCommissionRevision.create({
            data: {
              offerId: item.offer.id,
              returnOfferId: item.returnId,
              salePriceTargetId: targetId,
              scopeKey: scopeKey(item.offer.id, item.returnId, targetId),
              revision,
              percent: new Prisma.Decimal(input.percent),
              actorUserId: actor.userId,
              commandKey: key,
              fingerprint,
            },
          });
          if (item === sourceItem) sourceRevision = revision;
        }
        return { data: { count: selected.length, revision: sourceRevision } };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30000,
      },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2034'].includes(error.code)
    )
      throw new ConflictException(
        'قیمت‌ها هم‌زمان تغییر کردند؛ دوباره دریافت و تلاش کنید.',
      );
    throw error;
  }
}
