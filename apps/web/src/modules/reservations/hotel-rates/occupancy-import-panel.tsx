'use client';
import { useMemo, useState } from 'react';
import type { HotelOccupancyRateV1 } from '@nora/contracts';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { OccupancyImportPreview } from './occupancy-import-preview';
import {
  occupancyImportRows,
  readOccupancyXlsx,
  type ImportedOccupancy,
} from './occupancy-import';

export function OccupancyRateEditor({
  rates,
  onChange,
  disabled = false,
}: {
  rates: readonly HotelOccupancyRateV1[];
  onChange: (rates: HotelOccupancyRateV1[]) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const visible = rates
    .map((rate, index) => ({ rate, index }))
    .filter(({ rate }) =>
      [
        rate.composition,
        rate.startsOn,
        rate.endsOnExclusive,
        rate.board,
        rate.amount,
      ]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  return (
    <section
      aria-label="جست‌وجو و ویرایش نرخ‌های ترکیبی"
      className="space-y-2 rounded border p-3"
    >
      <label>
        جست‌وجوی ترکیب، تاریخ یا مبلغ
        <input
          className="mx-2 rounded border p-2"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </label>
      <p>
        {visible.length.toLocaleString('fa-IR')} نرخ · کل اتاق / هر شب · ذخیره
        با دکمهٔ ثبت بسته
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {[
                'ترکیب',
                'سن کودک (حد بالا غیرشامل)',
                'از',
                'تا (غیرشامل)',
                'ارز',
                'قیمت کل اتاق/شب',
              ].map((label) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible
              .slice(page * 30, (page + 1) * 30)
              .map(({ rate, index }) => (
                <tr key={index}>
                  <td>{rate.composition}</td>
                  <td>
                    {rate.childAges
                      .map((age) => `${age.min} تا کمتر از ${age.maxExclusive}`)
                      .join(' / ') || '—'}
                  </td>
                  <td>
                    <input
                      type="date"
                      aria-label={`شروع نرخ ${index + 1}`}
                      disabled={disabled}
                      value={rate.startsOn}
                      onChange={(e) =>
                        onChange(
                          rates.map((r, i) =>
                            i === index
                              ? { ...r, startsOn: e.target.value }
                              : r,
                          ),
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      aria-label={`پایان غیرشامل نرخ ${index + 1}`}
                      disabled={disabled}
                      value={rate.endsOnExclusive}
                      onChange={(e) =>
                        onChange(
                          rates.map((r, i) =>
                            i === index
                              ? { ...r, endsOnExclusive: e.target.value }
                              : r,
                          ),
                        )
                      }
                    />
                  </td>
                  <td>{rate.currencyCode}</td>
                  <td>
                    <input
                      aria-label={`قیمت نرخ ${index + 1}`}
                      dir="ltr"
                      disabled={disabled}
                      className="w-28 rounded border p-1"
                      value={rate.amount}
                      onChange={(e) =>
                        onChange(
                          rates.map((r, i) =>
                            i === index ? { ...r, amount: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        disabled={page === 0}
        onClick={() => setPage(page - 1)}
      >
        قبلی
      </button>{' '}
      <button
        type="button"
        disabled={(page + 1) * 30 >= visible.length}
        onClick={() => setPage(page + 1)}
      >
        بعدی
      </button>
    </section>
  );
}

type Hotel = {
  id: string;
  name: string;
  englishName?: string;
  roomTypes?: { id: string; name: string }[];
};
export function OccupancyImportPanel({
  hotels,
  checkIn,
  checkOut,
  currency,
  disabled,
  onApply,
}: {
  hotels: readonly Hotel[];
  checkIn: string;
  checkOut: string;
  currency: string;
  disabled: boolean;
  onApply: (
    hotelId: string,
    rooms: { roomTypeId: string; rates: HotelOccupancyRateV1[] }[],
  ) => void;
}) {
  const [rows, setRows] = useState<ImportedOccupancy[]>([]),
    [issues, setIssues] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [preview, setPreview] = useState<{ excluded: number } | null>(null);
  const [fileError, setFileError] = useState('');
  const [sourceHotel, setSourceHotel] = useState(''),
    [board, setBoard] = useState(''),
    [hotelId, setHotelId] = useState(''),
    [mapping, setMapping] = useState<Record<string, string>>({});
  const sourceHotels = useMemo(
    () => [...new Set(rows.map((r) => r.hotel))],
    [rows],
  );
  const hotel = hotels.find((h) => h.id === hotelId);
  const boards = [
    ...new Set(rows.filter((r) => r.hotel === sourceHotel).map((r) => r.board)),
  ];
  const selectedBoard = boards.length === 1 ? boards[0] : board;
  const chosen = rows.filter(
    (r) =>
      r.hotel === sourceHotel &&
      r.board === selectedBoard &&
      r.currencyCode === currency &&
      r.startsOn < checkOut &&
      r.endsOnExclusive > checkIn,
  );
  const sourceRooms = [...new Set(chosen.map((r) => r.room))];
  async function load(file: File) {
    setBusy(true);
    setMessage('');
    setPreview(null);
    setFileError('');
    setRows([]);
    setIssues([]);
    setSourceHotel('');
    setBoard('');
    setMapping({});
    try {
      const parsed = occupancyImportRows(await readOccupancyXlsx(file));
      setRows(parsed.rows);
      setIssues(parsed.issues);
      setPreview({ excluded: parsed.excluded });
      setMessage(
        `${parsed.rows.length.toLocaleString('fa-IR')} نرخ خوانده شد؛ ${parsed.excluded.toLocaleString('fa-IR')} ردیف IN DBL PP کنار گذاشته شد. فایل فقط در مرورگر خوانده شده؛ هنوز هیچ نرخی ثبت نشده است.`,
      );
    } catch (e) {
      setFileError(e instanceof Error ? e.message : 'خواندن فایل انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  function apply() {
    try {
      if (!hotel || !checkIn || checkOut <= checkIn || !chosen.length)
        throw new Error(
          'ابتدا شهر، بازه، هتل موجود و هتل فایل را انتخاب کنید.',
        );
      if (
        sourceRooms.some((room) => !mapping[room]) ||
        new Set(sourceRooms.map((room) => mapping[room])).size !==
          sourceRooms.length
      )
        throw new Error(
          'هر اتاق فایل باید به یک نوع اتاق متفاوت و متصل به هتل نگاشت شود.',
        );
      const roomRates = sourceRooms.map((room) => ({
        roomTypeId: mapping[room]!,
        rates: chosen
          .filter((r) => r.room === room)
          .map(
            ({
              hotel: sourceName,
              room: sourceRoom,
              capacity,
              sourceRow,
              ...rate
            }) => {
              void sourceName;
              void sourceRoom;
              void capacity;
              void sourceRow;
              return {
                ...rate,
                startsOn: rate.startsOn < checkIn ? checkIn : rate.startsOn,
                endsOnExclusive:
                  rate.endsOnExclusive > checkOut
                    ? checkOut
                    : rate.endsOnExclusive,
              };
            },
          ),
      }));
      if (
        new TextEncoder().encode(JSON.stringify(roomRates)).byteLength > 70000
      )
        throw new Error(
          'این انتخاب بزرگ است؛ بازهٔ کوتاه‌تر انتخاب کنید تا ثبت اتمیک و امن بماند.',
        );
      onApply(hotel.id, roomRates);
      setMessage(
        'نرخ‌ها به پیش‌نویس بسته افزوده شدند؛ کارگزار را تعیین و ثبت بسته را بزنید.',
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'نگاشت انجام نشد.');
    }
  }
  return (
    <section
      className="space-y-3 rounded-xl border p-4"
      aria-label="ورودی اکسل نرخ ترکیبی هتل"
    >
      <h2 className="font-bold">ورودی اکسل نرخ ترکیبی هتل</h2>
      <p>
        فایل خروجی نورا را بخوانید؛ هتل و اتاق را به اطلاعات پایهٔ موجود وصل
        کنید. قیمت‌ها کل اتاق در هر شب‌اند، نه هر نفر.
      </p>
      <input
        aria-label="فایل خروجی نورا"
        type="file"
        accept=".xlsx"
        disabled={disabled || busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void load(file);
          e.target.value = '';
        }}
      />
      {message && <p role="status">{message}</p>}
      {busy && <p role="status">در حال خواندن شیت خروجی نورا…</p>}
      {fileError && <p role="alert">خواندن فایل انجام نشد: {fileError}</p>}
      {preview && (
        <OccupancyImportPreview
          key={message}
          rows={rows}
          issues={issues}
          excluded={preview.excluded}
        />
      )}
      {rows.length > 0 && (
        <>
          <SearchCombobox
            label="هتل در فایل"
            value={sourceHotel}
            options={sourceHotels.map((name) => ({ value: name, label: name }))}
            onValueChange={(name) => {
              setSourceHotel(name);
              setBoard('');
              setMapping({});
            }}
          />
          <SearchCombobox
            label="بورد نرخ واردشده"
            value={selectedBoard ?? ''}
            options={boards.map((value) => ({
              value,
              label: value || 'بدون بورد',
            }))}
            onValueChange={setBoard}
          />
          <SearchCombobox
            label="هتل موجود در شهر بسته"
            value={hotelId}
            options={hotels.map((h) => ({
              value: h.id,
              label: h.englishName || h.name,
            }))}
            onValueChange={(id) => {
              setHotelId(id);
              setMapping({});
            }}
          />
          <p>
            {chosen.length.toLocaleString('fa-IR')} نرخ هم‌پوشان با تاریخ بسته و
            ارز {currency}
          </p>
          {sourceRooms.map((room) => (
            <div key={room}>
              <span>{room}</span>
              <SearchCombobox
                label={`نگاشت اتاق ${room}`}
                value={mapping[room] ?? ''}
                options={(hotel?.roomTypes ?? []).map((r) => ({
                  value: r.id,
                  label: r.name,
                }))}
                onValueChange={(id) => setMapping({ ...mapping, [room]: id })}
              />
            </div>
          ))}
          <button
            className="rounded bg-primary px-4 py-2 text-white"
            type="button"
            disabled={disabled || busy}
            onClick={apply}
          >
            جایگزینی نرخ‌های ترکیبی این هتل در پیش‌نویس
          </button>
        </>
      )}
    </section>
  );
}
