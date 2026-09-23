import { describe, expect, it } from 'vitest';

import { MarketingProcessService } from './marketing-process.service';

describe('MarketingProcessService', () => {
  it('publishes the ordered cross-module process without claiming missing infrastructure', () => {
    const result = new MarketingProcessService().process(
      new Date('2026-09-23T08:00:00.000Z'),
    );

    expect(result.generatedAt).toBe('2026-09-23T08:00:00.000Z');
    expect(result.persistenceStatus).toBe('INFRASTRUCTURE_PENDING');
    expect(result.stages.map((stage) => stage.key)).toEqual([
      'STRATEGY',
      'ACQUISITION',
      'SEGMENTATION',
      'CRM',
      'SALES',
      'TRAVEL_SERVICE',
      'LOYALTY',
      'ANALYTICS',
    ]);
    expect(
      result.stages
        .filter((stage) => stage.status === 'INFRASTRUCTURE_PENDING')
        .map((stage) => stage.key),
    ).toEqual(['STRATEGY', 'SEGMENTATION']);
    expect(
      result.stages
        .filter((stage) => stage.status === 'AVAILABLE')
        .every((stage) => stage.action.available),
    ).toBe(true);
  });

  it('does not expose customer contact fields or raw PII', () => {
    const serialized = JSON.stringify(new MarketingProcessService().process());

    expect(serialized).not.toMatch(/phone|email|mobile|nationalId|passport/i);
  });
});
