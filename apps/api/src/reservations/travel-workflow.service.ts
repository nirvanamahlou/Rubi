import { refreshWorkflowExecution } from './workflow-current-execution';
import { TicketPublicService } from '../ticket-catalog/ticket-public.service';
import { SalesOperationalAmendmentService } from '../sales/sales-operational-amendment.module';
import {
  reservationHotelStays,
  salesContractFlights,
  readLegacyServiceParties,
  reservationFlightOutputKey,
} from '@nora/contracts';
import { NotificationsService } from '../notifications/notifications.service';
import { LegalEntitiesService } from '../legal-entities/legal-entities.service';
import { MasterOrganizationDirectory } from '../master-data/master-organization-directory';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  SalesReservationRequestV1,
  TravelWorkflowCommandV1,
  TravelWorkflowStateV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import {
  initialTravelWorkflow,
  transitionTravelWorkflow,
} from './travel-workflow';

@Injectable()
export class TravelWorkflowService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(LegalEntitiesService)
    private readonly entities: LegalEntitiesService,
    @Inject(MasterOrganizationDirectory)
    private readonly agencies: MasterOrganizationDirectory,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
    @Inject(SalesOperationalAmendmentService)
    private readonly amendments: SalesOperationalAmendmentService,
    @Optional()
    @Inject(TicketPublicService)
    private readonly tickets?: TicketPublicService,
  ) {}
  async detail(
    id: string,
    branchIds: readonly string[],
    currentOutput = false,
  ) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundException();
    const row = await this.database.client.reservationIntake.findFirst({
      where: { id, branchId: { in: [...branchIds] } },
      include: {
        ticketDocuments: true,
        workflowRevisions: { orderBy: { version: 'desc' }, take: 1 },
        arrangements: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!row) throw new NotFoundException('درخواست یافت نشد.');
    const workflow = row.workflowRevisions[0]?.state as unknown as
      TravelWorkflowStateV1 | undefined;
    const arrangement = row.arrangements[0];
    const original = row.snapshot as unknown as SalesReservationRequestV1;
    const saved = currentOutput
      ? await this.amendments.currentExecution(
          this.database.client,
          original,
          branchIds,
        )
      : original;
    const snapshot = this.tickets?.currentSelections
      ? {
          ...saved,
          ticketSelections: await this.tickets.currentSelections(
            saved.ticketSelections ?? [],
            row.branchId,
          ),
        }
      : saved;
    return {
      ticketDocuments: (row.ticketDocuments ?? []).map((doc) => ({
        customerId: doc.customerId,
        number: doc.number,
        source: doc.source as 'AUTO' | 'MANUAL',
        issuedAt: doc.issuedAt.toISOString(),
      })),
      contractEditVersion: currentOutput
        ? snapshot.contractVersion
        : await this.amendments.versionFor(
            this.database.client,
            row.contractId,
            branchIds,
          ),
      salesOwnerUserId: row.salesOwnerUserId,
      id: row.id,
      requestId: row.requestId,
      contractId: row.contractId,
      contractVersion: snapshot.contractVersion,
      branchId: row.branchId,
      status: 'QUEUED' as const,
      receivedAt: row.receivedAt.toISOString(),
      snapshot,
      arrangement: arrangement
        ? {
            version: arrangement.version,
            roomCount: arrangement.roomCount,
            singleRoomCount: arrangement.singleRoomCount,
            doubleRoomCount: arrangement.doubleRoomCount,
            extraBedCount: arrangement.extraBedCount,
            hotelGuestCustomerIds: Array.isArray(
              arrangement.hotelGuestCustomerIds,
            )
              ? arrangement.hotelGuestCustomerIds.filter(
                  (id): id is string => typeof id === 'string',
                )
              : [],
            reason: arrangement.reason,
            updatedAt: arrangement.updatedAt.toISOString(),
            updatedByUserId: arrangement.updatedByUserId,
          }
        : null,
      workflow: currentOutput
        ? refreshWorkflowExecution(
            workflow ?? initialTravelWorkflow(),
            original,
            snapshot,
          )
        : (workflow ?? initialTravelWorkflow()),
    };
  }
  async contractVersions(id: string, branchIds: readonly string[]) {
    const intake = await this.detail(id, branchIds);
    return this.database.client.reservationIntake.findMany({
      where: {
        contractId: intake.contractId,
        branchId: { in: [...branchIds] },
      },
      orderBy: { contractVersion: 'desc' },
      select: { id: true, contractVersion: true, receivedAt: true },
      take: 100,
    });
  }
  async history(id: string, branchIds: readonly string[]) {
    await this.detail(id, branchIds);
    return this.database.client.reservationWorkflowRevision.findMany({
      where: { intakeId: id },
      orderBy: { version: 'desc' },
      take: 100,
      select: { version: true, state: true, createdAt: true },
    });
  }
  async forContract(contractId: string, branchIds: readonly string[]) {
    const row = await this.database.client.reservationIntake.findFirst({
      where: { contractId, branchId: { in: [...branchIds] } },
      orderBy: { contractVersion: 'desc' },
    });
    if (!row)
      throw new NotFoundException('درخواست هنوز به رزرواسیون نرسیده است.');
    return this.detail(row.id, branchIds, true);
  }
  async update(
    id: string,
    command: TravelWorkflowCommandV1,
    actor: AuthenticatedActor,
  ) {
    if (!actor.permissions.includes('reservations.documents.manage'))
      throw new ForbiddenException('مجوز عملیات مدارک وجود ندارد.');
    const currentOutput = [
      'SUPPLIER_FORM_SETTINGS',
      'VOUCHER_SETTINGS',
      'REQUEST_SUPPLIER',
      'CONFIRM_SUPPLIER',
      'ISSUE_VOUCHER',
      'TICKET_FLIGHT_NUMBERS',
    ].includes(command?.action);
    const intake = await this.detail(id, actor.branchIds, currentOutput);
    let branding: TravelWorkflowStateV1['branding'] = null;
    if (command?.action === 'BRANDING') {
      const ticketWithoutLogo = command.branding?.ticketWithoutLogo;
      const voucherWithoutLogo = command.branding?.voucherWithoutLogo;
      if (
        [ticketWithoutLogo, voucherWithoutLogo].some(
          (value) => value !== undefined && typeof value !== 'boolean',
        ) ||
        ((ticketWithoutLogo === true || voucherWithoutLogo === true) &&
          command.branding?.kind !== 'OWN')
      )
        throw new BadRequestException('سربرگ معتبر انتخاب کنید.');
      if (command.branding?.kind === 'OWN') {
        const { data } = await this.entities.current(actor);
        if (!data.legalEntity)
          throw new BadRequestException('ابتدا شرکت صادرکننده را انتخاب کنید.');
        branding = {
          kind: 'OWN',
          referenceId: data.legalEntity.id,
          name: data.legalEntity.persianName,
          logoFileId: data.legalEntity.logoFileId,
          companyCode: data.legalEntity.code,
          ...(ticketWithoutLogo === true ? { ticketWithoutLogo: true } : {}),
          ...(voucherWithoutLogo === true ? { voucherWithoutLogo: true } : {}),
        };
      } else if (
        command.branding?.kind === 'AGENCY' &&
        /^[0-9a-f-]{36}$/i.test(command.branding.referenceId ?? '')
      ) {
        const agency = await this.agencies.agencyReference(
          command.branding.referenceId!,
        );
        if (!agency?.isActive || !agency.logoFileReference)
          throw new BadRequestException(
            'آژانس فعال دارای لوگو را انتخاب کنید.',
          );
        branding = {
          kind: 'AGENCY',
          referenceId: agency.id,
          name: agency.displayName,
          logoFileId: agency.logoFileReference,
        };
      } else throw new BadRequestException('سربرگ معتبر انتخاب کنید.');
    }
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${id}, 0))`,
      );
      const revision = await tx.reservationWorkflowRevision.findFirst({
        where: { intakeId: id },
        orderBy: { version: 'desc' },
      });
      const state = revision
        ? (revision.state as unknown as TravelWorkflowStateV1)
        : initialTravelWorkflow();
      if (state.version !== command?.expectedVersion)
        throw new ConflictException(
          'اطلاعات هم‌زمان تغییر کرده است؛ دوباره بارگذاری کنید.',
        );
      if (command.action === 'TABLE_STATUS')
        await this.amendments.assertActive(
          tx,
          intake.contractId,
          actor.branchIds,
        );
      let next: TravelWorkflowStateV1;
      try {
        next = transitionTravelWorkflow(
          currentOutput ? intake.workflow : state,
          command,
          intake.snapshot.passengerIds,
          command.action === 'TICKET_FLIGHT_NUMBERS'
            ? salesContractFlights(
                intake.snapshot.serviceSelections,
                intake.snapshot.ticketSelections ?? [],
              ).map((f) =>
                reservationFlightOutputKey(f.serviceClientKey, f.offerId),
              )
            : [],
          command.action === 'SUPPLIER_FORM_SETTINGS' &&
            intake.snapshot.passengerIds.length === 0 &&
            (intake.snapshot.serviceSelections.some(
              (service) => service.metadata?.legacyContractV1 === true,
            ) ||
              readLegacyServiceParties(intake.snapshot.serviceSelections) !==
                null),
          reservationHotelStays(intake.snapshot).map((stay) => stay.key),
        );
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'عملیات نامعتبر',
        );
      }
      if (branding)
        next.branding = {
          ...branding,
          ...(command.branding?.ticketWithoutLogo === undefined &&
          state.branding?.ticketWithoutLogo === true
            ? { ticketWithoutLogo: true }
            : {}),
          ...(command.branding?.voucherWithoutLogo === undefined &&
          state.branding?.voucherWithoutLogo === true
            ? { voucherWithoutLogo: true }
            : {}),
        };
      if (
        ['REQUEST_SUPPLIER', 'CONFIRM_SUPPLIER', 'ISSUE_VOUCHER'].includes(
          command.action,
        ) &&
        !next.branding
      )
        throw new BadRequestException('ابتدا سربرگ خروجی را ثبت کنید.');
      next.updatedAt = new Date().toISOString();
      next.updatedByUserId = actor.userId;
      if (
        command.action === 'TABLE_STATUS' &&
        command.tableFlag &&
        next.tableFlags?.[command.tableFlag]
      ) {
        next.tableFlags[command.tableFlag]!.updatedAt = next.updatedAt;
        next.tableFlags[command.tableFlag]!.updatedByUserId = actor.userId;
      }
      await tx.reservationWorkflowRevision.create({
        data: {
          intakeId: id,
          version: next.version,
          state: next as unknown as Prisma.InputJsonValue,
          actorUserId: actor.userId,
        },
      });
      if (
        intake.salesOwnerUserId &&
        ((next.voucherIssued && !state.voucherIssued) ||
          ['CANCEL', 'REOPEN'].includes(command.action))
      )
        await this.notifications.createWithinTransaction(tx, {
          recipientUserIds: [intake.salesOwnerUserId],
          actorUserId: actor.userId,
          sourceModule: 'reservations',
          eventType:
            command.action === 'CANCEL'
              ? 'CANCEL'
              : command.action === 'REOPEN'
                ? 'REOPEN'
                : 'ISSUE_VOUCHER',
          title:
            command.action === 'CANCEL'
              ? 'ابطال درخواست رزرواسیون'
              : command.action === 'REOPEN'
                ? 'لغو ابطال درخواست رزرواسیون'
                : 'واچر صادر شد',
          message: `قرارداد ${intake.snapshot.contractNumber}؛ ${next.note}`,
          entityType: 'sales_contract',
          entityId: intake.contractId,
          href: '/sales',
        });
      return next;
    });
  }
}
