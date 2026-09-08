import { describe, expect, it } from 'vitest';
import type { TourDepartureV1 } from '@rubi/contracts';
import { emptySalesForm, salesPayload } from './sales-form';

describe('tour provenance in Sales', () => {
  it('keeps one versioned public reference without adding a second tour price row', () => {
    const tour = {
      id: 'tour-id',
      version: 1,
      package: { name: 'Synthetic tour' },
    } as TourDepartureV1;
    const result = salesPayload({
      ...emptySalesForm,
      tour,
      departureDate: '2099-10-01',
      serviceKinds: ['FLIGHT'],
      serviceDirections: { FLIGHT: ['OUTBOUND'] },
    });
    expect(result.services).toHaveLength(1);
    expect(result.services[0]!.metadata).toMatchObject({
      tourDepartureId: 'tour-id',
      tourDepartureVersion: 1,
      tourName: 'Synthetic tour',
    });
    expect(result.services.some((service) => service.kind === 'TOUR')).toBe(
      false,
    );
  });
});
