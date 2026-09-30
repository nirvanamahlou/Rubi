import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { LeadMutationDto, TicketMutationDto } from './customer-affairs.dto';

const lead = {
  title: 'سفر خانوادگی شیراز',
  sourceReference: 'manual:test-1',
  inboundChannel: 'PHONE',
  contactOccurredAt: '2026-09-28T08:00:00.000Z',
  travelNeed: 'پرواز و هتل برای دو نفر',
  passengerCount: 2,
  priority: 'NORMAL',
  nextAction: 'تماس برای تکمیل اطلاعات',
  nextActionAt: '2026-09-29T08:00:00.000Z',
};

const ticket = {
  subject: 'پیگیری تغییر تاریخ سفر',
  description: 'مشتری خواستار بررسی تاریخ جدید است.',
  channel: 'PHONE',
  contactOccurredAt: '2026-09-28T08:00:00.000Z',
  category: 'DATE_CHANGE',
  impact: 'LOW',
  urgency: 'NORMAL',
  priority: 'NORMAL',
  nextAction: 'استعلام وضعیت از رزرواسیون',
  nextActionAt: '2026-09-29T08:00:00.000Z',
};

function invalidFields<T extends object>(type: new () => T, input: object) {
  return validateSync(plainToInstance(type, input)).map(
    (error) => error.property,
  );
}

describe('customer affairs creation DTO edge cases', () => {
  it('accepts a valid minimal travel request', () => {
    expect(invalidFields(LeadMutationDto, lead)).toEqual([]);
  });

  it('rejects invalid passenger count, channel, priority and date', () => {
    expect(
      invalidFields(LeadMutationDto, {
        ...lead,
        passengerCount: 0,
        inboundChannel: 'UNKNOWN',
        priority: 'CRITICAL',
        contactOccurredAt: 'yesterday',
      }),
    ).toEqual(
      expect.arrayContaining([
        'passengerCount',
        'inboundChannel',
        'priority',
        'contactOccurredAt',
      ]),
    );
  });

  it('rejects malformed nested budget and composition', () => {
    expect(
      invalidFields(LeadMutationDto, {
        ...lead,
        budget: { maximum: '-1', currencyCode: 'rial' },
        passengerComposition: { adults: -1, children: 0, infants: 0 },
      }),
    ).toEqual(expect.arrayContaining(['budget', 'passengerComposition']));
  });

  it('accepts a valid minimal support ticket', () => {
    expect(invalidFields(TicketMutationDto, ticket)).toEqual([]);
  });

  it('rejects malformed ticket fields and long description', () => {
    expect(
      invalidFields(TicketMutationDto, {
        ...ticket,
        subject: 'a',
        description: 'x'.repeat(2001),
        urgency: 'IMMEDIATE',
        priority: 'UNSET',
      }),
    ).toEqual(
      expect.arrayContaining(['subject', 'description', 'urgency', 'priority']),
    );
  });

  it('rejects malformed customer IDs and linked references', () => {
    expect(
      invalidFields(TicketMutationDto, {
        ...ticket,
        customerId: 'not-a-uuid',
        references: [{ type: 'INVALID', id: '' }],
      }),
    ).toEqual(expect.arrayContaining(['customerId', 'references']));
  });
});
