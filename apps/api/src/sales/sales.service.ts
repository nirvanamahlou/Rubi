import { contractPassengerAgeCategory } from './sales.domain';
import {
  readLegacyServiceParties,
  legacyServiceHeadcount,
} from '@nora/contracts';
import { salesListTravelSummary } from './sales-list-summary';
import {
  canSelfServeSalesContract,
  hasSalesContractSelfService,
} from '@nora/contracts';
import { enforceSalesHotelCapacity } from '@nora/contracts';
import {
  hasConfirmedReceiptFunds,
  netSalesPayments,
} from './sales-financial-settlement';
import { financialDate } from '../finance/accounting/financial-event.public';
import { PackageTourPricingService } from '../package-pricing/package-tour-pricing.service';
import { canViewRoute, isOptionalOperationReason } from '@nora/contracts';
import { salesHotelRoomSummary, salesRoomCategories } from '@nora/contracts';
import type { DisplayLanguage } from '../common/i18n/language';
import { IamFinanceDirectory } from '../iam/iam-finance-directory';
import { expectedTicketSale } from './sales-ticket-quote';
import { SalesBuyerContactCrypto } from './sales-buyer-contact.crypto';
import { MasterDataService } from '../master-data/master-data.service';
import { randomUUID } from 'node:crypto';
import Joi from 'joi';
import { buildSalesXlsx, SALES_EXPORT_LIMIT } from './sales.xlsx';
import {
  validatePassengerPackagePrices,
  SALES_CHEQUE_FEE,
  quoteHotelOccupancy,
  hotelAgeOn,
} from '@nora/contracts';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { TourPublicService } from '../ticket-catalog/tour-public.service';
import { HotelPurchaseRatesPublicService } from '../reservations/hotel-purchase-rates.public';
import type {
  SalesRoomCategory,
  SalesServicePricingV1,
  SalesAccommodationKind,
  AuthenticatedActor,
  SalesContractCreateRequest,
  SalesContractAmendmentV1,
  SalesContractDetail,
  SalesContractListQuery,
  SalesContractPage,
  SalesContractSummary,
  SalesReceivables,
  SalesReceivablesQuery,
  SalesPaymentCreateRequest,
  SalesReservationRequestV1,
  SalesFinanceInboxPaymentV1,
  FinanceCustomerDocumentDeliveryCandidateV1,
} from '@nora/contracts';
import type { Prisma } from '@nora/database';

import {
  SALES_TICKET_AVAILABILITY_PORT,
  SalesCustomersPublicAdapter,
  type SalesTicketAvailabilityPort,
} from './sales.adapters';
import {
  calculateSalesBalances,
  passengerAgeYears,
  SalesDomainError,
  salesFingerprint,
  sumSalesDecimals,
  validateSalesContract,
  validateSalesPayment,
} from './sales.domain';
import {
  SalesRepository,
  type SalesActorContext,
  type SalesContractRow,
} from './sales.repository';

function has(actor: AuthenticatedActor, permission: string): boolean {
  return actor.permissions.includes(permission as never);
}

function branch(actor: AuthenticatedActor, requested?: string): string {
  const selected = requested ?? actor.branchIds[0];
  if (!selected || !actor.branchIds.includes(selected))
    throw new ForbiddenException({
      code: 'SALES_CONTRACT_FORBIDDEN',
      message: 'شعبه مجاز مشخص نشده است.',
    });
  return selected;
}

function domainCall(action: () => void): void {
  try {
    action();
  } catch (error) {
    if (error instanceof SalesDomainError)
      throw new BadRequestException({
        code: error.code,
        message: error.message,
      });
    throw error;
  }
}

function date(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function money(value: { toString(): string }): string {
  return value.toString();
}

function paymentInput(row: SalesContractRow['payments'][number]) {
  const check =
    row.bankId &&
    row.checkSecureIdentifier &&
    row.checkOwnerName &&
    row.checkDueDate
      ? {
          bankId: row.bankId,
          secureIdentifier: row.checkSecureIdentifier,
          ownerName: row.checkOwnerName,
          dueDate: row.checkDueDate.toISOString().slice(0, 10),
        }
      : null;
  return {
    amount: money(row.amount),
    currencyCode: row.currencyCode,
    dueAt: row.dueAt.toISOString(),
    method: row.method,
    description: row.description,
    paymentReference: row.paymentReference,
    destinationAccountId: row.destinationAccountId,
    destinationAccountTitle: row.destinationAccountTitle,
    check,
  };
}

type HotelCapacityBands = {
  adults: number;
  children2To6: number;
  children6To12: number;
  infants: number;
};

function hotelCapacity(
  roomRate: {
    maxAdults: number;
    maxChildren: number;
    maxChildren2To6?: number;
    maxChildren6To12?: number;
    maxInfants?: number;
  },
  rooms: number,
): HotelCapacityBands {
  // Older rate packs only have maxChildren; consider that a 2–6 capacity until
  // the rate is edited. This avoids making an existing hotel unavailable.
  const children2To6 = roomRate.maxChildren2To6 ?? roomRate.maxChildren;
  const children6To12 = roomRate.maxChildren6To12 ?? 0;
  return {
    adults: roomRate.maxAdults * rooms,
    children2To6: children2To6 * rooms,
    children6To12: children6To12 * rooms,
    infants: (roomRate.maxInfants ?? 0) * rooms,
  };
}

function passengerCapacityBands(
  passengers: readonly { birthDate: string }[],
  departureDate: string,
): HotelCapacityBands {
  return passengers.reduce<HotelCapacityBands>(
    (counts, passenger) => {
      const age = passengerAgeYears(passenger.birthDate, departureDate);
      if (age < 2) counts.infants += 1;
      else if (age < 6) counts.children2To6 += 1;
      else if (age < 12) counts.children6To12 += 1;
      else counts.adults += 1;
      return counts;
    },
    { adults: 0, children2To6: 0, children6To12: 0, infants: 0 },
  );
}

function capacityExceeded(
  requested: HotelCapacityBands,
  capacity: HotelCapacityBands,
): boolean {
  return (
    requested.adults > capacity.adults ||
    requested.children2To6 > capacity.children2To6 ||
    requested.children6To12 > capacity.children6To12 ||
    requested.infants > capacity.infants
  );
}

export function presentSalesContract(
  row: SalesContractRow,
  paymentCreatorNames: ReadonlyMap<string, string> = new Map(),
  buyerCrypto?: SalesBuyerContactCrypto,
): SalesContractDetail {
  const priceComponents = row.priceComponents.map((item) => ({
    type: item.type,
    title: item.title,
    amount: money(item.amount),
    currencyCode: item.currencyCode,
  }));
  const payments = row.payments.map((item) => ({
    ...paymentInput(item),
    id: item.id,
    status: item.status,
    createdByUserId: item.createdByUserId,
    createdByName: paymentCreatorNames.get(item.createdByUserId) ?? null,
    createdAt: item.createdAt.toISOString(),
    financeConfirmedAt: date(item.financeConfirmedAt),
    financeDecisionReason: item.financeDecisionReason,
  }));
  const servicesDetail = row.services.map((service) => ({
    clientKey: service.clientKey,
    kind: service.kind,
    referenceId: service.referenceId,
    titleSnapshot: service.titleSnapshot,
    status: service.status,
    ...(Array.isArray(service.pricing)
      ? {
          pricing: service.pricing as unknown as SalesServicePricingV1[],
        }
      : {}),
    ...(service.metadata &&
    typeof service.metadata === 'object' &&
    !Array.isArray(service.metadata)
      ? {
          metadata: service.metadata as Record<
            string,
            string | number | boolean | null
          >,
        }
      : {}),
  }));
  const legacyCount = legacyServiceHeadcount(servicesDetail);
  return {
    id: row.id,
    contractNumber: row.contractNumber,
    customerId: row.customerId,
    customerNameSnapshot: row.customerNameSnapshot,
    ...(legacyCount !== null ? { passengerCount: legacyCount } : {}),
    passengerNames: row.passengers.map(
      ({ displayNameSnapshot }) => displayNameSnapshot,
    ),
    ownerUserId: row.ownerUserId,
    assignedUserId: row.assignedUserId,
    branchId: row.branchId,
    originId: row.originId,
    destinationId: row.destinationId,
    departureDate: row.departureDate.toISOString().slice(0, 10),
    returnNotBefore: row.returnNotBefore?.toISOString().slice(0, 10) ?? null,
    services: [...new Set(row.services.map(({ kind }) => kind))],
    status: row.status,
    settlementStatus: row.settlementStatus,
    reservationStatus: row.reservationStatus,
    balances: calculateSalesBalances(
      priceComponents,
      netSalesPayments(row.payments, row.receiptAllocations ?? []),
    ),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    tripType: row.tripType,
    payerCustomerId: row.payerCustomerId,
    servicesDetail,
    passengersDetail: row.passengers.map((passenger) => ({
      id: passenger.id,
      customerId: passenger.customerId,
      displayNameSnapshot: passenger.displayNameSnapshot,
      birthDate: passenger.birthDate?.toISOString().slice(0, 10) ?? '',
      ageCategory: passenger.ageCategory,
      ...(passenger.childAgeBand === 'AGE_2_6' ||
      passenger.childAgeBand === 'AGE_6_12'
        ? { childAgeBand: passenger.childAgeBand }
        : {}),
      ...(passenger.accommodationKind
        ? {
            accommodationKind:
              passenger.accommodationKind as SalesAccommodationKind,
          }
        : {}),
      ...(passenger.agreedPrices?.length
        ? {
            agreedPrices: passenger.agreedPrices.map((price) => ({
              currencyCode: price.currencyCode,
              amount: price.amount.toString(),
            })),
          }
        : {}),
      serviceClientKeys: passenger.allocations.map(
        ({ service }) => service.clientKey,
      ),
    })),
    ticketSelections: row.ticketSelections.map((ticket) => ({
      serviceClientKey:
        row.services.find(({ id }) => id === ticket.serviceId)?.clientKey ?? '',
      direction: ticket.direction,
      offerId: ticket.offerId,
      originId: ticket.originId,
      destinationId: ticket.destinationId,
      departureAt: ticket.departureAt.toISOString(),
      arrivalAt: ticket.arrivalAt.toISOString(),
      carrierNameSnapshot: ticket.carrierNameSnapshot,
      serviceNumberSnapshot: ticket.serviceNumberSnapshot,
      cabinClassCode: ticket.cabinClassCode,
      ...(ticket.quotedAmount !== null && ticket.quotedCurrencyCode
        ? {
            quotedPrice: {
              amount: money(ticket.quotedAmount),
              currencyCode: ticket.quotedCurrencyCode,
            },
          }
        : {}),
    })),
    hotelSelection: row.hotelSelection
      ? {
          serviceClientKey:
            row.services.find(({ id }) => id === row.hotelSelection?.serviceId)
              ?.clientKey ?? '',
          hotelId: row.hotelSelection.hotelId,
          ...(row.hotelSelection.additionalStays?.length
            ? {
                additionalStays: row.hotelSelection.additionalStays.map(
                  (stay) => ({
                    hotelId: stay.hotelId,
                    hotelNameSnapshot: stay.hotelNameSnapshot,
                    cityId: stay.cityId,
                    checkInDate: stay.checkInDate.toISOString().slice(0, 10),
                    checkOutDate: stay.checkOutDate.toISOString().slice(0, 10),
                    ...(stay.rooms?.length
                      ? {
                          rooms: stay.rooms.map((room) => ({
                            ordinal: room.ordinal,
                            roomTypeId: room.roomTypeId,
                            roomTypeNameSnapshot: room.roomTypeNameSnapshot,
                            adults: room.adults,
                            childAges: room.childAges as number[],
                            ...(room.roomCategory
                              ? {
                                  roomCategory:
                                    room.roomCategory as SalesRoomCategory,
                                }
                              : {}),
                          })),
                        }
                      : {}),
                  }),
                ),
              }
            : {}),
          hotelNameSnapshot: row.hotelSelection.hotelNameSnapshot,
          cityId: row.hotelSelection.cityId,
          checkInDate: row.hotelSelection.checkInDate
            .toISOString()
            .slice(0, 10),
          checkOutDate: row.hotelSelection.checkOutDate
            .toISOString()
            .slice(0, 10),
          roomCount: row.hotelSelection.roomCount,
          ...(row.hotelSelection.singleRoomCount == null
            ? {}
            : { singleRoomCount: row.hotelSelection.singleRoomCount }),
          ...(row.hotelSelection.doubleRoomCount == null
            ? {}
            : { doubleRoomCount: row.hotelSelection.doubleRoomCount }),
          ...(row.hotelSelection.extraBedCount == null
            ? {}
            : { extraBedCount: row.hotelSelection.extraBedCount }),
          ...(row.hotelSelection.rooms?.length
            ? salesHotelRoomSummary(
                row.hotelSelection.rooms.map((room) => ({
                  adults: room.adults,
                  childAges: room.childAges as number[],
                })),
              )
            : {}),
          roomTypeId: row.hotelSelection.roomTypeId,
          ...(row.hotelSelection.rooms?.length
            ? {
                rooms: row.hotelSelection.rooms.map((room) => ({
                  ordinal: room.ordinal,
                  roomTypeId: room.roomTypeId,
                  roomTypeNameSnapshot: room.roomTypeNameSnapshot,
                  ...(room.roomCategory
                    ? {
                        roomCategory: room.roomCategory as SalesRoomCategory,
                      }
                    : {}),
                  adults: room.adults,
                  childAges: room.childAges as number[],
                  ...(room.agreedPrice
                    ? {
                        agreedPrice: room.agreedPrice as {
                          amount: string;
                          currencyCode: string;
                        },
                      }
                    : {}),
                })),
              }
            : {}),
          mealServiceId: row.hotelSelection.mealServiceId,
          occupancy: row.hotelSelection.occupancy,
          inventoryStatus: row.hotelSelection.inventoryStatus as
            'AVAILABLE' | 'NEEDS_RESERVATION_CONFIRMATION',
        }
      : null,
    priceComponents,
    payments,
    fxSnapshot:
      row.fxRate && row.fxSource && row.fxObservedAt
        ? {
            rate: money(row.fxRate),
            source: row.fxSource,
            observedAt: row.fxObservedAt.toISOString(),
          }
        : null,
    pricingNotes: row.pricingNotes,
    paymentTerms:
      (row.paymentTerms as unknown as SalesContractDetail['paymentTerms']) ??
      null,
    buyerContact:
      row.buyerContact != null
        ? (buyerCrypto?.decrypt(row.buyerContact) ?? null)
        : null,
  };
}

function summary(detail: SalesContractDetail): SalesContractSummary {
  return {
    ...salesListTravelSummary(detail),
    id: detail.id,
    contractNumber: detail.contractNumber,
    customerId: detail.customerId,
    customerNameSnapshot: detail.customerNameSnapshot,
    passengerNames: detail.passengerNames,
    ...(detail.passengerCount !== undefined
      ? { passengerCount: detail.passengerCount }
      : {}),
    ownerUserId: detail.ownerUserId,
    assignedUserId: detail.assignedUserId,
    branchId: detail.branchId,
    originId: detail.originId,
    destinationId: detail.destinationId,
    departureDate: detail.departureDate,
    returnNotBefore: detail.returnNotBefore,
    services: detail.services,
    status: detail.status,
    settlementStatus: detail.settlementStatus,
    reservationStatus: detail.reservationStatus,
    balances: detail.balances,
    version: detail.version,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
  };
}

@Injectable()
export class SalesService {
  constructor(
    @Inject(SalesRepository) private readonly repository: SalesRepository,
    @Inject(SalesCustomersPublicAdapter)
    private readonly customers: SalesCustomersPublicAdapter,
    @Inject(SALES_TICKET_AVAILABILITY_PORT)
    private readonly tickets: SalesTicketAvailabilityPort,
    @Optional()
    @Inject(TourPublicService)
    private readonly tours?: TourPublicService,
    @Optional()
    @Inject(HotelPurchaseRatesPublicService)
    private readonly hotelRates?: HotelPurchaseRatesPublicService,
    @Optional()
    @Inject(SalesBuyerContactCrypto)
    private readonly buyerCrypto?: SalesBuyerContactCrypto,
    @Optional()
    @Inject(MasterDataService)
    private readonly references?: MasterDataService,
    @Optional()
    @Inject(IamFinanceDirectory)
    private readonly identities?: IamFinanceDirectory,
    @Optional()
    @Inject(PackageTourPricingService)
    private readonly packageQuotes?: PackageTourPricingService,
  ) {}

  async availableHotelRoomRates(
    input: { hotelId: string; checkIn: string; checkOut: string },
    actor: AuthenticatedActor,
  ) {
    if (!has(actor, 'sales.contracts.create'))
      throw new ForbiddenException('مجوز ایجاد قرارداد وجود ندارد.');
    const branchId = branch(actor);
    if (!this.hotelRates)
      throw new BadRequestException('سرویس نرخ اتاق هتل در دسترس نیست.');
    return {
      data: await this.hotelRates.availableRoomRates({ branchId, ...input }),
    };
  }
  private async assertAdditionalHotelStays(
    input: SalesContractCreateRequest,
    existing?: SalesContractDetail['hotelSelection'],
  ) {
    const hotel = input.hotelSelection;
    if (!hotel?.additionalStays?.length) return;
    if (
      input.services.some(
        (service) =>
          service.metadata?.packagePublishedSale ||
          service.metadata?.tourDepartureId,
      )
    )
      throw new BadRequestException(
        'Composite itinerary is not part of this published package',
      );
    if (!this.references)
      throw new BadRequestException('Hotel reference service unavailable');
    for (const stay of [hotel, ...hotel.additionalStays]) {
      const previous =
        existing &&
        [existing, ...(existing.additionalStays ?? [])].find(
          (item) =>
            item.hotelId === stay.hotelId &&
            item.cityId === stay.cityId &&
            item.hotelNameSnapshot === stay.hotelNameSnapshot &&
            item.checkInDate === stay.checkInDate &&
            item.checkOutDate === stay.checkOutDate &&
            JSON.stringify(item.rooms ?? []) ===
              JSON.stringify(stay.rooms ?? []),
        );
      if (previous) continue;
      const reference = (await this.references.detail('hotels', stay.hotelId))
        .data;
      if (
        reference.status !== 'active' ||
        String(reference.attributes.cityId) !== stay.cityId ||
        reference.attributes.isSaleableReference === false
      )
        throw new BadRequestException('Invalid hotel itinerary reference');
      if (stay.hotelNameSnapshot !== reference.name)
        throw new BadRequestException(
          'Hotel reference changed; refresh the selection',
        );
      if (stay !== hotel && stay.rooms?.length) {
        const linked = String(reference.attributes.roomTypeIds ?? '')
          .split(',')
          .map((id) => id.trim());
        for (const room of stay.rooms) {
          const roomReference = (
            await this.references.detail('room-types', room.roomTypeId)
          ).data;
          if (
            !linked.includes(room.roomTypeId) ||
            roomReference.status !== 'active' ||
            roomReference.name !== room.roomTypeNameSnapshot
          )
            throw new BadRequestException(
              'نوع اتاق به هتل انتخاب‌شده متصل نیست.',
            );
        }
      }
    }
  }

  private async assertIndividualHotelRooms(
    hotel: NonNullable<SalesContractCreateRequest['hotelSelection']>,
    branchId: string,
  ): Promise<void> {
    for (const room of hotel.rooms ?? []) {
      const rate = await this.hotelRates!.roomAvailability({
        branchId,
        hotelId: hotel.hotelId,
        roomTypeId: room.roomTypeId,
        checkIn: hotel.checkInDate,
        checkOut: hotel.checkOutDate,
      });
      // Match legacy selections: missing tariffs do not prohibit agreed prices.
      if (!rate) continue;
      if (rate.occupancyRates) {
        if (
          !quoteHotelOccupancy(rate.occupancyRates, {
            adults: room.adults,
            childAges: room.childAges,
            rooms: 1,
            checkIn: hotel.checkInDate,
            checkOut: hotel.checkOutDate,
          })
        )
          throw new BadRequestException(
            'نرخ یا ظرفیت یکی از اتاق‌ها با ترکیب مهمانان سازگار نیست.',
          );
      } else if (
        room.adults > rate.maxAdults ||
        room.childAges.filter((a) => a < 2).length > (rate.maxInfants ?? 0) ||
        room.childAges.filter((a) => a >= 2 && a < 6).length >
          (rate.maxChildren2To6 ?? rate.maxChildren) ||
        room.childAges.filter((a) => a >= 6).length >
          (rate.maxChildren6To12 ?? 0)
      )
        throw new BadRequestException('ظرفیت یکی از اتاق‌ها کافی نیست.');
    }
  }
  private async assertHotelRoomCapacity(
    input: SalesContractCreateRequest,
    branchId: string,
  ): Promise<void> {
    if (!enforceSalesHotelCapacity()) return;
    const hotel = input.hotelSelection;
    if (!hotel) return;
    if (!this.hotelRates)
      throw new BadRequestException('سرویس نرخ اتاق هتل در دسترس نیست.');
    if (hotel.rooms?.length)
      return this.assertIndividualHotelRooms(hotel, branchId);
    const roomRate = await this.hotelRates.roomAvailability({
      branchId,
      hotelId: hotel.hotelId,
      roomTypeId: hotel.roomTypeId,
      checkIn: hotel.checkInDate,
      checkOut: hotel.checkOutDate,
    });
    if (!roomRate) return;
    const guests = input.passengers.filter((passenger) =>
      passenger.serviceClientKeys.includes(hotel.serviceClientKey),
    );
    if (roomRate.occupancyRates) {
      const ages = guests.map((p) =>
        hotelAgeOn(p.birthDate, hotel.checkInDate),
      );
      if (
        ages.some((age) => age === null) ||
        !quoteHotelOccupancy(roomRate.occupancyRates, {
          adults: ages.filter((age) => age !== null && age >= 15).length,
          childAges: ages.filter(
            (age): age is number => age !== null && age < 15,
          ),
          rooms: hotel.roomCount,
          checkIn: hotel.checkInDate,
          checkOut: hotel.checkOutDate,
        })
      )
        throw new BadRequestException({
          code: 'HOTEL_OCCUPANCY_RATE_UNAVAILABLE',
          message:
            'نرخ معتبر برای ترکیب واقعی مهمانان، سن کودک و تمام شب‌های اقامت وجود ندارد.',
        });
      return;
    }
    const requested = passengerCapacityBands(guests, input.departureDate);
    const capacity = hotelCapacity(roomRate, hotel.roomCount);
    if (capacityExceeded(requested, capacity))
      throw new BadRequestException({
        code: 'HOTEL_ROOM_CAPACITY_EXCEEDED',
        message: `ظرفیت ${roomRate.roomTypeName} برای ${hotel.roomCount.toLocaleString('fa-IR')} اتاق کافی نیست: ${capacity.adults.toLocaleString('fa-IR')} بزرگسال، ${capacity.children2To6.toLocaleString('fa-IR')} کودک ۲–۶، ${capacity.children6To12.toLocaleString('fa-IR')} کودک ۶–۱۲ و ${capacity.infants.toLocaleString('fa-IR')} نوزاد.`,
        capacity,
        requested,
      });
  }
  private async assertPresentedHotelRoomCapacity(
    contract: SalesContractDetail,
  ): Promise<void> {
    if (!enforceSalesHotelCapacity()) return;
    const hotel = contract.hotelSelection;
    if (!hotel) return;
    if (!this.hotelRates)
      throw new BadRequestException('سرویس نرخ اتاق هتل در دسترس نیست.');
    if (hotel.rooms?.length)
      return this.assertIndividualHotelRooms(hotel, contract.branchId);
    const roomRate = await this.hotelRates.roomAvailability({
      branchId: contract.branchId,
      hotelId: hotel.hotelId,
      roomTypeId: hotel.roomTypeId,
      checkIn: hotel.checkInDate,
      checkOut: hotel.checkOutDate,
    });
    if (!roomRate) return;
    const guests = contract.passengersDetail.filter((passenger) =>
      passenger.serviceClientKeys.includes(hotel.serviceClientKey),
    );
    if (roomRate.occupancyRates) {
      const ages = guests.map((p) =>
        hotelAgeOn(p.birthDate, hotel.checkInDate),
      );
      if (
        ages.some((age) => age === null) ||
        !quoteHotelOccupancy(roomRate.occupancyRates, {
          adults: ages.filter((age) => age !== null && age >= 15).length,
          childAges: ages.filter(
            (age): age is number => age !== null && age < 15,
          ),
          rooms: hotel.roomCount,
          checkIn: hotel.checkInDate,
          checkOut: hotel.checkOutDate,
        })
      )
        throw new BadRequestException({
          code: 'HOTEL_OCCUPANCY_RATE_UNAVAILABLE',
          message: 'ترکیب مهمانان و تاریخ اقامت با نرخ اتاق هماهنگ نیست.',
        });
      return;
    }
    const requested = passengerCapacityBands(guests, contract.departureDate);
    const capacity = hotelCapacity(roomRate, hotel.roomCount);
    if (capacityExceeded(requested, capacity))
      throw new BadRequestException({
        code: 'HOTEL_ROOM_CAPACITY_EXCEEDED',
        message: `ظرفیت ${roomRate.roomTypeName} برای تعداد مسافران انتخاب‌شده کافی نیست.`,
        capacity,
        requested,
      });
  }
  private async assertTour(
    input: SalesContractCreateRequest,
    branchId: string,
    validatedPublishedHotelId?: string,
  ) {
    if (
      !input.services.some(
        (service) => service.metadata?.tourDepartureId !== undefined,
      )
    )
      return;
    if (!this.tours) throw new BadRequestException('سرویس تور در دسترس نیست.');
    await this.tours.assertSalesSelection(
      input,
      branchId,
      validatedPublishedHotelId,
    );
  }

  private assertRead(row: SalesContractRow, actor: AuthenticatedActor): void {
    if (
      has(actor, 'sales.contracts.create') &&
      canViewRoute(actor.permissions, '/sales/contracts/new') &&
      row.ownerUserId === actor.userId &&
      actor.branchIds.includes(row.branchId)
    )
      return;
    if (has(actor, 'sales.contracts.read.all')) return;
    if (
      has(actor, 'sales.contracts.read.branch') &&
      actor.branchIds.includes(row.branchId)
    )
      return;
    if (
      has(actor, 'sales.contracts.read.own') &&
      actor.branchIds.includes(row.branchId) &&
      row.ownerUserId === actor.userId
    )
      return;
    throw new ForbiddenException({
      code: 'SALES_CONTRACT_FORBIDDEN',
      message: 'قرارداد خارج از دامنه دسترسی است.',
    });
  }

  private assertUpdate(row: SalesContractRow, actor: AuthenticatedActor): void {
    if (canSelfServeSalesContract(actor, row)) return;
    if (
      has(actor, 'sales.contracts.update.branch') &&
      actor.branchIds.includes(row.branchId)
    )
      return;
    if (
      has(actor, 'sales.contracts.update.own') &&
      actor.branchIds.includes(row.branchId) &&
      row.ownerUserId === actor.userId
    )
      return;
    throw new ForbiddenException({
      code: 'SALES_CONTRACT_FORBIDDEN',
      message: 'ویرایش فقط برای مالک/کانتر مجاز قرارداد ممکن است.',
    });
  }

  private context(
    actor: AuthenticatedActor,
    branchId: string,
    traceId?: string,
  ): SalesActorContext {
    return { userId: actor.userId, branchId, ...(traceId ? { traceId } : {}) };
  }

  async exportXlsx(
    query: SalesContractListQuery,
    actor: AuthenticatedActor,
    language: DisplayLanguage = 'fa',
  ) {
    if (!has(actor, 'sales.export'))
      throw new ForbiddenException('مجوز دریافت خروجی قرارداد وجود ندارد.');
    const validated = Joi.object({
      search: Joi.string().trim().max(160).allow(''),
      settlementStatus: Joi.string().valid(
        'UNPAID',
        'PARTIALLY_SETTLED',
        'SETTLED',
        'OVERPAID',
      ),
      originId: Joi.string().guid(),
      destinationId: Joi.string().guid(),
      customerType: Joi.string().valid('ALL', 'AGENCY', 'IN_PERSON'),
      agencyCustomerId: Joi.string().guid(),
      travelFrom: Joi.string().isoDate(),
      travelTo: Joi.string().isoDate(),
      createdFrom: Joi.string().isoDate(),
      createdTo: Joi.string().isoDate(),
      sortBy: Joi.string().valid(
        'createdAt',
        'updatedAt',
        'departureDate',
        'contractNumber',
      ),
      sortDirection: Joi.string().valid('asc', 'desc'),
    })
      .unknown(false)
      .validate(query);
    if (validated.error)
      throw new BadRequestException(
        'فیلتر خروجی معتبر نیست؛ فهرست را دوباره بارگذاری کنید.',
      );
    const result = await this.list(validated.value, actor, SALES_EXPORT_LIMIT);
    if (result.data.length > SALES_EXPORT_LIMIT)
      throw new BadRequestException(
        'خروجی بیش از ۲۰۰۰ قرارداد است؛ با جست‌وجو یا وضعیت تسویه، نتایج را محدود کنید.',
      );
    const bytes = buildSalesXlsx(
      result.data,
      validated.value,
      new Date(),
      language,
    );
    if (result.data.length)
      await this.repository.recordListExport(result.data, actor.userId);
    return bytes;
  }

  async list(
    query: SalesContractListQuery,
    actor: AuthenticatedActor,
    exportLimit?: number,
  ): Promise<SalesContractPage> {
    if (
      query.search != null &&
      (typeof query.search !== 'string' || query.search.length > 160)
    )
      throw new BadRequestException(
        'عبارت جست‌وجو باید متن و حداکثر ۱۶۰ نویسه باشد.',
      );
    let scope: Prisma.SalesContractWhereInput;
    if (has(actor, 'sales.contracts.read.all')) scope = {};
    else if (has(actor, 'sales.contracts.read.branch'))
      scope = { branchId: { in: actor.branchIds } };
    else if (has(actor, 'sales.contracts.read.own'))
      scope = {
        branchId: { in: actor.branchIds },
        ownerUserId: actor.userId,
      };
    else
      throw new ForbiddenException({
        code: 'SALES_CONTRACT_FORBIDDEN',
        message: 'مجوز مشاهده قرارداد وجود ندارد.',
      });
    if (query.customerType || query.agencyCustomerId) {
      const validation = Joi.object({
        customerType: Joi.string().valid('ALL', 'AGENCY', 'IN_PERSON'),
        agencyCustomerId: Joi.string().guid(),
      }).validate({
        customerType: query.customerType,
        agencyCustomerId: query.agencyCustomerId,
      });
      if (
        validation.error ||
        (query.agencyCustomerId && query.customerType !== 'AGENCY')
      )
        throw new BadRequestException('فیلتر مانده قابل دریافت معتبر نیست.');
      if (query.customerType && query.customerType !== 'ALL') {
        const rows = await this.repository.dashboardRows(scope);
        const buyers = await this.customers.partyKinds(
          [...new Set(rows.map((row) => row.customerId))],
          actor,
        );
        const ids = buyers
          .filter(
            (buyer) =>
              buyer.kind ===
              (query.customerType === 'AGENCY' ? 'ORGANIZATION' : 'PERSON'),
          )
          .map((buyer) => buyer.id);
        scope = {
          AND: [
            scope,
            { customerId: { in: ids } },
            ...(query.agencyCustomerId
              ? [{ customerId: query.agencyCustomerId }]
              : []),
          ],
        };
      }
    }
    const result = await this.repository.list(
      query,
      scope,
      has(actor, 'sales.payments.read'),
      ...(exportLimit ? [exportLimit] : []),
    );
    const details = result.data.map((row) =>
      presentSalesContract(row, undefined, this.buyerCrypto),
    );
    const cityNames = new Map<string, string | null>();
    const amendedIds = new Set(
      (
        (await this.repository.amendedContractIds?.(
          result.data.map((row) => row.id),
        )) ?? []
      ).map((row) => row.contractId),
    );
    const sellerNames = new Map(
      (
        (await this.identities?.displayNames(
          result.data.map((row) => row.ownerUserId),
          [...new Set(result.data.map((row) => row.branchId))],
        )) ?? []
      ).map((user) => [user.id, user.displayName]),
    );
    const phones = new Map<string, string | null>();
    const cityIds = [
      ...new Set(
        details.flatMap((item) => [item.originId, item.destinationId]),
      ),
    ];
    const customerIds = [
      ...new Set(
        details
          .filter((item) => !item.buyerContact?.phone)
          .map((item) => item.customerId),
      ),
    ];
    const lookups = [
      ...cityIds.map((id) => async () => {
        const city = this.references
          ? await this.references.detail('cities', id)
          : null;
        cityNames.set(id, city?.data.name ?? null);
      }),
      ...customerIds.map((id) => async () => {
        phones.set(
          id,
          (await this.customers.resolvePhone?.(id, actor)) ?? null,
        );
      }),
    ];
    // Bound directory/contact requests even for a date-filtered large result set.
    let nextLookup = 0;
    await Promise.all(
      Array.from({ length: Math.min(8, lookups.length) }, async () => {
        while (nextLookup < lookups.length) await lookups[nextLookup++]!();
      }),
    );
    return {
      data: details.map((detail) => ({
        ...summary(detail),
        sellerName: sellerNames.get(detail.ownerUserId) ?? null,
        reservationContractChanged: amendedIds.has(detail.id),
        customerPhone:
          detail.buyerContact?.phone ?? phones.get(detail.customerId) ?? null,
        originName: cityNames.get(detail.originId) ?? null,
        destinationName: cityNames.get(detail.destinationId) ?? null,
      })),
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      },
    };
  }

  async financeCustomerDocumentDeliveryCandidates(
    actor: AuthenticatedActor,
    contractNumber?: string,
  ): Promise<
    readonly Omit<FinanceCustomerDocumentDeliveryCandidateV1, 'delivery'>[]
  > {
    if (!has(actor, 'finance.read'))
      throw new ForbiddenException({
        code: 'FINANCE_INBOX_FORBIDDEN',
        message: 'مجوز مشاهده کارتابل مالی وجود ندارد.',
      });
    if (
      contractNumber !== undefined &&
      (typeof contractNumber !== 'string' || contractNumber.length > 100)
    )
      throw new BadRequestException('جست‌وجوی شماره قرارداد معتبر نیست.');
    const rows = await this.repository.customerDocumentDeliveryCandidates(
      actor.branchIds,
      contractNumber,
    );
    return rows.map((row) => ({
      contractId: row.id,
      contractNumber: row.contractNumber,
      branchId: row.branchId,
      customerNameSnapshot: row.customerNameSnapshot,
      settlementStatus: row.settlementStatus,
      hasConfirmedPayment: hasConfirmedReceiptFunds(
        row.payments,
        row.receiptAllocations ?? [],
      ),
    }));
  }

  async financeCustomerDocumentDeliveryFacts(
    contractId: string,
    branchIds: readonly string[],
    tx?: Prisma.TransactionClient,
  ) {
    const row = await this.repository.financeCustomerDocumentDeliveryFacts(
      contractId,
      branchIds,
      tx,
    );
    if (!row)
      throw new NotFoundException('قرارداد در شعب مجاز برای مالی یافت نشد.');
    return {
      contractId: row.id,
      branchId: row.branchId,
      salesOwnerUserId: row.ownerUserId,
      cancelled: row.status === 'CANCELLED',
      hasConfirmedPayment:
        row.status !== 'CANCELLED' &&
        hasConfirmedReceiptFunds(row.payments, row.receiptAllocations ?? []),
      fullySettled:
        row.status !== 'CANCELLED' &&
        ['SETTLED', 'OVERPAID'].includes(row.settlementStatus),
    };
  }
  async financeReceiptHistory(
    actor: AuthenticatedActor,
    after: object,
    take: number,
    requestId?: string,
  ) {
    if (!has(actor, 'finance.read'))
      throw new ForbiddenException('مجوز مشاهده دریافت‌ها وجود ندارد.');
    const rows = await this.repository.confirmedFinancePayments(
      actor.branchIds,
      after,
      take,
      requestId,
    );
    return rows.map((row) => ({
      id: row.id,
      source: 'SALES' as const,
      requestId: row.id,
      trackingNumber: row.contractId,
      trackingDate: financialDate(row.contract.createdAt),
      customerId: row.contract.customerId,
      direction: 'RECEIPT' as const,
      title: 'دریافت قرارداد ' + row.contract.contractNumber,
      occurredAt: row.financeConfirmedAt!.toISOString(),
      amount: row.amount.toString(),
      currencyCode: row.currencyCode,
      accountId: row.financeReceiptAccountId,
      accountTitle: null,
      method: row.method,
      reference: row.financePaymentReference ?? row.paymentReference,
      installment: null,
      cumulativePaid: null,
      remainingAmount: null,
    }));
  }

  async financeInbox(
    actor: AuthenticatedActor,
  ): Promise<readonly SalesFinanceInboxPaymentV1[]> {
    if (!has(actor, 'finance.read'))
      throw new ForbiddenException({
        code: 'FINANCE_INBOX_FORBIDDEN',
        message: 'مجوز مشاهده کارتابل مالی وجود ندارد.',
      });
    const rows = await this.repository.pendingFinancePayments(actor.branchIds);
    const names = new Map(
      (
        await this.repository.findUserDisplayNames(
          rows.map(({ createdByUserId }) => createdByUserId),
        )
      ).map((user) => [user.id, user.displayName]),
    );
    return rows.map((row) => ({
      version: 1,
      paymentId: row.id,
      contractId: row.contract.id,
      contractNumber: row.contract.contractNumber,
      customerId: row.contract.customerId,
      customerNameSnapshot: row.contract.customerNameSnapshot,
      branchId: row.contract.branchId,
      amount: row.amount.toString(),
      currencyCode: row.currencyCode,
      method: row.method,
      description: row.description,
      paymentReference: row.paymentReference,
      destinationAccountId: row.destinationAccountId,
      dueAt: row.dueAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      createdByUserId: row.createdByUserId,
      createdByName: names.get(row.createdByUserId) ?? null,
      contractVersion: row.contract.version,
    }));
  }

  async detailForProfit(id: string, actor: AuthenticatedActor) {
    if (!has(actor, 'finance.read')) throw new ForbiddenException();
    const row = await this.repository.findById(id);
    if (!row) throw new NotFoundException('قرارداد یافت نشد.');
    if (!actor.branchIds.includes(row.branchId)) throw new ForbiddenException();
    return { data: presentSalesContract(row, undefined, this.buyerCrypto) };
  }

  async paymentReceiptScope(
    id: string,
    actor: AuthenticatedActor,
    paymentId?: string,
  ) {
    const row = await this.repository.findById(id);
    if (!row) throw new NotFoundException('قرارداد یافت نشد.');
    this.assertRead(row, actor);
    if (paymentId && !row.payments.some((p) => p.id === paymentId))
      throw new NotFoundException('پرداخت متعلق به این قرارداد نیست.');
    return {
      branchId: row.branchId,
      contractNumber: row.contractNumber,
      ownerUserId: row.ownerUserId,
      entries: row.payments.map((p) => ({
        id: p.id,
        paymentReference: p.paymentReference ?? null,
        dueAt: p.dueAt.toISOString(),
      })),
    };
  }
  async detail(id: string, actor: AuthenticatedActor) {
    const row = await this.repository.findById(id);
    if (!row)
      throw new NotFoundException({
        code: 'SALES_CONTRACT_NOT_FOUND',
        message: 'قرارداد یافت نشد.',
      });
    this.assertRead(row, actor);
    const mayReadPayments =
      has(actor, 'sales.payments.read') ||
      canSelfServeSalesContract(actor, row);
    const creators =
      mayReadPayments && row.payments.length
        ? await this.repository.findUserDisplayNames(
            row.payments.map(({ createdByUserId }) => createdByUserId),
          )
        : [];
    const detail = presentSalesContract(
      row,
      new Map(
        creators.map(({ id: userId, displayName }) => [userId, displayName]),
      ),
      this.buyerCrypto,
    );
    if (this.tickets.currentSelections)
      detail.ticketSelections = await this.tickets.currentSelections(
        detail.ticketSelections,
        row.branchId,
      );
    return {
      data: mayReadPayments ? detail : { ...detail, payments: [] },
    };
  }

  async create(
    input: SalesContractCreateRequest,
    actor: AuthenticatedActor,
    requestedBranch: string | undefined,
    idempotencyKey: string | undefined,
    traceId?: string,
  ) {
    if (!has(actor, 'sales.contracts.create'))
      throw new ForbiddenException('مجوز ایجاد قرارداد وجود ندارد.');
    if (!idempotencyKey?.trim())
      throw new BadRequestException('Idempotency-Key الزامی است.');
    domainCall(() => validateSalesContract(input));
    const fingerprint = salesFingerprint(input);
    const existing = await this.repository.findByCreateKey(
      actor.userId,
      idempotencyKey,
    );
    if (existing) {
      if (existing.createRequestFingerprint !== fingerprint)
        throw new ConflictException({
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'این کلید با درخواست متفاوت استفاده شده است.',
        });
      return {
        data: presentSalesContract(existing, undefined, this.buyerCrypto),
        meta: { idempotentReplay: true },
      };
    }
    // Preserve recorded legacy idempotent replays; enforce terms for new cheque sales.
    domainCall(() => validateSalesContract(input, true));
    const branchId = branch(actor, requestedBranch);
    let validatedPublishedHotelId: string | undefined;
    if (
      this.packageQuotes &&
      input.services.some((s) => s.metadata?.tourDepartureId)
    ) {
      validatedPublishedHotelId = await this.packageQuotes.assertContractSale(
        input,
        actor,
        branchId,
      );
    } else if (input.services.some((s) => s.metadata?.packagePublishedSale))
      throw new BadRequestException('قیمت فروش معتبر نیست.');
    await this.assertTour(input, branchId, validatedPublishedHotelId);
    await this.assertAdditionalHotelStays(input);
    await this.assertHotelRoomCapacity(input, branchId);
    const customer = await this.customers.resolveSnapshot(
      input.customerId,
      actor,
    );
    await this.customers.assertPassengers(input.passengers, actor);
    const row = await this.repository.create(
      input,
      customer.displayName,
      idempotencyKey,
      fingerprint,
      this.context(actor, branchId, traceId),
    );
    return {
      data: presentSalesContract(row, undefined, this.buyerCrypto),
      meta: { idempotentReplay: false },
    };
  }

  async update(
    id: string,
    input: SalesContractCreateRequest & {
      version: number;
      reason?: string | null;
      preserveContractPrices?: true;
    },
    actor: AuthenticatedActor,
    traceId?: string,
    categories?: SalesContractAmendmentV1['passengerCategories'],
  ) {
    if (!Number.isInteger(input.version) || input.version < 1)
      throw new BadRequestException('نسخه معتبر قرارداد الزامی است.');
    const row = await this.repository.findById(id);
    if (!row)
      throw new NotFoundException({
        code: 'SALES_CONTRACT_NOT_FOUND',
        message: 'قرارداد یافت نشد.',
      });
    this.assertUpdate(row, actor);
    if (categories) {
      if (!Array.isArray(input.passengers) || !Array.isArray(input.services))
        throw new BadRequestException('اطلاعات اصلاح قرارداد معتبر نیست.');
      if (
        !has(actor, 'sales.contracts.confirm') ||
        !has(actor, 'sales.reservation_request.create')
      )
        throw new ForbiddenException('مجوز تأیید و ارسال رزرو وجود ندارد.');
      if (
        !isOptionalOperationReason(input.reason) ||
        !isOptionalOperationReason(input.reason) ||
        (input.reason ?? '').length > 500
      )
        throw new BadRequestException('دلیل اصلاح قرارداد الزامی است.');
      if (
        input.customerId !== row.customerId ||
        (input.payerCustomerId ?? input.customerId) !==
          (row.payerCustomerId ?? row.customerId)
      )
        throw new BadRequestException(
          'طرف قرارداد را در بخش طرف قرارداد اصلاح کنید.',
        );
      if (
        Object.keys(categories).length !== input.passengers.length ||
        input.passengers.some(
          (p) =>
            !['ADT', 'CHD', 'INF'].includes(categories[p.customerId] ?? '') ||
            (row.passengers.some((old) => old.customerId === p.customerId) &&
              !row.passengers.some(
                (n) =>
                  n.customerId === p.customerId &&
                  (n.birthDate?.toISOString().slice(0, 10) ?? '') ===
                    p.birthDate.slice(0, 10) &&
                  n.displayNameSnapshot === p.displayNameSnapshot,
              )),
        )
      )
        throw new BadRequestException(
          'اطلاعات هویتی مسافران را در ویرایش مسافران اصلاح کنید.',
        );
      if (row.status === 'CANCELLED')
        throw new ConflictException('قرارداد ابطال‌شده قابل اصلاح نیست.');
    }
    if (
      row.hotelSelection?.additionalStays?.length &&
      input.hotelSelection &&
      !Object.hasOwn(input.hotelSelection, 'additionalStays')
    ) {
      if (input.hotelSelection.hotelId !== row.hotelSelection.hotelId)
        throw new BadRequestException(
          'Review the full hotel itinerary before changing the primary hotel',
        );
      input = {
        ...input,
        hotelSelection: {
          ...input.hotelSelection,
          additionalStays: presentSalesContract(
            row,
            undefined,
            this.buyerCrypto,
          ).hotelSelection!.additionalStays!,
        },
      };
    }
    if (
      input.hotelSelection?.additionalStays &&
      row.hotelSelection?.additionalStays?.length
    ) {
      const saved =
        presentSalesContract(row, undefined, this.buyerCrypto).hotelSelection
          ?.additionalStays ?? [];
      input = {
        ...input,
        hotelSelection: {
          ...input.hotelSelection,
          additionalStays: input.hotelSelection.additionalStays.map((stay) => {
            const previous = saved.find(
              (item) => item.hotelId === stay.hotelId,
            );
            if (stay.rooms === undefined && previous?.rooms?.length)
              return { ...stay, rooms: previous.rooms };
            if (!Array.isArray(stay.rooms) || !previous?.rooms) return stay;
            return {
              ...stay,
              rooms: stay.rooms.map((room) => {
                if (
                  !room ||
                  typeof room !== 'object' ||
                  !Array.isArray(room.childAges)
                )
                  return room;
                const old = previous.rooms?.find(
                  (item) =>
                    item.ordinal === room.ordinal &&
                    item.roomTypeId === room.roomTypeId,
                );
                return room.roomCategory === undefined &&
                  old?.roomCategory &&
                  salesRoomCategories(
                    room.adults,
                    room.childAges.length,
                  ).includes(old.roomCategory)
                  ? { ...room, roomCategory: old.roomCategory }
                  : room;
              }),
            };
          }),
        },
      };
    }
    if (row.paymentTerms != null && input.paymentTerms === null)
      throw new BadRequestException(
        'نوع فروش ذخیره‌شده قرارداد قابل حذف نیست.',
      );
    input = {
      ...input,
      passengers: input.passengers.map((passenger) => {
        if (passenger.childAgeBand !== undefined) return passenger;
        const before = row.passengers.find(
          (p) => p.customerId === passenger.customerId,
        );
        const age =
          categories?.[passenger.customerId] ??
          contractPassengerAgeCategory(passenger, input.departureDate);
        return age === 'CHD' &&
          (before?.childAgeBand === 'AGE_2_6' ||
            before?.childAgeBand === 'AGE_6_12')
          ? { ...passenger, childAgeBand: before.childAgeBand }
          : passenger;
      }),
      paymentTerms:
        input.paymentTerms === undefined
          ? ((row.paymentTerms as unknown as SalesContractDetail['paymentTerms']) ??
            null)
          : input.paymentTerms,
    };
    // Draft updates do not replace payment rows: validate the actual stored schedule.
    if (input.paymentTerms)
      input = { ...input, payments: row.payments.map(paymentInput) };
    domainCall(() => validateSalesContract(input, false, categories));
    let validatedPublishedHotelId: string | undefined;
    if (input.services.some((s) => s.metadata?.packagePublishedSale)) {
      if (!this.packageQuotes)
        throw new BadRequestException('قیمت فروش معتبر نیست.');
      const savedQuote = row.services.find(
        (s) =>
          (s.metadata as Record<string, unknown> | null)?.packagePublishedSale,
      )?.metadata as Record<string, unknown> | undefined;
      const nextQuote = input.services.find(
        (s) => s.metadata?.packagePublishedSale,
      )?.metadata?.packagePublishedSale;
      const oldHotel = row.hotelSelection,
        nextHotel = input.hotelSelection;
      const unchanged =
        oldHotel &&
        nextHotel &&
        savedQuote?.packagePublishedSale === nextQuote &&
        (
          row.services.find(
            (s) =>
              (s.metadata as Record<string, unknown> | null)?.tourDepartureId,
          )?.metadata as Record<string, unknown> | undefined
        )?.tourDepartureId ===
          input.services.find((s) => s.metadata?.tourDepartureId)?.metadata
            ?.tourDepartureId &&
        oldHotel.hotelId === nextHotel.hotelId &&
        oldHotel.checkInDate.toISOString().slice(0, 10) ===
          nextHotel.checkInDate &&
        oldHotel.checkOutDate.toISOString().slice(0, 10) ===
          nextHotel.checkOutDate &&
        oldHotel.rooms.length === nextHotel.rooms?.length &&
        oldHotel.rooms.every(
          (r, j) =>
            r.roomTypeId === nextHotel.rooms![j]?.roomTypeId &&
            r.adults === nextHotel.rooms![j]?.adults &&
            JSON.stringify(r.childAges) ===
              JSON.stringify(nextHotel.rooms![j]?.childAges),
        );
      if (unchanged && typeof nextQuote === 'string')
        this.packageQuotes.validateContractAmounts(
          input,
          JSON.parse(nextQuote).prices,
        );
      validatedPublishedHotelId = unchanged
        ? oldHotel.hotelId
        : await this.packageQuotes.validateContractSale(
            input,
            actor,
            row.branchId,
          );
    }
    await this.assertTour(input, row.branchId, validatedPublishedHotelId);
    await this.assertAdditionalHotelStays(
      input,
      presentSalesContract(row, undefined, this.buyerCrypto).hotelSelection,
    );
    await this.assertHotelRoomCapacity(input, row.branchId);
    for (const passenger of row.passengers) {
      const next = input.passengers.find(
        (p) => p.customerId === passenger.customerId,
      );
      if (
        passenger.accommodationKind &&
        next &&
        !next.accommodationKind &&
        input.services.some(
          (s) =>
            s.kind === 'HOTEL' && next.serviceClientKeys.includes(s.clientKey),
        )
      )
        throw new BadRequestException(
          'نوع اقامت ذخیره‌شده مسافر را مشخص کنید؛ حذف ضمنی آن مجاز نیست.',
        );
    }
    const preservePrices = input.preserveContractPrices === true;
    if (preservePrices) {
      const componentFacts = (
        components: readonly {
          type: string;
          title: string;
          amount: unknown;
          currencyCode: string;
        }[],
      ) =>
        JSON.stringify(
          components.map((p) => [
            p.type,
            p.title,
            String(p.amount),
            p.currencyCode,
          ]),
        );
      if (
        !categories ||
        input.passengers.length < 1 ||
        input.passengers.some((p) => p.agreedPrices !== undefined) ||
        input.services.some(
          (s) => s.metadata?.contractPackagePricingVersion !== 1,
        ) ||
        componentFacts(input.priceComponents) !==
          componentFacts(row.priceComponents)
      )
        throw new BadRequestException(
          'اصلاح تعداد مسافران نباید مبلغ ثبت‌شده قرارداد را تغییر دهد.',
        );
    }
    if (
      !preservePrices &&
      row.passengers.some((passenger) => passenger.agreedPrices?.length)
    )
      domainCall(() => {
        try {
          validatePassengerPackagePrices(
            input.passengers,
            input.paymentTerms
              ? input.priceComponents.filter(
                  (p) => p.title !== SALES_CHEQUE_FEE,
                )
              : input.priceComponents,
            true,
          );
        } catch (error) {
          throw new SalesDomainError(
            'SALES_MONEY_INVALID',
            error instanceof Error ? error.message : 'مبلغ مسافر معتبر نیست.',
          );
        }
      });
    const customer = await this.customers.resolveSnapshot(
      input.customerId,
      actor,
    );
    await this.customers.assertPassengers(input.passengers, actor);
    const updateInput: SalesContractCreateRequest =
      input.buyerContact === undefined
        ? {
            ...input,
            buyerContact:
              row.customerId === input.customerId
                ? (this.buyerCrypto?.decrypt(row.buyerContact) ?? null)
                : null,
          }
        : input;
    domainCall(() => validateSalesContract(updateInput, false, categories));
    const previous = categories
      ? presentSalesContract(row, undefined, this.buyerCrypto)
      : undefined;
    const execution = (
      c: SalesContractCreateRequest,
      ages: Readonly<Record<string, string>>,
    ) =>
      salesFingerprint({
        originId: c.originId,
        destinationId: c.destinationId,
        departureDate: c.departureDate.slice(0, 10),
        tickets: c.ticketSelections ?? [],
        hotel: c.hotelSelection ?? null,
        ages,
        childAgeBands: c.passengers.map((p) => [
          p.customerId,
          p.childAgeBand ?? null,
          [...p.serviceClientKeys].sort(),
        ]),
        services: c.services.map((s) => ({
          clientKey: s.clientKey,
          kind: s.kind,
          titleSnapshot: s.titleSnapshot,
          status: s.status,
          referenceId: s.referenceId,
          metadata: Object.fromEntries(
            Object.entries(s.metadata ?? {}).filter(
              ([key]) =>
                ![
                  'legacyRowPricesV1',
                  'passengerPackagePricingVersion',
                  'contractPackagePricingVersion',
                  'automaticFlightRoomTotalV1',
                  'passengerHotelPricesV1',
                  'passengerTotalPricesV1',
                  'passengerDeductionsV1',
                  'passengerFlightPricesV1',
                ].includes(key),
            ),
          ),
        })),
      });
    const changedExecution =
      categories &&
      previous &&
      execution(updateInput, categories) !==
        execution(
          {
            ...updateInput,
            originId: previous.originId,
            destinationId: previous.destinationId,
            departureDate: previous.departureDate,
            services: previous.servicesDetail,
            ticketSelections: previous.ticketSelections,
            hotelSelection: previous.hotelSelection,
            passengers: previous.passengersDetail,
          },
          Object.fromEntries(
            previous.passengersDetail.map((p) => [p.customerId, p.ageCategory]),
          ),
        );
    const requestId = randomUUID();
    const snapshot: SalesReservationRequestV1 | undefined =
      changedExecution && categories
        ? {
            version: 1,
            requestId,
            contractId: id,
            contractNumber: row.contractNumber,
            contractVersion: input.version + 1,
            customerId: row.customerId,
            passengerIds: input.passengers.map((p) => p.customerId),
            passengerAssignments: input.passengers.map((p) => ({
              customerId: p.customerId,
              displayNameSnapshot: p.displayNameSnapshot,
              ageCategory: categories[p.customerId]!,
              ...(p.childAgeBand ? { childAgeBand: p.childAgeBand } : {}),
              serviceClientKeys: p.serviceClientKeys,
            })),
            serviceSelections: input.services,
            ticketSelections: input.ticketSelections ?? [],
            selectedTicketOfferIds: (input.ticketSelections ?? []).map(
              (t) => t.offerId,
            ),
            hotelSelection: input.hotelSelection ?? null,
            createdAt: new Date().toISOString(),
          }
        : undefined;
    const changed = await this.repository.updateDraft(
      id,
      updateInput,
      input.version,
      customer.displayName,
      this.context(actor, row.branchId, traceId),
      categories
        ? {
            categories,
            snapshot: snapshot as unknown as Prisma.InputJsonValue | undefined,
            requestId,
            previousStatus: row.status,
            reason: input.reason!.trim(),
            before: JSON.parse(
              JSON.stringify({
                version: row.version,
                tickets: row.ticketSelections,
                hotel: row.hotelSelection,
                prices: row.priceComponents,
                categories: row.passengers.map((p) => ({
                  customerId: p.customerId,
                  ageCategory: p.ageCategory,
                  childAgeBand: p.childAgeBand,
                })),
              }),
            ) as Prisma.InputJsonValue,
            reserve: async (tx) => {
              if (!this.tickets.amend)
                throw new ConflictException('اصلاح ظرفیت بلیت در دسترس نیست.');
              const legacyParties = readLegacyServiceParties(input.services);
              await this.tickets.amend(
                tx,
                (input.ticketSelections ?? []).filter((selection) =>
                  legacyParties?.[selection.serviceClientKey]
                    ? legacyParties[selection.serviceClientKey]!.adults +
                        legacyParties[selection.serviceClientKey]!.children >
                      0
                    : input.passengers.some(
                        (p) =>
                          categories[p.customerId] !== 'INF' &&
                          p.serviceClientKeys.includes(
                            selection.serviceClientKey,
                          ),
                      ),
                ),
                row.branchId,
                id,
                legacyParties
                  ? Math.max(
                      ...Object.values(legacyParties).map(
                        (p) => p.adults + p.children,
                      ),
                    )
                  : input.passengers.filter(
                      (p) => categories[p.customerId] !== 'INF',
                    ).length,
                Object.fromEntries(
                  (input.ticketSelections ?? []).map((t) => [
                    t.serviceClientKey,
                    legacyParties?.[t.serviceClientKey]
                      ? legacyParties[t.serviceClientKey]!.adults +
                        legacyParties[t.serviceClientKey]!.children
                      : input.passengers.filter(
                          (p) =>
                            categories[p.customerId] !== 'INF' &&
                            p.serviceClientKeys.includes(t.serviceClientKey),
                        ).length,
                  ]),
                ),
              );
            },
          }
        : undefined,
    );
    if (!changed)
      throw new ConflictException({
        code: 'CONCURRENT_MODIFICATION',
        message: 'قرارداد هم‌زمان تغییر کرده یا دیگر قابل ویرایش نیست.',
      });
    return this.detail(id, actor);
  }

  async paymentAccounts(id: string, actor: AuthenticatedActor) {
    const row = await this.repository.findById(id);
    if (!row) throw new NotFoundException('قرارداد یافت نشد.');
    this.assertRead(row, actor);
    if (
      !has(actor, 'sales.payments.create') &&
      !canSelfServeSalesContract(actor, row)
    )
      throw new ForbiddenException('مجوز ثبت پرداخت وجود ندارد.');
    return { data: await this.repository.paymentAccounts(row.branchId) };
  }

  async addPayment(
    id: string,
    input: SalesPaymentCreateRequest,
    actor: AuthenticatedActor,
    idempotencyKey: string | undefined,
    traceId?: string,
  ) {
    if (
      !has(actor, 'sales.payments.create') &&
      !hasSalesContractSelfService(actor.permissions)
    )
      throw new ForbiddenException('مجوز ثبت پرداخت وجود ندارد.');
    if (!idempotencyKey?.trim())
      throw new BadRequestException('Idempotency-Key الزامی است.');
    if (!Number.isInteger(input.version) || input.version < 1)
      throw new BadRequestException('نسخه معتبر قرارداد الزامی است.');
    const row = await this.repository.findById(id);
    if (!row)
      throw new NotFoundException({
        code: 'SALES_CONTRACT_NOT_FOUND',
        message: 'قرارداد یافت نشد.',
      });
    this.assertRead(row, actor);
    if (
      !has(actor, 'sales.payments.create') &&
      !canSelfServeSalesContract(actor, row)
    )
      throw new ForbiddenException('مجوز ثبت پرداخت وجود ندارد.');
    domainCall(() => validateSalesPayment(input));
    if (
      (row.paymentTerms as unknown as SalesContractDetail['paymentTerms'])
        ?.mode === 'CASH' &&
      input.method === 'CHECK'
    )
      throw new BadRequestException('فروش نقدی پرداخت چکی ندارد.');
    const fingerprint = salesFingerprint(input);
    const result = await this.repository.addPayment(
      id,
      input,
      idempotencyKey,
      fingerprint,
      this.context(actor, row.branchId, traceId),
    );
    if (result === 'conflict')
      throw new ConflictException({
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'کلید پرداخت با درخواست متفاوت استفاده شده است.',
      });
    if (result === 'concurrent')
      throw new ConflictException({
        code: 'CONCURRENT_MODIFICATION',
        message: 'قرارداد هم‌زمان تغییر کرده است.',
      });
    return {
      ...(await this.detail(id, actor)),
      meta: { idempotentReplay: result === 'replayed' },
    };
  }

  async confirm(
    id: string,
    version: number,
    reason: string | null | undefined,
    actor: AuthenticatedActor,
    idempotencyKey: string | undefined,
    traceId?: string,
  ) {
    const entryCreator =
      has(actor, 'sales.contracts.create') &&
      canViewRoute(actor.permissions, '/sales/contracts/new');
    const fullConfirmation =
      has(actor, 'sales.contracts.confirm') &&
      has(actor, 'sales.reservation_request.create');
    if (!fullConfirmation && !entryCreator)
      throw new ForbiddenException('مجوز تأیید و ارسال رزرو وجود ندارد.');
    if (!idempotencyKey?.trim())
      throw new BadRequestException('Idempotency-Key الزامی است.');
    if (!Number.isInteger(version) || version < 1)
      throw new BadRequestException('نسخه معتبر قرارداد الزامی است.');
    const row = await this.repository.findById(id);
    if (!row)
      throw new NotFoundException({
        code: 'SALES_CONTRACT_NOT_FOUND',
        message: 'قرارداد یافت نشد.',
      });
    if (!fullConfirmation) {
      if (
        row.ownerUserId !== actor.userId ||
        !actor.branchIds.includes(row.branchId) ||
        (!['DRAFT', 'PENDING_CONFIRMATION'].includes(row.status) &&
          row.confirmIdempotencyKey !== idempotencyKey)
      )
        throw new ForbiddenException();
    } else this.assertRead(row, actor);
    const fingerprint = salesFingerprint({ id, version });
    if (row.confirmIdempotencyKey === idempotencyKey) {
      if (row.confirmRequestFingerprint !== fingerprint)
        throw new ConflictException({
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'کلید تأیید با درخواست متفاوت استفاده شده است.',
        });
      return {
        data: presentSalesContract(row, undefined, this.buyerCrypto),
        meta: { idempotentReplay: true },
      };
    }
    await this.customers.resolveSnapshot(row.customerId, actor);
    await this.customers.assertPassengers(row.passengers, actor);
    const presented = presentSalesContract(row, undefined, this.buyerCrypto);
    if (this.tickets.currentSelections)
      presented.ticketSelections = await this.tickets.currentSelections(
        presented.ticketSelections,
        row.branchId,
      );
    await this.assertPresentedHotelRoomCapacity(presented);
    const legacyParties = readLegacyServiceParties(presented.servicesDetail);
    const legacyFlight = presented.ticketSelections[0]
      ? legacyParties?.[presented.ticketSelections[0].serviceClientKey]
      : undefined;
    const seatCount = legacyFlight
      ? legacyFlight.adults + legacyFlight.children
      : presented.passengersDetail.filter(
          ({ ageCategory }) => ageCategory !== 'INF',
        ).length;
    const ticketCheck = presented.ticketSelections.length
      ? await this.tickets.reserve(
          presented.ticketSelections,
          row.branchId,
          row.id,
          seatCount,
          legacyParties ||
            presented.servicesDetail.some(
              (service) => service.kind === 'HOTEL' || service.kind === 'TOUR',
            )
            ? undefined
            : Object.fromEntries(
                presented.servicesDetail
                  .filter(
                    (service) =>
                      service.kind === 'FLIGHT' &&
                      (service.pricing?.[0]?.daySale.basis === 'TOTAL' ||
                        service.metadata?.catalogSaleQuoteVersion !==
                          undefined),
                  )
                  .map((service) => [
                    service.clientKey,
                    expectedTicketSale(service.pricing?.[0], service.metadata),
                  ]),
              ),
          Object.fromEntries(
            presented.ticketSelections.map((t) => [
              t.serviceClientKey,
              legacyParties?.[t.serviceClientKey]
                ? legacyParties[t.serviceClientKey]!.adults +
                  legacyParties[t.serviceClientKey]!.children
                : presented.passengersDetail.filter(
                    (p) =>
                      p.ageCategory !== 'INF' &&
                      p.serviceClientKeys.includes(t.serviceClientKey),
                  ).length,
            ]),
          ),
        )
      : { available: true, unavailableOfferIds: [], createdAllocationIds: [] };
    if (!ticketCheck.available)
      throw new ConflictException({
        code: 'TICKET_CAPACITY_INSUFFICIENT',
        message: 'ظرفیت باقی‌مانده بلیت برای تعداد بزرگسال و کودک کافی نیست.',
        unavailableOfferIds: ticketCheck.unavailableOfferIds,
      });
    const requestId = randomUUID();
    const snapshot: SalesReservationRequestV1 = {
      passengerAssignments: presented.passengersDetail.map((passenger) => ({
        customerId: passenger.customerId,
        displayNameSnapshot: passenger.displayNameSnapshot,
        ageCategory: passenger.ageCategory,
        ...(passenger.childAgeBand
          ? { childAgeBand: passenger.childAgeBand }
          : {}),
        serviceClientKeys: passenger.serviceClientKeys,
      })),
      ticketSelections: presented.ticketSelections,
      version: 1,
      requestId,
      contractId: row.id,
      contractNumber: row.contractNumber,
      contractVersion: version + 1,
      customerId: row.customerId,
      passengerIds: row.passengers.map(({ customerId }) => customerId),
      serviceSelections: presented.servicesDetail.map((service) =>
        service.kind === 'BUS' || service.kind === 'TRAIN'
          ? {
              ...service,
              metadata: {
                ...service.metadata,
                originId: service.metadata?.originId || presented.originId,
                destinationId:
                  service.metadata?.destinationId || presented.destinationId,
                date: service.metadata?.date || presented.departureDate,
              },
            }
          : service,
      ),
      selectedTicketOfferIds: row.ticketSelections.map(
        ({ offerId }) => offerId,
      ),
      hotelSelection: presented.hotelSelection,
      createdAt: new Date().toISOString(),
    };
    let changed = false;
    try {
      changed = await this.repository.transition(
        id,
        version,
        ['DRAFT', 'PENDING_CONFIRMATION'],
        'SENT_TO_RESERVATIONS',
        reason?.trim() || 'تأیید و ارسال خودکار درخواست رزرو',
        this.context(actor, row.branchId, traceId),
        idempotencyKey,
        fingerprint,
        snapshot as unknown as Prisma.InputJsonValue,
        requestId,
      );
    } catch (cause) {
      await this.tickets.release(ticketCheck.createdAllocationIds);
      throw cause;
    }
    if (!changed) {
      await this.tickets.release(ticketCheck.createdAllocationIds);
      throw new ConflictException({
        code: 'CONCURRENT_MODIFICATION',
        message: 'قرارداد هم‌زمان تغییر کرده است.',
      });
    }
    return {
      ...(await this.detail(
        id,
        fullConfirmation
          ? actor
          : {
              ...actor,
              permissions: [...actor.permissions, 'sales.contracts.read.own'],
            },
      )),
      meta: { reservationRequest: snapshot, idempotentReplay: false },
    };
  }

  async cancel(
    id: string,
    version: number,
    reason: string | null | undefined,
    actor: AuthenticatedActor,
    traceId?: string,
  ) {
    if (!has(actor, 'sales.contracts.cancel'))
      throw new ForbiddenException('مجوز لغو قرارداد وجود ندارد.');
    if (!isOptionalOperationReason(reason))
      throw new BadRequestException('دلیل لغو الزامی است.');
    if (!Number.isInteger(version) || version < 1)
      throw new BadRequestException('نسخه معتبر قرارداد الزامی است.');
    const row = await this.repository.findById(id);
    if (!row)
      throw new NotFoundException({
        code: 'SALES_CONTRACT_NOT_FOUND',
        message: 'قرارداد یافت نشد.',
      });
    this.assertRead(row, actor);
    const changed = await this.repository.transition(
      id,
      version,
      ['DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'SENT_TO_RESERVATIONS'],
      'CANCELLED',
      (reason ?? '').trim(),
      this.context(actor, row.branchId, traceId),
    );
    if (!changed)
      throw new ConflictException({
        code: 'CONCURRENT_MODIFICATION',
        message: 'قرارداد هم‌زمان تغییر کرده یا قابل لغو نیست.',
      });
    await this.tickets.releaseContract(id);
    return this.detail(id, actor);
  }

  async audit(id: string, actor: AuthenticatedActor) {
    if (!has(actor, 'sales.audit.read'))
      throw new ForbiddenException('مجوز مشاهده Audit وجود ندارد.');
    await this.detail(id, actor);
    return { data: await this.repository.audit(id) };
  }

  async history(id: string, actor: AuthenticatedActor) {
    await this.detail(id, actor);
    return { data: await this.repository.history(id) };
  }

  async receivables(
    query: SalesReceivablesQuery,
    actor: AuthenticatedActor,
  ): Promise<SalesReceivables> {
    const day = Joi.string()
      .pattern(/^\d{4}-\d{2}-\d{2}$/)
      .custom((value, helpers) => {
        const parsed = new Date(`${value}T00:00:00.000Z`);
        return Number.isFinite(parsed.getTime()) &&
          parsed.toISOString().slice(0, 10) === value
          ? value
          : helpers.error('any.invalid');
      });
    const validated = Joi.object({
      search: Joi.string().trim().max(160).allow(''),
      settlementStatus: Joi.string().valid(
        'UNPAID',
        'PARTIALLY_SETTLED',
        'SETTLED',
        'OVERPAID',
      ),
      from: day,
      to: day,
      dateBasis: Joi.string().valid('CONTRACT', 'TRAVEL').default('CONTRACT'),
      originId: Joi.string().guid(),
      destinationId: Joi.string().guid(),
      customerType: Joi.string()
        .valid('ALL', 'AGENCY', 'IN_PERSON')
        .default('ALL'),
      agencyCustomerId: Joi.string().guid(),
    })
      .unknown(false)
      .validate(query);
    if (
      validated.error ||
      (query.from && query.to && query.from > query.to) ||
      (query.agencyCustomerId && query.customerType !== 'AGENCY')
    )
      throw new BadRequestException('فیلتر مانده قابل دریافت معتبر نیست.');
    const filters = validated.value as SalesReceivablesQuery;
    const rows = (
      await this.repository.dashboardRows(this.readScope(actor))
    ).filter((row) => row.status !== 'CANCELLED');
    const buyers = await this.customers.partyKinds(
      [...new Set(rows.map((row) => row.customerId))],
      actor,
    );
    const kinds = new Map(buyers.map((buyer) => [buyer.id, buyer.kind]));
    const cities = [
      ...new Set(rows.flatMap((row) => [row.originId, row.destinationId])),
    ];
    const names = new Map<string, string>();
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(cities.length, 8) }, async () => {
        while (cursor < cities.length) {
          const id = cities[cursor++]!;
          const city = this.references
            ? await this.references.detail('cities', id)
            : null;
          names.set(id, city?.data.name ?? id);
        }
      }),
    );
    const routes = new Map<
      string,
      SalesReceivables['data']['routes'][number]
    >();
    const agencies = new Map<string, { id: string; name: string }>();
    for (const row of rows) {
      routes.set(`${row.originId}:${row.destinationId}`, {
        originId: row.originId,
        destinationId: row.destinationId,
        label: `${names.get(row.originId)} ← ${names.get(row.destinationId)}`,
      });
      if (kinds.get(row.customerId) === 'ORGANIZATION')
        agencies.set(row.customerId, {
          id: row.customerId,
          name: row.customerNameSnapshot,
        });
    }
    const matched = rows.filter((row) => {
      const value = (
        filters.dateBasis === 'TRAVEL' ? row.departureDate : row.createdAt
      )
        .toISOString()
        .slice(0, 10);
      return (
        (!filters.search ||
          [
            row.contractNumber,
            row.customerNameSnapshot,
            ...(row.services ?? []).flatMap(({ metadata }) =>
              metadata &&
              typeof metadata === 'object' &&
              !Array.isArray(metadata) &&
              typeof metadata.contractNotice === 'string'
                ? [metadata.contractNotice]
                : [],
            ),
            ...(has(actor, 'sales.payments.read')
              ? row.payments.map((payment) => payment.paymentReference ?? '')
              : []),
          ].some((value) =>
            value.toLowerCase().includes(filters.search!.toLowerCase()),
          )) &&
        (!filters.settlementStatus ||
          row.settlementStatus === filters.settlementStatus) &&
        (!filters.from || value >= filters.from) &&
        (!filters.to || value <= filters.to) &&
        (!filters.originId || row.originId === filters.originId) &&
        (!filters.destinationId ||
          row.destinationId === filters.destinationId) &&
        (!filters.agencyCustomerId ||
          row.customerId === filters.agencyCustomerId) &&
        (filters.customerType === 'ALL' ||
          kinds.get(row.customerId) ===
            (filters.customerType === 'AGENCY' ? 'ORGANIZATION' : 'PERSON'))
      );
    });
    const balances = matched.flatMap(
      (row) => presentSalesContract(row, undefined, this.buyerCrypto).balances,
    );
    return {
      data: {
        balances: [...new Set(balances.map((balance) => balance.currencyCode))]
          .sort()
          .map((currencyCode) => ({
            currencyCode,
            amount: sumSalesDecimals(
              balances
                .filter((balance) => balance.currencyCode === currencyCode)
                .map((balance) => balance.outstanding),
            ),
          })),
        contractCount: matched.length,
        routes: [...routes.values()].sort((a, b) =>
          a.label.localeCompare(b.label, 'fa'),
        ),
        agencies: [...agencies.values()].sort((a, b) =>
          a.name.localeCompare(b.name, 'fa'),
        ),
      },
    };
  }

  private readScope(actor: AuthenticatedActor): Prisma.SalesContractWhereInput {
    if (has(actor, 'sales.contracts.read.all')) return {};
    if (has(actor, 'sales.contracts.read.branch'))
      return { branchId: { in: actor.branchIds } };
    if (has(actor, 'sales.contracts.read.own'))
      return {
        branchId: { in: actor.branchIds },
        ownerUserId: actor.userId,
      };
    throw new ForbiddenException('مجوز مشاهده قرارداد وجود ندارد.');
  }

  async dashboard(actor: AuthenticatedActor) {
    let scope: Prisma.SalesContractWhereInput;
    if (has(actor, 'sales.contracts.read.all')) scope = {};
    else if (has(actor, 'sales.contracts.read.branch'))
      scope = { branchId: { in: actor.branchIds } };
    else if (has(actor, 'sales.contracts.read.own'))
      scope = {
        branchId: { in: actor.branchIds },
        ownerUserId: actor.userId,
      };
    else
      throw new ForbiddenException({
        code: 'SALES_CONTRACT_FORBIDDEN',
        message: 'مجوز داشبورد فروش وجود ندارد.',
      });
    const rows = await this.repository.dashboardRows(scope);
    const details = rows
      .filter((row) => row.status !== 'CANCELLED')
      .map((row) => presentSalesContract(row, undefined, this.buyerCrypto));
    const today = new Date().toISOString().slice(0, 10);
    const balances = details.flatMap((item) => item.balances);
    const currencyCodes = [
      ...new Set(balances.map(({ currencyCode }) => currencyCode)),
    ];
    const byOwner = new Map<string, string[]>();
    for (const detail of details)
      for (const balance of detail.balances) {
        const key = `${detail.ownerUserId}:${balance.currencyCode}`;
        byOwner.set(key, [...(byOwner.get(key) ?? []), balance.amount]);
      }
    return {
      data: {
        todayContracts: details.filter(({ createdAt }) =>
          createdAt.startsWith(today),
        ).length,
        activeContracts: details.filter(
          ({ status }) => !['COMPLETED', 'CANCELLED'].includes(status),
        ).length,
        unpaidContracts: details.filter(
          ({ settlementStatus }) => settlementStatus === 'UNPAID',
        ).length,
        partiallySettledContracts: details.filter(
          ({ settlementStatus }) => settlementStatus === 'PARTIALLY_SETTLED',
        ).length,
        settledContracts: details.filter(
          ({ settlementStatus }) => settlementStatus === 'SETTLED',
        ).length,
        rialSales: sumSalesDecimals(
          balances
            .filter(({ currencyCode }) => currencyCode === 'IRR')
            .map(({ amount }) => amount),
        ),
        foreignCommitments: currencyCodes
          .filter((code) => code !== 'IRR')
          .map((currencyCode) => ({
            currencyCode,
            amount: sumSalesDecimals(
              balances
                .filter((item) => item.currencyCode === currencyCode)
                .map(({ amount }) => amount),
            ),
          })),
        outstanding: currencyCodes.map((currencyCode) => ({
          currencyCode,
          amount: sumSalesDecimals(
            balances
              .filter((item) => item.currencyCode === currencyCode)
              .map(({ outstanding }) => outstanding),
          ),
        })),
        pendingFinancePayments: details
          .flatMap(({ payments }) => payments)
          .filter(({ status }) => status === 'PENDING_FINANCE_CONFIRMATION')
          .length,
        pendingReservationActions: details.filter(({ reservationStatus }) =>
          ['QUEUED', 'NEEDS_REVIEW', 'PARTIALLY_FULFILLED'].includes(
            reservationStatus,
          ),
        ).length,
        salesByCounter: [...byOwner.entries()].map(([key, amounts]) => {
          const separator = key.lastIndexOf(':');
          return {
            ownerUserId: key.slice(0, separator),
            currencyCode: key.slice(separator + 1),
            amount: sumSalesDecimals(amounts),
          };
        }),
        conversionRate: null,
        conversionRateStatus:
          'AWAITING_CUSTOMER_AFFAIRS_PUBLIC_CONTRACT' as const,
      },
    };
  }

  financeReceipt(
    paymentId: string,
    contractId: string,
    actor: AuthenticatedActor,
  ) {
    if (!has(actor, 'finance.read'))
      throw new ForbiddenException('مجوز مشاهده دریافت‌ها وجود ندارد.');
    return this.repository.financeReceipt(
      paymentId,
      contractId,
      actor.branchIds,
    );
  }

  applyFinanceRefund(
    tx: Prisma.TransactionClient,
    input: {
      paymentId: string;
      operationId: string;
      actorId: string;
      amount: string;
      currency: string;
      branchId: string;
    },
  ) {
    return this.repository.applyFinanceRefund(tx, input);
  }

  applyFinancePaymentConfirmed(event: {
    version: 1;
    eventId: string;
    contractId: string;
    paymentId: string;
    financePaymentReference: string;
    receiptAccountId: string;
    confirmedAt: string;
    reviewedByUserId?: string;
    reason?: string;
  }) {
    return this.repository.applyFinanceConfirmation({
      contractId: event.contractId,
      paymentId: event.paymentId,
      financePaymentReference: event.financePaymentReference,
      receiptAccountId: event.receiptAccountId,
      financeConfirmationId: event.eventId,
      confirmedAt: event.confirmedAt,
      ...(event.reviewedByUserId
        ? { reviewedByUserId: event.reviewedByUserId }
        : {}),
      ...(event.reason !== undefined ? { reason: event.reason } : {}),
    });
  }

  applyFinancePaymentCorrection(event: {
    contractId: string;
    paymentId: string;
    reason: string;
    reviewedByUserId: string;
    branchId: string;
  }) {
    return this.repository.applyFinanceCorrection({
      contractId: event.contractId,
      paymentId: event.paymentId,
      reason: event.reason,
      reviewedByUserId: event.reviewedByUserId,
      reviewedAt: new Date().toISOString(),
      branchId: event.branchId,
    });
  }
}
