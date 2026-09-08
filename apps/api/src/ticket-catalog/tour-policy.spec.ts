import { describe, expect, it } from 'vitest';
import { validateTourDeparture, validateTourPackage } from './tour-policy';
const id = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';
const pack = {
  name: 'تور آزمایشی',
  originId: id,
  destinationId: second,
  hotelIds: [],
  transferOutbound: true,
  transferReturn: true,
  visa: false,
};
const departure = {
  packageId: id,
  packageVersion: 1,
  startsOn: '2099-10-01',
  endsOn: '2099-10-08',
  outboundOfferId: id,
  returnOfferId: second,
};
describe('tour inputs', () => {
  it('accepts registered reference IDs without inventing capacity', () => {
    expect(validateTourPackage(pack)).toEqual(pack);
    expect(validateTourDeparture(departure)).toEqual(departure);
  });
  it.each([
    { originId: second },
    { hotelIds: [id, id] },
    { hotelIds: ['not-an-id'] },
    { capacity: 30 },
    { transferOutbound: 'yes' },
    { name: '' },
  ])('rejects invalid package %j', (patch) => {
    expect(() => validateTourPackage({ ...pack, ...patch })).toThrow();
  });
  it.each([
    { startsOn: '2099-02-30' },
    { endsOn: '2099-09-30' },
    { startsOn: '2001-01-01' },
    { returnOfferId: id },
    { packageVersion: 0 },
    { capacity: 40 },
  ])('rejects invalid departure %j', (patch) => {
    expect(() => validateTourDeparture({ ...departure, ...patch })).toThrow();
  });
});
