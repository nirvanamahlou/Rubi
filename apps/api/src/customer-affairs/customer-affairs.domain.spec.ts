import { describe, expect, it } from 'vitest';

import {
  customerAffairsPermissionMatrix,
  hasCustomerAffairsPermission,
  type LeadDraft,
  type SupportTicketDraft,
} from './customer-affairs.contracts';
import {
  calculateSLAState,
  canTransitionLead,
  canTransitionTicket,
  evaluateQualification,
  isFollowUpOverdue,
  leadAgeDays,
  validateLeadDraft,
  validateSupportTicketDraft,
} from './customer-affairs.domain';

const leadDraft: LeadDraft = {
  title: 'درخواست نمایشی سفر خانوادگی',
  sourceReference: 'preview-source-referral',
  inboundChannel: 'REFERRAL',
  travelNeed: 'برنامه سفر تفریحی نمایشی',
  destinationReference: 'preview-destination-01',
  approximateTravelStart: '2026-09-10T00:00:00.000Z',
  approximateTravelEnd: '2026-09-15T00:00:00.000Z',
  passengerCount: 3,
  initialBudget: { amount: '250000000', currencyCode: 'IRR' },
  priority: 'NORMAL',
  assigneeReference: 'preview-assignee-01',
  nextActionAt: '2026-08-25T08:30:00.000Z',
};

const ticketDraft: SupportTicketDraft = {
  subject: 'پیگیری نمایشی واچر هتل',
  category: 'HOTEL_VOUCHER',
  priority: 'HIGH',
  assigneeReference: 'preview-assignee-02',
  customerReference: null,
  salesReference: null,
  internalNote: 'یادداشت داخلی کاملاً ساختگی',
  customerReplyDraft: 'پاسخ نمایشی؛ ارسال نخواهد شد.',
};

describe('customer affairs phase A domain', () => {
  it('validates lead and ticket drafts without persistence', () => {
    expect(validateLeadDraft(leadDraft)).toEqual({ valid: true, errors: {} });
    expect(validateSupportTicketDraft(ticketDraft)).toEqual({
      valid: true,
      errors: {},
    });
    expect(
      validateLeadDraft({
        ...leadDraft,
        passengerCount: 0,
        initialBudget: { amount: '-10', currencyCode: 'irr' },
      }).valid,
    ).toBe(false);
  });

  it('allows only explicit lead stage transitions', () => {
    expect(canTransitionLead('NEW', 'CONTACTED')).toBe(true);
    expect(canTransitionLead('NEW', 'HANDED_OFF')).toBe(false);
    expect(canTransitionLead('QUALIFIED', 'HANDOFF_PROPOSED')).toBe(true);
    expect(canTransitionLead('HANDED_OFF', 'NEW')).toBe(false);
  });

  it('calculates qualification deterministically', () => {
    const result = evaluateQualification(
      {
        travelNeedConfirmed: true,
        destinationKnown: true,
        timingKnown: true,
        budgetDiscussed: true,
        decisionMakerReachable: false,
        contactable: true,
      },
      '2026-08-24T08:00:00.000Z',
    );
    expect(result.state).toBe('QUALIFIED');
    expect(result.score).toBe(85);
  });

  it('flags overdue follow-up and calculates non-negative lead aging', () => {
    expect(
      isFollowUpOverdue({
        nextActionAt: '2026-08-23T08:00:00.000Z',
        completed: false,
        now: '2026-08-24T08:00:00.000Z',
      }),
    ).toBe(true);
    expect(
      isFollowUpOverdue({
        nextActionAt: '2026-08-23T08:00:00.000Z',
        completed: true,
        now: '2026-08-24T08:00:00.000Z',
      }),
    ).toBe(false);
    expect(
      leadAgeDays('2026-08-20T08:00:00.000Z', '2026-08-24T08:00:00.000Z'),
    ).toBe(4);
  });

  it('allows only explicit ticket lifecycle transitions', () => {
    expect(canTransitionTicket('NEW', 'TRIAGED')).toBe(true);
    expect(canTransitionTicket('NEW', 'CLOSED')).toBe(false);
    expect(canTransitionTicket('RESOLVED', 'CLOSED')).toBe(true);
    expect(canTransitionTicket('CLOSED', 'REOPENED')).toBe(true);
  });

  it('calculates on-track, at-risk, breached, paused and met SLA states', () => {
    const base = {
      now: '2026-08-24T08:00:00.000Z',
      firstResponseDueAt: '2026-08-24T14:00:00.000Z',
      resolutionDueAt: '2026-08-25T08:00:00.000Z',
      firstRespondedAt: null,
      resolvedAt: null,
      paused: false,
    };
    expect(calculateSLAState(base)).toBe('ON_TRACK');
    expect(
      calculateSLAState({
        ...base,
        now: '2026-08-24T13:50:00.000Z',
      }),
    ).toBe('AT_RISK');
    expect(
      calculateSLAState({
        ...base,
        now: '2026-08-24T14:01:00.000Z',
      }),
    ).toBe('BREACHED');
    expect(calculateSLAState({ ...base, paused: true })).toBe('PAUSED');
    expect(
      calculateSLAState({
        ...base,
        firstRespondedAt: '2026-08-24T09:00:00.000Z',
        resolvedAt: '2026-08-24T18:00:00.000Z',
      }),
    ).toBe('MET');
  });

  it('uses an exact deny-by-default permission matrix', () => {
    const leadReadPermission = customerAffairsPermissionMatrix['lead.read'];
    const satisfactionReadPermission =
      customerAffairsPermissionMatrix['satisfaction.read'];
    const satisfactionRecordPermission =
      customerAffairsPermissionMatrix['satisfaction.record'];

    expect(hasCustomerAffairsPermission([], 'lead.read')).toBe(false);
    expect(
      hasCustomerAffairsPermission([leadReadPermission], 'lead.read'),
    ).toBe(true);
    expect(
      hasCustomerAffairsPermission([leadReadPermission], 'lead.update'),
    ).toBe(false);

    expect(hasCustomerAffairsPermission([], 'satisfaction.read')).toBe(false);
    expect(hasCustomerAffairsPermission([], 'satisfaction.record')).toBe(false);
    expect(
      hasCustomerAffairsPermission(
        [satisfactionReadPermission],
        'satisfaction.record',
      ),
    ).toBe(false);
    expect(
      hasCustomerAffairsPermission(
        [satisfactionRecordPermission],
        'satisfaction.read',
      ),
    ).toBe(false);
    expect(
      hasCustomerAffairsPermission(
        [satisfactionReadPermission],
        'satisfaction.read',
      ),
    ).toBe(true);
    expect(
      hasCustomerAffairsPermission(
        [satisfactionRecordPermission],
        'satisfaction.record',
      ),
    ).toBe(true);

    expect(Object.values(customerAffairsPermissionMatrix)).toEqual([
      'customer_affairs.lead.read',
      'customer_affairs.lead.create',
      'customer_affairs.lead.update',
      'customer_affairs.lead.qualify',
      'customer_affairs.lead.handoff.propose',
      'customer_affairs.ticket.read',
      'customer_affairs.ticket.create',
      'customer_affairs.ticket.update',
      'customer_affairs.ticket.assign',
      'customer_affairs.ticket.escalate',
      'customer_affairs.ticket.close',
      'customer_affairs.sla.manage',
      'customer_affairs.satisfaction.read',
      'customer_affairs.satisfaction.record',
    ]);
  });
});
