import { beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { MasterDataRecord, MasterDataResource } from '@nora/contracts';
const api = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  request: vi.fn(),
  directory: vi.fn(),
}));
vi.mock('@/modules/master-data/api/client', () => ({ masterDataApi: api }));
vi.mock('./controls', () => ({ rateRequest: api.request }));
vi.mock('./existing-packs-model', async (original) => ({
  ...(await original<object>()),
  loadPackDirectory: api.directory,
}));
import {
  allImportReferences,
  registerOccupancyBatch,
} from './occupancy-bulk-register';
import type { ImportedOccupancy } from './occupancy-import';
const record = (
  resource: MasterDataResource,
  name: string,
  attributes = {},
): MasterDataRecord => ({
  id: `${resource}-${name}`,
  resource,
  name,
  code: 'CODE',
  version: 7,
  status: 'active',
  attributes,
  createdAt: '',
  updatedAt: '',
});
const rate: ImportedOccupancy = {
  hotel: 'HOTEL',
  room: 'STANDARD',
  capacity: '',
  sourceRow: 2,
  adults: 2,
  childAges: [],
  startsOn: '2026-10-01',
  endsOnExclusive: '2026-11-01',
  currencyCode: 'EUR',
  amount: '123.4567',
  composition: 'DBL',
  board: 'BB',
};
const input = () => ({
  rows: [rate],
  branchId: 'branch',
  cityId: 'city',
  countryId: 'country',
  actorId: 'actor',
  brokerName: 'کارگزار آنتالیا ۱',
  createBroker: true,
  permissions: ['master_data.read', 'master_data.create', 'master_data.update'],
  onProgress: vi.fn(),
  onSaved: vi.fn(),
});
beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
  api.list.mockResolvedValue({ data: [], meta: { total: 0 } });
  api.detail.mockResolvedValue({
    data: record('cities', 'CITY', { countryId: 'country' }),
  });
  api.create.mockImplementation(async (resource: MasterDataResource, body) => ({
    data: record(
      resource,
      body.values.name ?? body.values.legalName,
      body.values,
    ),
  }));
  api.request.mockResolvedValue({ id: 'pack', version: 1 });
  api.directory.mockResolvedValue([]);
});
it('creates missing references through owner public APIs, then persists actual dated packs', async () => {
  const options = input();
  expect(await registerOccupancyBatch(options)).toMatchObject({
    packs: 1,
    prices: 1,
    hotels: 1,
  });
  expect(api.create).toHaveBeenCalledWith('organizations', {
    values: { legalName: options.brokerName, roleCodes: ['BROKER'] },
  });
  expect(api.create).toHaveBeenCalledWith('room-types', {
    values: { name: 'STANDARD', referenceCapacity: 2 },
  });
  expect(api.create).toHaveBeenCalledWith('hotels', {
    values: {
      name: 'HOTEL',
      cityId: 'city',
      isSaleableReference: 'true',
      roomTypeIds: ['room-types-STANDARD'],
    },
  });
  // Consumer payload must match the actual producer allowlist, not a permissive mock.
  const producer = readFileSync(
    new URL(
      '../../../../../api/src/master-data/master-data.service.ts',
      import.meta.url,
    ),
    'utf8',
  );
  for (const [resource, payload] of api.create.mock.calls) {
    const fieldBlock = producer.match(
      new RegExp(`(?:'${resource}'|${resource}): \\[([\\s\\S]*?)\\]`),
    )?.[1];
    expect(fieldBlock).toBeDefined();
    const allowed = [...fieldBlock!.matchAll(/'([^']+)'/g)].map(
      (match) => match[1],
    );
    expect(
      Object.keys(payload.values).every((key) => allowed.includes(key)),
    ).toBe(true);
  }
  const [path, init] = api.request.mock.calls[0]!;
  expect(path).toBe('/packs');
  expect(JSON.parse(init.body)).toMatchObject({
    cityId: 'city',
    checkIn: rate.startsOn,
    checkOut: rate.endsOnExclusive,
    rows: [
      {
        roomRates: [
          { occupancyRates: [expect.objectContaining({ amount: '123.4567' })] },
        ],
      },
    ],
  });
  expect(options.onSaved).toHaveBeenCalledOnce();
});
it('fails destination/permission/supplier preflight without any mutation', async () => {
  await expect(
    registerOccupancyBatch({ ...input(), countryId: 'wrong' }),
  ).rejects.toThrow('کشور');
  await expect(
    registerOccupancyBatch({ ...input(), createBroker: false }),
  ).rejects.toThrow('تأیید');
  await expect(
    registerOccupancyBatch({ ...input(), permissions: ['master_data.read'] }),
  ).rejects.toThrow('ایجاد');
  expect(api.create).not.toHaveBeenCalled();
  expect(api.request).not.toHaveBeenCalled();
});
it('preserves existing room links and uses the existing hotel version guard', async () => {
  const hotel = record('hotels', 'HOTEL', {
    cityId: 'city',
    isSaleableReference: true,
    roomTypeIds: 'old-room',
  });
  const room = record('room-types', 'STANDARD');
  const broker = record('organizations', input().brokerName, {
    roleCodes: 'BROKER',
  });
  api.list.mockImplementation(async (resource: MasterDataResource) => ({
    data:
      resource === 'hotels'
        ? [hotel]
        : resource === 'room-types'
          ? [room]
          : [broker],
    meta: { total: 1 },
  }));
  api.detail.mockImplementation(async (resource: MasterDataResource) => ({
    data:
      resource === 'cities'
        ? record('cities', 'CITY', { countryId: 'country' })
        : hotel,
  }));
  api.update.mockResolvedValue({ data: hotel });
  await registerOccupancyBatch(input());
  expect(api.create).not.toHaveBeenCalled();
  expect(api.update).toHaveBeenCalledWith('hotels', hotel.id, {
    version: 7,
    values: { roomTypeIds: ['old-room', room.id] },
  });
});
it('reports partial success and uses the same accepted/uncertain pack keys on retry', async () => {
  const hotel = record('hotels', 'HOTEL', {
    cityId: 'city',
    isSaleableReference: true,
    roomTypeIds: 'room-types-STANDARD',
  });
  const room = record('room-types', 'STANDARD');
  const broker = record('organizations', input().brokerName, {
    roleCodes: 'BROKER',
  });
  api.list.mockImplementation(async (resource: MasterDataResource) => ({
    data:
      resource === 'hotels'
        ? [hotel]
        : resource === 'room-types'
          ? [room]
          : [broker],
    meta: { total: 1 },
  }));
  api.detail.mockImplementation(async (resource: MasterDataResource) => ({
    data:
      resource === 'cities'
        ? record('cities', 'CITY', { countryId: 'country' })
        : hotel,
  }));
  const options = {
    ...input(),
    rows: [
      rate,
      { ...rate, startsOn: '2026-11-01', endsOnExclusive: '2026-12-01' },
    ],
  };
  api.request
    .mockResolvedValueOnce({ id: 'one' })
    .mockRejectedValueOnce(Error('offline'));
  await expect(registerOccupancyBatch(options)).rejects.toThrow('1 از 2');
  expect(options.onSaved).toHaveBeenCalledOnce();
  const keys = api.request.mock.calls.map(
    ([, init]) => init.headers['idempotency-key'],
  );
  api.request.mockResolvedValue({ id: 'replayed' });
  await registerOccupancyBatch(options);
  expect(
    api.request.mock.calls
      .slice(2)
      .map(([, init]) => init.headers['idempotency-key']),
  ).toEqual(keys);
  expect(api.create).not.toHaveBeenCalled();
});
it('rejects incomplete/changing directory pagination', async () => {
  api.list
    .mockResolvedValueOnce({
      data: [record('room-types', 'A')],
      meta: { total: 2 },
    })
    .mockResolvedValueOnce({ data: [], meta: { total: 3 } });
  await expect(allImportReferences('room-types')).rejects.toThrow('تغییر');
});
it('reuploads changed prices with PATCH to the persisted pack, not another POST', async () => {
  await registerOccupancyBatch(input());
  const previous = JSON.parse(api.request.mock.calls[0]![1].body);
  const hotel = record('hotels', 'HOTEL', {
    cityId: 'city',
    isSaleableReference: true,
    roomTypeIds: 'room-types-STANDARD',
  });
  const room = record('room-types', 'STANDARD');
  const broker = record('organizations', input().brokerName, {
    roleCodes: 'BROKER',
  });
  api.list.mockImplementation(async (resource: MasterDataResource) => ({
    data:
      resource === 'hotels'
        ? [hotel]
        : resource === 'room-types'
          ? [room]
          : [broker],
    meta: { total: 1 },
  }));
  api.detail.mockImplementation(async (resource: MasterDataResource) => ({
    data:
      resource === 'cities'
        ? record('cities', 'CITY', { countryId: 'country' })
        : hotel,
  }));
  const saved = {
    ...previous,
    id: 'persisted',
    version: 1,
    batchId: 'batch',
    cityName: 'CITY',
    rows: previous.rows.map((row: { roomRates: object[] }) => ({
      ...row,
      hotelName: 'HOTEL',
      brokerName: 'BROKER',
      roomRates: row.roomRates.map((r) => ({
        ...r,
        maxChildren: 0,
        roomTypeName: 'STANDARD',
      })),
    })),
  };
  api.directory.mockResolvedValue([saved]);
  api.create.mockClear();
  api.request.mockClear();
  api.request.mockImplementation(async (_path, init) =>
    init ? { id: 'persisted', version: 2 } : saved,
  );
  const result = await registerOccupancyBatch({
    ...input(),
    rows: [{ ...rate, amount: '777.1234' }],
  });
  const writes = api.request.mock.calls.filter(([, init]) => init);
  expect(writes).toHaveLength(1);
  expect(writes[0]![0]).toBe('/packs/persisted');
  expect(writes[0]![1].method).toBe('PATCH');
  expect(JSON.parse(writes[0]![1].body)).toMatchObject({
    expectedVersion: 1,
    rows: [{ roomRates: [{ occupancyRates: [{ amount: '777.1234' }] }] }],
  });
  expect(result).toMatchObject({ created: 0, updated: 1 });
  expect(api.create).not.toHaveBeenCalled();
});
