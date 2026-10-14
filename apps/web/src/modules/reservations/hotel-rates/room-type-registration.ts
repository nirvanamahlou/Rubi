import type {
  MasterDataRecord,
  MasterDataResource,
} from '@nora/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';

type RoomType = { id: string; name: string };
type RecordResponse = { data: MasterDataRecord };
type ListResponse = { data: readonly MasterDataRecord[] };

export interface HotelRoomTypeApi {
  detail(resource: MasterDataResource, id: string): Promise<RecordResponse>;
  list(
    resource: MasterDataResource,
    query: {
      page: number;
      pageSize: number;
      search: string;
      sortBy: 'name';
      sortDirection: 'asc';
      status: 'all';
    },
  ): Promise<ListResponse>;
  create(
    resource: MasterDataResource,
    body: { values: Readonly<Record<string, string>> },
  ): Promise<RecordResponse>;
  update(
    resource: MasterDataResource,
    id: string,
    body: {
      version: number;
      values: Readonly<Record<string, readonly string[]>>;
    },
  ): Promise<RecordResponse>;
}

const directoryApi: HotelRoomTypeApi = masterDataApi;

const normalizedName = (value: string) =>
  value.normalize('NFC').trim().toLocaleLowerCase();

function roomTypeFrom(record: MasterDataRecord): RoomType {
  return { id: record.id, name: record.name };
}

function linkedRoomIds(record: MasterDataRecord) {
  return String(record.attributes.roomTypeIds ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

/** Create or reuse a canonical room type, then append it through Master Data's hotel API. */
export async function registerRoomTypeForHotel(
  input: {
    hotelId: string;
    cityId: string;
    name: string;
    permissions: readonly string[];
  },
  api: HotelRoomTypeApi = directoryApi,
): Promise<RoomType> {
  const name = input.name.normalize('NFC').trim();
  if (!name || name.length > 160)
    throw new Error('نام نوع اتاق را تا ۱۶۰ نویسه وارد کنید.');
  if (
    !input.permissions.includes('master_data.read') ||
    !input.permissions.includes('master_data.update')
  )
    throw new Error('برای افزودن نوع اتاق، مجوز خواندن و ویرایش اطلاعات پایه لازم است.');

  const hotelResult = await api.detail('hotels', input.hotelId);
  const hotel = hotelResult.data;
  if (
    hotel.resource !== 'hotels' ||
    hotel.status !== 'active' ||
    hotel.attributes.cityId !== input.cityId
  )
    throw new Error('هتل دیگر فعال نیست یا به شهر انتخاب‌شده تعلق ندارد.');

  const types = await api.list('room-types', {
    page: 1,
    pageSize: 100,
    search: name,
    sortBy: 'name',
    sortDirection: 'asc',
    status: 'all',
  });
  const match = types.data.find(
    (candidate) => normalizedName(candidate.name) === normalizedName(name),
  );
  let roomType: MasterDataRecord;
  if (match) {
    if (match.status !== 'active')
      throw new Error(
        'این نوع اتاق از قبل غیرفعال است؛ ابتدا آن را در اطلاعات پایه فعال کنید.',
      );
    roomType = match;
  } else {
    if (!input.permissions.includes('master_data.create'))
      throw new Error('برای ساخت نوع اتاق جدید، مجوز ایجاد اطلاعات پایه لازم است.');
    roomType = (
      await api.create('room-types', { values: { name } })
    ).data;
  }

  const latestHotel = (await api.detail('hotels', input.hotelId)).data;
  if (
    latestHotel.resource !== 'hotels' ||
    latestHotel.status !== 'active' ||
    latestHotel.attributes.cityId !== input.cityId
  )
    throw new Error('اطلاعات هتل هنگام افزودن نوع اتاق تغییر کرد؛ دوباره بررسی کنید.');
  const currentIds = linkedRoomIds(latestHotel);
  if (currentIds.includes(roomType.id)) return roomTypeFrom(roomType);

  try {
    await api.update('hotels', input.hotelId, {
      version: latestHotel.version,
      values: { roomTypeIds: [...currentIds, roomType.id] },
    });
  } catch (error) {
    throw new Error(
      match
        ? 'نوع اتاق ثبت‌شده به هتل وصل نشد؛ صفحه را تازه کنید و دوباره تلاش کنید.'
        : 'نوع اتاق ساخته شد اما به هتل وصل نشد؛ صفحه را تازه کنید و دوباره تلاش کنید.',
      { cause: error },
    );
  }
  return roomTypeFrom(roomType);
}
