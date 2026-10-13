import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  createIntegrationProposal,
  CUSTOMER_AFFAIRS_INTEGRATION_CONTRACT_VERSION,
  type LeadQualified,
} from './customer-affairs.integration-contracts';

describe('customer affairs module-local integration proposals', () => {
  it('creates versioned non-persisted mappings without publishing an event', () => {
    const proposal = createIntegrationProposal<LeadQualified>({
      eventId: 'preview-event-001',
      eventType: 'LeadQualified',
      occurredAt: '2026-08-24T10:00:00.000Z',
      traceId: 'preview-trace-001',
      actorReference: 'preview-actor-001',
      aggregateId: 'preview-lead-001',
      payload: {
        leadId: 'preview-lead-001',
        customerReference: null,
        priority: 'HIGH',
        qualificationScore: 85,
        destinationReference: 'preview-destination-001',
      },
    });

    expect(CUSTOMER_AFFAIRS_INTEGRATION_CONTRACT_VERSION).toBe(
      'customer-affairs.integration.v1-proposal',
    );
    expect(proposal).toMatchObject({
      eventType: 'LeadQualified',
      version: 1,
      persisted: false,
    });
    expect(proposal.payload).not.toHaveProperty('phone');
    expect(proposal.payload).not.toHaveProperty('email');
  });

  it('defines every required future integration boundary by exact name', async () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src',
        'customer-affairs',
        'customer-affairs.integration-contracts.ts',
      ),
      'utf8',
    );
    for (const name of [
      'LeadQualified',
      'SalesHandoffRequested',
      'CustomerSupportTicketOpened',
      'ReservationIssueReported',
      'RefundAssistanceRequested',
      'CustomerSatisfactionRecorded',
    ]) {
      expect(source).toContain(name);
    }
    expect(source).not.toMatch(/publish|emit|EventEmitter|outbox/i);
  });
});
