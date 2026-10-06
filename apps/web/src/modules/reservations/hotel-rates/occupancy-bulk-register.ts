import type { MasterDataRecord, MasterDataResource } from '@nora/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';
import { rateRequest } from './controls';
import {
  buildBulkPacks,
  bulkOperationKey,
  exactReference,
  planOccupancyBatch,
} from './occupancy-bulk';
import type { ImportedOccupancy } from './occupancy-import';

export async function allImportReferences(
  resource: MasterDataResource,
  cityId?: string,
) {
  const records: MasterDataRecord[] = [];
  let total: number | undefined;
  for (let page = 1; page <= 100; page++) {
    const result = await masterDataApi.list(resource, {
      search: '',
      status: 'all',
      sortBy: 'name',
      sortDirection: 'asc',
      page,
      pageSize: 100,
      ...(cityId ? { cityId } : {}),
    });
    if (total !== undefined && total !== result.meta.total)
      throw Error('فهرست اطلاعات پایه حین خواندن تغییر کرد؛ دوباره تلاش کنید.');
    total = result.meta.total;
    for (const record of result.data) {
      if (records.some((r) => r.id === record.id))
        throw Error('فهرست اطلاعات پایه تکراری یا ناقص است.');
      if (cityId && record.attributes.cityId !== cityId)
        throw Error('هتل خارج از شهر انتخاب‌شده برگردانده شد.');
      records.push(record);
    }
    if (records.length === total) return records;
    if (!result.data.length || records.length > total) break;
  }
  throw Error('فهرست اطلاعات پایه کامل خوانده نشد؛ ثبت انجام نمی‌شود.');
}

export async function registerOccupancyBatch(input: {
  rows: readonly ImportedOccupancy[];
  branchId: string;
  cityId: string;
  countryId: string;
  actorId: string;
  brokerName: string;
  createBroker: boolean;
  permissions: readonly string[];
  onProgress: (message: string) => void;
  onSaved: () => void;
}) {
  const { onProgress } = input;
  const plan = planOccupancyBatch(input.rows);
  // Prove payload limits before creating any references. UUID lengths are fixed.
  const fakeId = '00000000-0000-4000-8000-000000000000';
  buildBulkPacks(
    plan,
    input.branchId,
    input.cityId,
    fakeId,
    new Map([...plan.hotelNames].map((name) => [name, fakeId])),
    new Map([...plan.capacities.keys()].map((name) => [name, fakeId])),
  );
  if (!input.brokerName.trim())
    throw Error('نام کارگزار کل فایل را وارد کنید.');
  if (!input.permissions.includes('master_data.read'))
    throw Error('برای تطبیق هتل و اتاق، دسترسی خواندن اطلاعات پایه لازم است.');
  const city = (await masterDataApi.detail('cities', input.cityId)).data;
  if (city.status !== 'active' || city.attributes.countryId !== input.countryId)
    throw Error('کشور و شهر انتخاب‌شده معتبر نیستند.');
  onProgress('تطبیق همه هتل‌ها، اتاق‌ها و کارگزار با اطلاعات پایه…');
  const hotels = await allImportReferences('hotels', input.cityId);
  const roomTypes = await allImportReferences('room-types');
  const organizations = await allImportReferences('organizations');
  let broker = exactReference(organizations, input.brokerName);
  if (
    broker &&
    !String(broker.attributes.roleCodes ?? '')
      .split(',')
      .includes('BROKER')
  )
    throw Error('نام انتخاب‌شده متعلق به تأمین‌کننده با نقش کارگزار نیست.');
  if (!broker && !input.createBroker)
    throw Error('کارگزار موجود نیست؛ ایجاد کارگزار با همین نام را تأیید کنید.');
  const hotelMap = new Map<string, MasterDataRecord>();
  const roomMap = new Map<string, MasterDataRecord>();
  for (const name of plan.hotelNames) {
    const existing = exactReference(hotels, name);
    if (existing && existing.attributes.isSaleableReference !== true)
      throw Error(`هتل «${name}» برای فروش فعال نیست؛ خودکار تغییر نمی‌کند.`);
    if (existing) hotelMap.set(name, existing);
  }
  for (const name of plan.capacities.keys()) {
    const existing = exactReference(roomTypes, name);
    if (existing) roomMap.set(name, existing);
  }
  const needsCreate =
    !broker ||
    hotelMap.size !== plan.hotelNames.size ||
    roomMap.size !== plan.capacities.size;
  if (needsCreate && !input.permissions.includes('master_data.create'))
    throw Error('برای ساخت موارد جدید، دسترسی ایجاد اطلاعات پایه لازم است.');
  const linksNeeded = [...plan.hotelNames].some((name) => {
    const hotel = hotelMap.get(name);
    const ids = String(hotel?.attributes.roomTypeIds ?? '').split(',');
    const names = new Set(
      plan.groups.flatMap((g) => [...(g.hotels.get(name)?.keys() ?? [])]),
    );
    return (
      hotel && [...names].some((n) => !ids.includes(roomMap.get(n)?.id ?? ''))
    );
  });
  if (linksNeeded && !input.permissions.includes('master_data.update'))
    throw Error(
      'برای اتصال اتاق جدید به هتل موجود، دسترسی ویرایش اطلاعات پایه لازم است.',
    );
  // No deletion/rollback: accepted references and packs survive a partial failure.
  if (!broker)
    broker = (
      await masterDataApi.create('organizations', {
        values: { legalName: input.brokerName.trim(), roleCodes: ['BROKER'] },
      })
    ).data;
  for (const [name, capacity] of plan.capacities) {
    if (!roomMap.has(name)) {
      onProgress(`ایجاد نوع اتاق: ${name}`);
      roomMap.set(
        name,
        (
          await masterDataApi.create('room-types', {
            values: { name, referenceCapacity: capacity },
          })
        ).data,
      );
    }
  }
  for (const name of plan.hotelNames) {
    const needed = new Set(
      plan.groups
        .flatMap((g) => [...(g.hotels.get(name)?.keys() ?? [])])
        .map((n) => roomMap.get(n)!.id),
    );
    let hotel = hotelMap.get(name);
    if (!hotel) {
      onProgress(`ایجاد هتل در شهر انتخاب‌شده: ${name}`);
      hotel = (
        await masterDataApi.create('hotels', {
          values: {
            name,
            cityId: input.cityId,
            countryId: input.countryId,
            isSaleableReference: 'true',
            roomTypeIds: [...needed],
          },
        })
      ).data;
    } else {
      const detail = (await masterDataApi.detail('hotels', hotel.id)).data;
      if (
        detail.status !== 'active' ||
        detail.attributes.cityId !== input.cityId ||
        detail.attributes.isSaleableReference !== true
      )
        throw Error(`وضعیت هتل ${name} تغییر کرده است.`);
      const attached = String(detail.attributes.roomTypeIds ?? '')
        .split(',')
        .filter(Boolean);
      if ([...needed].some((id) => !attached.includes(id))) {
        hotel = (
          await masterDataApi.update('hotels', detail.id, {
            version: detail.version,
            values: { roomTypeIds: [...new Set([...attached, ...needed])] },
          })
        ).data;
      }
    }
    hotelMap.set(name, hotel);
  }
  const packs = buildBulkPacks(
    plan,
    input.branchId,
    input.cityId,
    broker.id,
    new Map([...hotelMap].map(([n, h]) => [n, h.id])),
    new Map([...roomMap].map(([n, r]) => [n, r.id])),
  );
  let saved = 0;
  try {
    for (const pack of packs) {
      onProgress(
        `ثبت بسته ${saved + 1} از ${packs.length}؛ ${saved} بسته تأیید شده است…`,
      );
      await rateRequest('/packs', {
        method: 'POST',
        body: JSON.stringify(pack),
        headers: {
          'idempotency-key': await bulkOperationKey(input.actorId, pack),
        },
      });
      saved++;
    }
  } catch (error) {
    throw Error(
      `${saved} از ${packs.length} بسته تأیید شده؛ ثبت مجدد همین فایل با همین کارگزار، بسته‌های قبلی را تکرار نمی‌کند. ${error instanceof Error ? error.message : 'ثبت ناموفق بود.'}`,
    );
  } finally {
    if (saved) input.onSaved();
  }
  return {
    packs: saved,
    prices: plan.priceCount,
    hotels: plan.hotelNames.size,
  };
}
