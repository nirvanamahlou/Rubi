import { describe, expect, it } from 'vitest';
import type { MasterDataRecord } from '@nora/contracts';
import { defaultTourAirport, tourAirports } from './tour-airports';
const cities = [
  { id: 'a', attributes: { countryId: 'one' } },
  { id: 'b', attributes: { countryId: 'one' } },
  { id: 'c', attributes: { countryId: 'two' } },
] as MasterDataRecord[];
const airports = [
  {
    id: 'other-city',
    name: 'Other',
    attributes: { cityId: 'b', iataCode: 'BBB' },
  },
  { id: 'local', name: 'Local', attributes: { cityId: 'a', iataCode: 'AAA' } },
  {
    id: 'foreign',
    name: 'Foreign',
    attributes: { cityId: 'c', iataCode: 'CCC' },
  },
  { id: 'no-code', name: 'No code', attributes: { cityId: 'a' } },
] as MasterDataRecord[];
describe('tour airport selection', () => {
  it('defaults to the city airport rather than the first airport of the country', () => {
    expect(defaultTourAirport('a', airports)).toBe('AAA');
    expect(tourAirports('a', cities, airports).map((row) => row.id)).toEqual([
      'local',
      'other-city',
    ]);
  });
  it('changes country with the selected city and clears unknown or empty defaults', () => {
    expect(defaultTourAirport('c', airports)).toBe('CCC');
    expect(tourAirports('c', cities, airports).map((row) => row.id)).toEqual([
      'foreign',
    ]);
    expect(defaultTourAirport('unknown', airports)).toBeUndefined();
    expect(tourAirports('', cities, airports)).toEqual([]);
    expect(tourAirports('unknown', cities, airports)).toEqual([]);
  });
});
