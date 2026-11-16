import { beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { AuthenticatedActor, FloatingTourSaleSet } from '@nora/contracts';
import { FloatingTourPricingService } from './floating-tour-pricing.service';
vi.mock('../database/database.service', () => ({ DatabaseService: class {} }));
vi.mock('../master-data/master-travel-directory', () => ({
  MasterTravelDirectory: class {},
}));
vi.mock('./package-tour-pricing.service', () => ({
  PackageTourPricingService: class {},
}));
const actor = {
  userId: 'user',
  branchIds: ['branch'],
  permissions: ['package_pricing.read', 'package_pricing.period.manage'],
} as unknown as AuthenticatedActor;
const definition = {
  name: 'Floating',
  originId: 'origin',
  destinationId: 'city',
  details: { version: 1, isFloating: true },
  hotelIds: [],
  transferOutbound: false,
  transferReturn: false,
  visa: false,
};
// Match the browser payload: dated imports send an empty monthly selection.
const options = {
  nights: 7,
  mode: 'DATED',
  calendar: 'PERSIAN',
  months: [],
  combined: false,
};
const files = unzipSync(
  readFileSync('../web/public/templates/floating-tour-price.xlsx'),
);
function workbook(date = '2026-08-01', hotel = 'Hotel One', price = '€300') {
  const data = [
    date,
    hotel,
    '',
    'Standard',
    'UALL',
    price,
    '',
    '',
    '',
    '',
    '50000000',
    '',
    '',
  ];
  const row =
    '<row r="2">' +
    data
      .map(
        (v, i) =>
          `<c r="${String.fromCharCode(65 + i)}2" t="inlineStr"><is><t>${v}</t></is></c>`,
      )
      .join('') +
    '</row>';
  return zipSync({
    ...files,
    'xl/worksheets/sheet1.xml': strToU8(
      strFromU8(files['xl/worksheets/sheet1.xml']!).replace(
        '</sheetData>',
        row + '</sheetData>',
      ),
    ),
  });
}
function fixture() {
  let state: { version: number; payload: FloatingTourSaleSet } | null = null;
  const imports: unknown[] = [];
  const client = {
    tourPackage: {
      findFirst: vi.fn(
        async ({ where }: { where: { branchId?: { in: string[] } } }) =>
          where.branchId?.in.includes('branch')
            ? { id: 'tour', branchId: 'branch', version: 1, definition }
            : null,
      ),
      findMany: vi.fn(async () => [
        { id: 'tour', branchId: 'branch', version: 1, definition },
      ]),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    floatingTourSaleCatalog: {
      findUnique: vi.fn(async () => state),
      create: vi.fn(
        async ({
          data,
        }: {
          data: { version: number; payload: FloatingTourSaleSet };
        }) => {
          state = { version: data.version, payload: data.payload };
          return state;
        },
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { version: number };
          data: { version: number; payload: FloatingTourSaleSet };
        }) => {
          if (state?.version !== where.version) return { count: 0 };
          state = { version: data.version, payload: data.payload };
          return { count: 1 };
        },
      ),
    },
    floatingTourSaleImport: {
      create: vi.fn(async ({ data }: { data: unknown }) => {
        imports.push(data);
        return data;
      }),
    },
  };
  const db = {
    client,
    $transaction: async <T>(fn: (tx: typeof client) => Promise<T>) => {
      const before = structuredClone(state);
      try {
        return await fn(client);
      } catch (e) {
        state = before;
        throw e;
      }
    },
  };
  Object.assign(client, { $transaction: db.$transaction });
  const directory = {
    hotelRatePackChoices: vi.fn(async () => ({
      data: [
        { id: 'h1', name: 'Hotel One', englishName: 'Hotel One' },
        { id: 'h2', name: 'Hotel Two', englishName: 'Hotel Two' },
      ],
      meta: { total: 2 },
    })),
  };
  const pricing = {
    buyRates: vi.fn(async () => ({ IRR: '1', EUR: '600000' })),
  };
  const service = new FloatingTourPricingService(
    db as never,
    directory as never,
    pricing as never,
  );
  return { service, client, pricing, imports, getState: () => state };
}
beforeEach(() => vi.clearAllMocks());
it('downloads a blank template using native read and branch scope without writing prices', async () => {
  const f = fixture();
  const bytes = await f.service.template('tour', {
    ...actor,
    permissions: ['package_pricing.read'],
  });
  expect(unzipSync(bytes)['xl/workbook.xml']).toBeDefined();
  expect(f.client.floatingTourSaleCatalog.create).not.toHaveBeenCalled();
  await expect(
    f.service.template('tour', { ...actor, permissions: [] }),
  ).rejects.toThrow();
  await expect(
    f.service.template('tour', { ...actor, branchIds: ['other'] }),
  ).rejects.toThrow();
});
it('preview does not mutate data; commit stores sales-only data and an immutable import audit', async () => {
  const f = fixture(),
    bytes = workbook();
  const p = await f.service.preview('tour', bytes, options, actor);
  expect(f.getState()).toBeNull();
  expect(f.client.floatingTourSaleCatalog.create).not.toHaveBeenCalled();
  const result = await f.service.commit(
    'tour',
    bytes,
    options,
    p.expectedVersion,
    p.digest,
    actor,
  );
  expect(result.version).toBe(1);
  expect(result.dated[0]?.prices.double?.[0]?.amount).toBe('300');
  expect(f.imports).toHaveLength(1);
});
it('reimport replaces only touched date and nights while retaining all other periods', async () => {
  const f = fixture();
  for (const date of ['2026-08-01', '2026-08-10']) {
    const bytes = workbook(date);
    const p = await f.service.preview('tour', bytes, options, actor);
    await f.service.commit(
      'tour',
      bytes,
      options,
      p.expectedVersion,
      p.digest,
      actor,
    );
  }
  const bytes = workbook('2026-08-01', 'Hotel Two', '€250'),
    p = await f.service.preview('tour', bytes, options, actor);
  const result = await f.service.commit(
    'tour',
    bytes,
    options,
    p.expectedVersion,
    p.digest,
    actor,
  );
  expect(result.dated).toHaveLength(2);
  expect(
    result.dated.find((r) => r.startsOn === '2026-08-01')?.stays[0]?.hotelId,
  ).toBe('h2');
  expect(
    result.dated.find((r) => r.startsOn === '2026-08-10')?.stays[0]?.hotelId,
  ).toBe('h1');
});
it('monthly import replaces only the monthly set without inventing a year', async () => {
  const f = fixture(),
    bytes = workbook();
  const p = await f.service.preview('tour', bytes, options, actor);
  await f.service.commit(
    'tour',
    bytes,
    options,
    p.expectedVersion,
    p.digest,
    actor,
  );
  for (const months of [[8, 9], [10]]) {
    const input = { ...options, mode: 'MONTHLY', calendar: 'PERSIAN', months };
    const next = await f.service.preview('tour', bytes, input, actor);
    await f.service.commit(
      'tour',
      bytes,
      input,
      next.expectedVersion,
      next.digest,
      actor,
    );
  }
  const current = await f.service.get('tour', actor);
  expect(current.dated).toHaveLength(1);
  expect(current.monthly?.months).toEqual([10]);
  expect(current.monthly?.rows[0]?.startsOn).toBeNull();
  expect(current.monthly).not.toHaveProperty('year');
});
it('rejects unauthorized branches, missing permissions and stale previews or changed FX', async () => {
  const f = fixture(),
    bytes = workbook();
  await expect(
    f.service.preview('tour', bytes, options, { ...actor, permissions: [] }),
  ).rejects.toThrow();
  await expect(
    f.service.get('tour', { ...actor, branchIds: ['other'] }),
  ).rejects.toThrow();
  const p = await f.service.preview('tour', bytes, options, actor);
  f.pricing.buyRates.mockResolvedValue({ IRR: '1', EUR: '700000' });
  await expect(
    f.service.commit(
      'tour',
      bytes,
      options,
      p.expectedVersion,
      p.digest,
      actor,
    ),
  ).rejects.toThrow();
  expect(f.getState()).toBeNull();
  f.pricing.buyRates.mockResolvedValue({ IRR: '1', EUR: '600000' });
  await f.service.commit(
    'tour',
    bytes,
    options,
    p.expectedVersion,
    p.digest,
    actor,
  );
  await expect(
    f.service.commit(
      'tour',
      bytes,
      options,
      p.expectedVersion,
      p.digest,
      actor,
    ),
  ).rejects.toThrow();
  expect(f.imports).toHaveLength(1);
});
it('rolls back the current catalog when audit storage fails', async () => {
  const f = fixture(),
    bytes = workbook(),
    p = await f.service.preview('tour', bytes, options, actor);
  f.client.floatingTourSaleImport.create.mockRejectedValueOnce(
    new Error('audit unavailable'),
  );
  await expect(
    f.service.commit(
      'tour',
      bytes,
      options,
      p.expectedVersion,
      p.digest,
      actor,
    ),
  ).rejects.toThrow();
  expect(f.getState()).toBeNull();
});

it('rejects final confirmation when the tour definition changes before the transaction lock', async () => {
  const f = fixture(),
    bytes = workbook(),
    p = await f.service.preview('tour', bytes, options, actor);
  f.client.tourPackage.updateMany.mockResolvedValueOnce({ count: 0 });
  await expect(
    f.service.commit(
      'tour',
      bytes,
      options,
      p.expectedVersion,
      p.digest,
      actor,
    ),
  ).rejects.toThrow();
  expect(f.getState()).toBeNull();
  expect(f.imports).toHaveLength(0);
});

it('sorts by full DBL equivalent rather than the Excel order or the foreign component alone', async () => {
  const f = fixture(),
    base = unzipSync(workbook('2026-08-01', 'Hotel Two', '€400'));
  const row =
    '<row r="3"><c r="A3" t="inlineStr"><is><t>2026-08-01</t></is></c><c r="B3" t="inlineStr"><is><t>Hotel One</t></is></c><c r="D3" t="inlineStr"><is><t>Standard</t></is></c><c r="F3" t="inlineStr"><is><t>€200</t></is></c><c r="K3" t="inlineStr"><is><t>50000000</t></is></c></row>';
  const bytes = zipSync({
    ...base,
    'xl/worksheets/sheet1.xml': strToU8(
      strFromU8(base['xl/worksheets/sheet1.xml']!).replace(
        '</sheetData>',
        row + '</sheetData>',
      ),
    ),
  });
  const preview = await f.service.preview('tour', bytes, options, actor);
  expect(preview.rows.map((r) => r.stays[0]?.hotelId)).toEqual(['h1', 'h2']);
  expect(preview.exchangeRates.EUR).toBe('600000');
});
