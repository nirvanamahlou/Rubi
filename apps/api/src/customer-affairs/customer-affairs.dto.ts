import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const CHANNELS = [
  'PHONE',
  'WEBSITE',
  'REFERRAL',
  'WALK_IN',
  'SOCIAL',
  'EMAIL',
  'CHAT',
  'OTHER',
];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'];

export class MoneyDto {
  @IsOptional() @Matches(/^\d+(?:\.\d{1,4})?$/) minimum?: string | null;
  @IsOptional() @Matches(/^\d+(?:\.\d{1,4})?$/) maximum?: string | null;
  @IsOptional() @Matches(/^[A-Z]{3}$/) currencyCode?: string | null;
  @IsOptional() @IsIn(['TOTAL', 'PER_PERSON']) basis?:
    'TOTAL' | 'PER_PERSON' | null;
  @IsOptional() @IsString() @MaxLength(500) unknownReason?: string | null;
}

export class PassengerCompositionDto {
  @IsInt() @Min(0) adults!: number;
  @IsInt() @Min(0) children!: number;
  @IsInt() @Min(0) infants!: number;
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(17, { each: true })
  childAges?: number[];
}

export class LeadMutationDto {
  @IsString() @Length(3, 200) title!: string;
  @IsString() @Length(1, 160) sourceReference!: string;
  @IsIn(CHANNELS) inboundChannel!: string;
  @IsISO8601({ strict: true }) contactOccurredAt!: string;
  @IsString() @Length(3, 1000) travelNeed!: string;
  @IsOptional() @IsString() @MaxLength(160) originReference?: string | null;
  @IsOptional() @IsString() @MaxLength(160) destinationReference?:
    string | null;
  @IsOptional() @IsISO8601({ strict: true }) travelStart?: string | null;
  @IsOptional() @IsISO8601({ strict: true }) travelEnd?: string | null;
  @IsOptional()
  @IsIn(['EXACT', 'RANGE', 'FLEXIBLE', 'UNKNOWN'])
  datePrecision?: string;
  @IsOptional() @IsString() @MaxLength(240) dateFlexibility?: string | null;
  @IsInt() @Min(1) @Max(100) passengerCount!: number;
  @IsOptional()
  @ValidateNested()
  @Type(() => PassengerCompositionDto)
  passengerComposition?: PassengerCompositionDto;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requestedServices?: string[];
  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyDto)
  budget?: MoneyDto | null;
  @IsOptional() @IsString() @MaxLength(1000) specialPreferences?: string | null;
  @IsOptional() @Matches(/^[a-f0-9]{64}$/) contactFingerprint?: string | null;
  @IsOptional() @IsUUID() customerId?: string | null;
  @IsIn(PRIORITIES.slice(0, 4)) priority!: string;
  @IsOptional() @IsUUID() assigneeUserId?: string | null;
  @IsOptional() @IsString() @MaxLength(80) queueCode?: string | null;
  @IsString() @Length(3, 500) nextAction!: string;
  @IsISO8601({ strict: true }) nextActionAt!: string;
  @IsOptional() @IsInt() @Min(1) expectedVersion?: number;
}

export class TicketReferenceDto {
  @IsIn([
    'SALES_CONTRACT',
    'RESERVATION',
    'PASSENGER',
    'TICKET_DOCUMENT',
    'VOUCHER_DOCUMENT',
    'INVOICE',
    'PAYMENT',
    'OTHER',
  ])
  type!: string;
  @IsString() @Length(1, 160) id!: string;
  @IsOptional() @IsString() @MaxLength(240) label?: string;
}

export class TicketMutationDto {
  @IsString() @Length(3, 200) subject!: string;
  @IsString() @Length(3, 2000) description!: string;
  @IsIn(CHANNELS) channel!: string;
  @IsISO8601({ strict: true }) contactOccurredAt!: string;
  @IsString() @Length(2, 48) category!: string;
  @IsOptional() @IsString() @MaxLength(80) serviceType?: string | null;
  @IsIn(['LOW', 'NORMAL', 'HIGH']) impact!: string;
  @IsIn(['LOW', 'NORMAL', 'HIGH']) urgency!: string;
  @IsIn(PRIORITIES) priority!: string;
  @IsOptional() @IsUUID() customerId?: string | null;
  @IsOptional() @IsUUID() customerOwnerUserId?: string | null;
  @IsOptional() @IsUUID() executionOwnerUserId?: string | null;
  @IsOptional() @IsString() @MaxLength(80) executionUnit?: string | null;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TicketReferenceDto)
  references?: TicketReferenceDto[];
  @IsString() @Length(3, 500) nextAction!: string;
  @IsISO8601({ strict: true }) nextActionAt!: string;
  @IsOptional() @IsInt() @Min(1) expectedVersion?: number;
}

export class TimelineDto {
  @IsIn([
    'CALL',
    'MESSAGE',
    'MEETING',
    'NOTE',
    'CUSTOMER_REPLY',
    'ASSIGNMENT',
    'STATUS_CHANGE',
    'ESCALATION',
    'REFERRAL',
  ])
  type!: string;
  @IsOptional() @IsString() @MaxLength(80) outcome?: string | null;
  @IsString() @Length(2, 2000) summary!: string;
  @IsOptional() @IsBoolean() customerVisible?: boolean;
  @IsOptional() @IsString() @MaxLength(32) channel?: string | null;
  @IsOptional() @IsString() @MaxLength(160) recipientReference?: string | null;
  @IsOptional() @IsString() @MaxLength(80) templateVersion?: string | null;
  @IsOptional() @IsIn(['PENDING', 'DELIVERED', 'FAILED']) deliveryStatus?:
    string | null;
  @IsOptional() @IsString() @MaxLength(160) deliveryKey?: string | null;
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  documentVersionIds?: string[];
  @IsOptional() @IsISO8601({ strict: true }) occurredAt?: string;
}

export class LeadTransitionDto {
  @IsIn([
    'CONTACTED',
    'QUALIFYING',
    'NURTURE',
    'QUALIFIED',
    'HANDOFF_PROPOSED',
    'HANDED_OFF',
    'LOST',
  ])
  stage!: string;
  @IsString() @Length(3, 500) reason!: string;
  @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsString() @MaxLength(80) lostReason?: string;
}

export class QualificationDto {
  @IsBoolean() travelNeedConfirmed!: boolean;
  @IsBoolean() destinationKnown!: boolean;
  @IsBoolean() timingKnown!: boolean;
  @IsBoolean() budgetDiscussed!: boolean;
  @IsBoolean() decisionMakerReachable!: boolean;
  @IsBoolean() contactable!: boolean;
  @IsInt() @Min(1) expectedVersion!: number;
}

export class HandoffDto {
  @IsInt() @Min(1) expectedVersion!: number;
}
export class HandoffResponseDto {
  @IsIn(['ACCEPTED', 'RETURNED', 'REJECTED']) status!: string;
  @IsOptional() @IsUUID() salesContractId?: string | null;
  @IsString() @Length(3, 500) reason!: string;
}

export class ReferralDto {
  @IsString() @Length(2, 80) destinationModule!: string;
  @IsOptional() @IsString() @MaxLength(80) destinationUnit?: string | null;
  @IsOptional() @IsUUID() assignedUserId?: string | null;
  @IsString() @Length(3, 200) title!: string;
  @IsString() @Length(3, 1000) description!: string;
  @IsISO8601({ strict: true }) dueAt!: string;
}

export class ReferralResponseDto {
  @IsIn(['IN_PROGRESS', 'DONE', 'CANCELLED']) status!: string;
  @IsString() @Length(3, 1000) responseSummary!: string;
}

export class TicketActionDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @Length(3, 1000) reason!: string;
  @IsOptional() @IsString() @MaxLength(1000) resolutionOutcome?: string;
  @IsOptional() @IsString() @MaxLength(500) closeReason?: string;
  @IsOptional() @IsInt() @Min(1) @Max(3) level?: number;
}

export class TicketTransitionDto {
  @IsIn([
    'TRIAGED',
    'IN_PROGRESS',
    'WAITING_CUSTOMER',
    'WAITING_EXTERNAL',
    'CANCELLED',
  ])
  status!: string;
  @IsInt() @Min(1) expectedVersion!: number;
  @IsString() @Length(3, 1000) reason!: string;
}

export class SatisfactionDto {
  @IsInt() @Min(1) @Max(5) score!: number;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string | null;
}

export class ListQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() @MaxLength(48) status?: string;
  @IsOptional() @IsString() @MaxLength(48) stage?: string;
  @IsOptional() @IsString() @MaxLength(16) priority?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) overdueOnly?: boolean;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number;
}

export class CorrectiveActionDto {
  @IsIn(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED']) status!: string;
  @IsString() @IsNotEmpty() @MaxLength(1000) result!: string;
  @IsOptional() @IsString() @MaxLength(1000) effectivenessReview?: string;
  @IsInt() @Min(1) expectedVersion!: number;
}
