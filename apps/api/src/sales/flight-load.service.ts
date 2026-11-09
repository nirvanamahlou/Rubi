import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { readLegacyServiceParties, ticketCalendarDate } from '@nora/contracts';
import type {
  AuthenticatedActor,
  FlightLoadCompositionV1,
  FlightLoadContractsV1,
  SalesServiceInput,
  SalesTicketSelectionInput,
} from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { TicketPublicService } from '../ticket-catalog/ticket-public.service';
import { MasterDataService } from '../master-data/master-data.service';
import { passengerAgeYears } from './sales.domain';
import { readReservationReportingCancellations } from '../reservations/reservation-reporting-cancellations.public';

export const emptyFlightComposition = (): FlightLoadCompositionV1 => ({
  adults: 0,
  children2To6: 0,
  children6To12: 0,
  childrenUnknownAge: 0,
  infants: 0,
  passengers: 0,
  seats: 0,
});

@Injectable()
export class FlightLoadService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(TicketPublicService) private readonly tickets: TicketPublicService,
    @Inject(MasterDataService) private readonly master: MasterDataService,
  ) {}

  async contracts(
    offerId: string,
    actor: AuthenticatedActor,
    cancelled = false,
  ): Promise<FlightLoadContractsV1> {
    if (!actor.permissions.includes('ticket_catalog.read'))
      throw new ForbiddenException('مجوز مشاهده اطلاعات بلیط وجود ندارد.');
    const all = actor.permissions.includes('sales.contracts.read.all');
    const branch = actor.permissions.includes('sales.contracts.read.branch');
    if (
      !all &&
      !branch &&
      !actor.permissions.includes('sales.contracts.read.own')
    )
      throw new ForbiddenException('مجوز مشاهده قرارداد وجود ندارد.');
    // Validates UUID, visibility and exact offer identity via its owning module.
    await this.tickets.documentDetails(offerId, actor);
    const scope: Prisma.SalesContractWhereInput = all
      ? {}
      : {
          branchId: { in: [...actor.branchIds] },
          ...(!branch ? { ownerUserId: actor.userId } : {}),
        };
    const candidates = await this.database.client.salesContract.findMany({
      where: {
        AND: [
          scope,
          {
            branchId: { in: [...actor.branchIds] },
            ticketSelections: { some: { offerId } },
            status: {
              in: [
                'CONFIRMED',
                'SENT_TO_RESERVATIONS',
                'IN_PROGRESS',
                'COMPLETED',
                ...(cancelled ? (['CANCELLED'] as const) : []),
              ],
            },
          },
        ],
      },
      select: {
        id: true,
        contractNumber: true,
        customerNameSnapshot: true,
        status: true,
        branchId: true,
        ticketSelections: true,
        services: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { id: true, clientKey: true, kind: true, metadata: true },
        },
        passengers: {
          select: {
            ageCategory: true,
            childAgeBand: true,
            birthDate: true,
            allocations: { select: { serviceId: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 10001,
    });
    if (candidates.length > 10000)
      throw new BadRequestException(
        'تعداد قراردادها بیش از حد مجاز گزارش است.',
      );
    const cancellations = await readReservationReportingCancellations(
      this.database.client,
      candidates.map((row) => row.id),
    );
    const rows = candidates.filter((row) => {
      const isCancelled =
        row.status === 'CANCELLED' || cancellations.has(row.id);
      return cancelled ? isCancelled : !isCancelled;
    });
    const cityIds = [
      ...new Set(
        rows.flatMap((r) =>
          r.ticketSelections
            .filter((s) => s.offerId === offerId)
            .flatMap((s) => [s.originId, s.destinationId]),
        ),
      ),
    ];
    const cities = new Map(
      await Promise.all(
        cityIds.map(async (id) => {
          const { data } = await this.master.detail('cities', id);
          return [id, data.name] as const;
        }),
      ),
    );
    const current = new Map<string, SalesTicketSelectionInput>();
    for (const branchId of new Set(rows.map((r) => r.branchId))) {
      const selections = rows
        .filter((r) => r.branchId === branchId)
        .flatMap((r) =>
          r.ticketSelections.map((s) => ({
            ...s,
            serviceClientKey: r.services.find((v) => v.id === s.serviceId)!
              .clientKey,
            departureAt: s.departureAt.toISOString(),
            arrivalAt: s.arrivalAt.toISOString(),
          })),
        );
      const facts = await this.tickets.currentSelections(selections, branchId);
      for (const s of facts) current.set(`${branchId}:${s.offerId}`, s);
    }
    const data = rows
      .map((row) => {
        const selected = row.ticketSelections.find(
          (s) => s.offerId === offerId,
        )!;
        const flight = current.get(`${row.branchId}:${offerId}`)!;
        const returning = row.ticketSelections.find(
          (s) => s.direction === 'RETURN',
        );
        const outbound = row.ticketSelections.find(
          (s) => s.direction === 'OUTBOUND',
        );
        const composition = emptyFlightComposition();
        // Input order is not stored separately; equal createdAt values must not
        // displace the service holding the aggregate metadata marker.
        const services = [...row.services].sort(
          (a, b) =>
            Number(
              Boolean(
                (b.metadata as Record<string, unknown> | null)
                  ?.legacyServicePartiesV2,
              ),
            ) -
            Number(
              Boolean(
                (a.metadata as Record<string, unknown> | null)
                  ?.legacyServicePartiesV2,
              ),
            ),
        ) as unknown as Pick<
          SalesServiceInput,
          'clientKey' | 'kind' | 'metadata'
        >[];
        const parties = readLegacyServiceParties(services);
        const serviceKey = row.services.find(
          (s) => s.id === selected.serviceId,
        )!.clientKey;
        if (parties) {
          const party = parties[serviceKey]!;
          composition.adults = party.adults;
          composition.childrenUnknownAge = party.children;
          composition.infants = party.infants;
        } else {
          for (const p of row.passengers.filter((p) =>
            p.allocations.some((a) => a.serviceId === selected.serviceId),
          )) {
            if (p.ageCategory === 'ADT') composition.adults++;
            else if (p.ageCategory === 'INF') composition.infants++;
            else if (!p.birthDate && !p.childAgeBand)
              composition.childrenUnknownAge++;
            else if (
              p.childAgeBand === 'AGE_2_6' ||
              (!p.childAgeBand &&
                p.birthDate &&
                passengerAgeYears(
                  p.birthDate.toISOString().slice(0, 10),
                  ticketCalendarDate(flight.departureAt),
                ) < 6)
            )
              composition.children2To6++;
            else composition.children6To12++;
          }
        }
        composition.seats =
          composition.adults +
          composition.children2To6 +
          composition.children6To12 +
          composition.childrenUnknownAge;
        composition.passengers = composition.seats + composition.infants;
        return {
          id: row.id,
          contractNumber: row.contractNumber,
          customerName: row.customerNameSnapshot,
          status: cancellations.has(row.id)
            ? ('CANCELLED' as const)
            : row.status,
          direction: selected.direction,
          originId: selected.originId,
          destinationId: selected.destinationId,
          originName: cities.get(selected.originId)!,
          destinationName: cities.get(selected.destinationId)!,
          departureAt: flight.departureAt,
          outboundAt: outbound
            ? current.get(`${row.branchId}:${outbound.offerId}`)!.departureAt
            : null,
          returnAt: returning
            ? current.get(`${row.branchId}:${returning.offerId}`)!.departureAt
            : null,
          carrierName: flight.carrierNameSnapshot,
          serviceNumber: flight.serviceNumberSnapshot,
          cabinClassCode: flight.cabinClassCode,
          ...composition,
        };
      })
      .filter((row) => row.passengers > 0);
    const totals = data.reduce(
      (sum, row) => {
        for (const key of Object.keys(
          emptyFlightComposition(),
        ) as (keyof FlightLoadCompositionV1)[])
          sum[key] += row[key];
        return sum;
      },
      { ...emptyFlightComposition(), contracts: data.length },
    );
    return { version: 1, offerId, data, totals };
  }
}
