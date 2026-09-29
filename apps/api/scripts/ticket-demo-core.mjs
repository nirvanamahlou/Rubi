import { createHash } from 'node:crypto';

export const dataset = 'pc-a-tickets-20260929';
const marker = `ticket.demo.${dataset}`;
const digest = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertLocalTarget(url, environment) {
  const target = new URL(url);
  if (
    !['development', 'test'].includes(environment) ||
    !['postgres:', 'postgresql:'].includes(target.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    !target.pathname.slice(1) ||
    [...target.searchParams].some(
      ([key, value]) => key !== 'schema' || value !== 'public',
    )
  ) {
    throw new Error(
      'Ticket demo commands require an explicit local development/test PostgreSQL database.',
    );
  }
}

export function validateFixture(fixture, config) {
  if (
    fixture.dataset !== dataset ||
    !uuid.test(config.actorUserId) ||
    !uuid.test(config.branchId)
  )
    throw new Error('Invalid dataset, actor or branch configuration.');
  for (const city of fixture.cities)
    if (!uuid.test(config.cities?.[city.key]))
      throw new Error(
        `Map the existing city: ${city.englishName || city.name}`,
      );
  const offers = new Set(fixture.offers.map((row) => row.id));
  const targets = new Set((fixture.targets ?? []).map((row) => row.id));
  const ids = new Set();
  for (const collection of [
    'offers',
    'targets',
    'standalone',
    'roundTrips',
    'commissions',
  ]) {
    for (const row of fixture[collection] ?? []) {
      if (!uuid.test(row.id) || ids.has(row.id))
        throw new Error('Duplicate or invalid fixture identity.');
      ids.add(row.id);
      for (const key of ['offerId', 'outboundOfferId', 'returnOfferId'])
        if (row[key] && !offers.has(row[key]))
          throw new Error('Fare references a ticket outside this dataset.');
      if (row.salePriceTargetId && !targets.has(row.salePriceTargetId))
        throw new Error('Unknown price target.');
      for (const key of ['amount', 'percent'])
        if (
          row[key] !== undefined &&
          (typeof row[key] !== 'string' || !/^\d+(\.\d{1,4})?$/.test(row[key]))
        )
          throw new Error(
            'Fixture amounts and percentages must be nonnegative decimal strings.',
          );
    }
  }
}

function canonicalDecimal(value) {
  const [whole, fraction = ''] = value.split('.');
  return `${whole.replace(/^0+(?=\d)/, '')}.${fraction.replace(/0+$/, '')}`;
}

function assertMatches(existing, expected) {
  for (const [key, value] of Object.entries(expected)) {
    const actual = existing[key];
    const equal =
      value instanceof Date
        ? new Date(actual).getTime() === value.getTime()
        : ['amount', 'percent'].includes(key)
          ? canonicalDecimal(String(actual)) === canonicalDecimal(value)
          : actual === value;
    if (!equal)
      throw new Error(
        `Existing record ${existing.id} differs at ${key}; nothing was changed.`,
      );
  }
}

// Preview executes the same constraints and rolls the entire transaction back.
export async function runTicketDemo(
  client,
  fixture,
  config,
  { apply = false, clear = false, adoptSource = false } = {},
) {
  validateFixture(fixture, config);
  let report;
  const previewRollback = new Error('ticket-demo-preview-rollback');
  try {
    await client.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(20260929, 465)',
        );
        const ids = fixture.offers.map((row) => row.id);
        const rows = await tx.ticketPublishedOffer.findMany({
          where: { id: { in: ids } },
          include: { audit: true },
        });
        const owned = rows.filter(
          (row) =>
            row.branchId === config.branchId &&
            row.audit.some((audit) => audit.action === marker),
        );
        report = {
          dataset,
          applied: apply,
          mode: clear ? 'archive' : 'import',
          created: 0,
          reused: 0,
          archived: 0,
        };
        if (clear) {
          for (const row of owned) {
            if (
              row.audit.some(
                (audit) => audit.action === 'ticket.offer.archived',
              )
            )
              continue;
            // Same row lock used by catalog capacity and archive commands.
            await tx.$queryRawUnsafe(
              'SELECT "id" FROM "TicketPublishedOffer" WHERE "id"=$1::uuid FOR UPDATE',
              row.id,
            );
            const active = await tx.ticketPublishedOffer.count({
              where: {
                id: row.id,
                OR: [
                  { capacityAllocations: { some: { status: 'ACTIVE' } } },
                  {
                    capacityHolds: {
                      some: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
                    },
                  },
                  { tourOutboundDepartures: { some: {} } },
                  { tourReturnDepartures: { some: {} } },
                ],
              },
            });
            if (active)
              throw new Error(
                `Demo ticket ${row.id} is in use; the entire cleanup was rolled back.`,
              );
            if (
              row.audit.some(
                (audit) => audit.action === 'ticket.offer.archived',
              )
            )
              continue;
            const updated = await tx.ticketPublishedOffer.update({
              where: { id: row.id },
              data: { status: 'PAUSED', version: { increment: 1 } },
            });
            await tx.ticketOfferAudit.create({
              data: {
                offerId: row.id,
                actorUserId: config.actorUserId,
                action: 'ticket.offer.archived',
                version: updated.version,
              },
            });
            report.archived++;
          }
          // Only newly imported demo targets carry this code; source/shared targets stay intact.
          await tx.ticketSalePriceTarget.updateMany({
            where: {
              branchId: config.branchId,
              code: { startsWith: `${dataset}:` },
              prices: {
                none: { offerId: { notIn: owned.map((row) => row.id) } },
              },
              commissions: {
                none: {
                  OR: [
                    { offerId: { notIn: owned.map((row) => row.id) } },
                    { returnOfferId: { notIn: owned.map((row) => row.id) } },
                  ],
                },
              },
            },
            data: { isActive: false },
          });
        } else {
          for (const target of fixture.targets ?? []) {
            const expected = {
              id: target.id,
              branchId: config.branchId,
              name: target.name,
              isActive: target.isActive,
            };
            const existing = await tx.ticketSalePriceTarget.findUnique({
              where: { id: target.id },
            });
            if (existing) {
              if (!existing.code.startsWith(`${dataset}:`) && !adoptSource)
                throw new Error(
                  'Existing price target requires --adopt-source.',
                );
              assertMatches(existing, expected);
            } else
              await tx.ticketSalePriceTarget.create({
                data: {
                  ...expected,
                  code: `${dataset}:${target.id}`,
                  createdByUserId: config.actorUserId,
                },
              });
          }
          for (const source of fixture.offers) {
            const { archived, ...fields } = source;
            const expected = {
              ...fields,
              branchId: config.branchId,
              originId: config.cities[source.originId],
              destinationId: config.cities[source.destinationId],
              departureAt: new Date(source.departureAt),
              arrivalAt: new Date(source.arrivalAt),
            };
            const existing = rows.find((row) => row.id === source.id);
            if (existing) {
              if (existing.branchId !== config.branchId)
                throw new Error('Ticket identity belongs to another branch.');
              if (!owned.some((row) => row.id === source.id)) {
                if (!adoptSource)
                  throw new Error(
                    'Existing source tickets require explicit --adopt-source.',
                  );
                assertMatches(existing, expected);
                await tx.ticketOfferAudit.create({
                  data: {
                    offerId: source.id,
                    actorUserId: config.actorUserId,
                    action: marker,
                    version: existing.version,
                  },
                });
              }
              report.reused++;
            } else {
              await tx.ticketPublishedOffer.create({
                data: {
                  ...expected,
                  createKey: `${dataset}:${source.id}`,
                  fingerprint: digest(expected),
                  createdByUserId: config.actorUserId,
                  audit: {
                    create: [
                      {
                        actorUserId: config.actorUserId,
                        action: marker,
                        version: 1,
                      },
                      ...(archived
                        ? [
                            {
                              actorUserId: config.actorUserId,
                              action: 'ticket.offer.archived',
                              version: 1,
                            },
                          ]
                        : []),
                    ],
                  },
                },
              });
              report.created++;
            }
          }
          for (const [collection, model] of [
            ['standalone', 'ticketOfferStandaloneSalePrice'],
            ['roundTrips', 'ticketOfferRoundTripSalePrice'],
            ['commissions', 'ticketSaleCommissionRevision'],
          ]) {
            for (const source of fixture[collection] ?? []) {
              const expected = {
                ...source,
                occurredAt: new Date(source.occurredAt),
              };
              const existing = await tx[model].findUnique({
                where: { id: source.id },
              });
              if (existing) assertMatches(existing, expected);
              else
                await tx[model].create({
                  data: {
                    ...expected,
                    actorUserId: config.actorUserId,
                    commandKey: `${dataset}:${source.id}`,
                    fingerprint: digest(expected),
                    ...(collection === 'commissions'
                      ? {
                          scopeKey: [
                            source.offerId,
                            source.returnOfferId ?? 'ONEWAY',
                            source.salePriceTargetId ?? 'DIRECT',
                          ].join(':'),
                        }
                      : {}),
                  },
                });
            }
          }
        }
        if (!apply) throw previewRollback;
      },
      { isolationLevel: 'Serializable', timeout: 60000 },
    );
  } catch (error) {
    if (error !== previewRollback) throw error;
  }
  return report;
}
