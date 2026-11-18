import { expect, it } from 'vitest';
import type { TicketOfferV1, TourDepartureV1 } from '@nora/contracts';
import {
  publishableTickets,
  publishableTours,
  websiteDestinations,
} from './site-publication-model';
it('lists the configured destination codes', () => {
  expect(websiteDestinations.map((s) => s.code)).toEqual([
    'nss',
    'jahan-bastan',
    'ghestiroo',
    'jahan-academy',
  ]);
});
it('only shows published, nondeleted tours within the selected branch', () => {
  const rows = [
    { id: 'yes', branchId: 'a', package: {} },
    { id: 'draft', branchId: 'a', package: { publicationStatus: 'DRAFT' } },
    { id: 'other', branchId: 'b', package: {} },
    { id: 'deleted', branchId: 'a', isDeleted: true, package: {} },
  ] as unknown as TourDepartureV1[];
  expect(publishableTours(rows, 'a').map((r) => r.id)).toEqual(['yes']);
});
it('only shows active priced tickets and accepts paired fares', () => {
  const rows = [
    {
      id: 'single',
      branchId: 'a',
      status: 'ACTIVE',
      standaloneSalePrice: { amount: '10' },
    },
    {
      id: 'pair',
      branchId: 'a',
      status: 'ACTIVE',
      roundTripSalePrices: [{ amount: '20' }],
    },
    {
      id: 'zero',
      branchId: 'a',
      status: 'ACTIVE',
      standaloneSalePrice: { amount: '0' },
    },
    { id: 'unpriced', branchId: 'a', status: 'ACTIVE' },
    {
      id: 'paused',
      branchId: 'a',
      status: 'PAUSED',
      standaloneSalePrice: { amount: '1' },
    },
    {
      id: 'other',
      branchId: 'b',
      status: 'ACTIVE',
      standaloneSalePrice: { amount: '1' },
    },
  ] as unknown as TicketOfferV1[];
  expect(publishableTickets(rows, 'a').map((r) => r.id)).toEqual([
    'single',
    'pair',
  ]);
});
