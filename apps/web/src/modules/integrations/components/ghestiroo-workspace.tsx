'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Card } from '@/components/ui/surfaces';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { ghestirooApi } from '../api/client';
import { ExternalFields } from './niyayesh-data';

type Field = {
  key: string;
  label: string;
  type: string;
  target?: string;
  options?: [string, string, string?][];
  when?: Record<string, unknown>;
};
type Schema = {
  fields: Field[];
  relations: Record<string, { id: string; title: string }[]>;
  value: Record<string, unknown>;
  id: string | null;
  version: number;
};
const kinds: Record<string, string> = {
  countries: 'کشورها',
  destinations: 'مقصدها',
  airlines: 'شرکت‌های حمل‌ونقل',
  hotels: 'هتل‌ها',
  tours: 'تورها',
  tickets: 'بلیت هواپیما',
  trains: 'قطارها',
};
function Fields({
  fields,
  value,
  onChange,
  relations,
  disabled,
}: {
  fields: Field[];
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  relations: Schema['relations'];
  disabled: boolean;
}) {
  return (
    <>
      {fields.map((f) => {
        if (
          f.when &&
          Object.entries(f.when).some(([key, v]) =>
            Array.isArray(v) ? !v.includes(value[key]) : v !== value[key],
          )
        )
          return null;
        const v = value[f.key];
        const set = (next: unknown) => onChange({ ...value, [f.key]: next });
        if (f.type === 'repeat') {
          const rows = Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
          return (
            <fieldset
              key={f.key}
              className="grid gap-3 rounded-xl border border-border p-3 sm:col-span-2"
            >
              <legend>{f.label}</legend>
              {rows.map((row, i) => (
                <div
                  key={i}
                  className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2"
                >
                  <Fields
                    fields={(f.options ?? []).map(([key, label, type]) => ({
                      key,
                      label,
                      type: type ?? 'text',
                    }))}
                    value={row}
                    relations={relations}
                    disabled={disabled}
                    onChange={(next) =>
                      set(rows.map((old, at) => (at === i ? next : old)))
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => set(rows.filter((_, at) => at !== i))}
                  >
                    حذف ردیف
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                disabled={disabled || rows.length >= 100}
                onClick={() => set([...rows, {}])}
              >
                افزودن ردیف
              </Button>
            </fieldset>
          );
        }
        if (f.type === 'checkbox')
          return (
            <label key={f.key} className="flex gap-2">
              <input
                type="checkbox"
                checked={v === true}
                disabled={disabled}
                onChange={(e) => set(e.target.checked)}
              />
              {f.label}
            </label>
          );
        let control;
        if (f.type === 'file' || f.type === 'files')
          control = (
            <input
              aria-label={f.label}
              type="file"
              multiple={f.type === 'files'}
              accept="image/*"
              disabled={disabled}
              onChange={(e) => {
                const input = e.currentTarget;
                input.setCustomValidity('');
                const files = Array.from(e.target.files ?? []);
                if (files.some((file) => file.size > 4 * 1024 * 1024)) {
                  input.setCustomValidity(
                    'حجم هر تصویر باید حداکثر ۴ مگابایت باشد.',
                  );
                  input.reportValidity();
                  return;
                }
                void Promise.all(
                  files.map(
                    (file) =>
                      new Promise<{ filename: string; content: string }>(
                        (resolve, reject) => {
                          const reader = new FileReader();
                          reader.onerror = reject;
                          reader.onload = () =>
                            resolve({
                              filename: file.name,
                              content: String(reader.result).split(',')[1]!,
                            });
                          reader.readAsDataURL(file);
                        },
                      ),
                  ),
                )
                  .then((result) =>
                    set(f.type === 'files' ? result : result[0]),
                  )
                  .catch(() => {
                    input.setCustomValidity('خواندن تصویر انجام نشد.');
                    input.reportValidity();
                  });
              }}
            />
          );
        else if (['relation', 'multirelation', 'select'].includes(f.type)) {
          const options = f.target
            ? (relations[f.target] ?? []).map((r) => [r.id, r.title])
            : (f.options ?? []);
          control =
            f.type === 'multirelation' ? (
              <div className="max-h-48 overflow-auto">
                {options.map(([id, title]) => (
                  <label key={id} className="flex gap-2">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={Array.isArray(v) && v.includes(id)}
                      onChange={(e) =>
                        set(
                          e.target.checked
                            ? [...(Array.isArray(v) ? v : []), id]
                            : (Array.isArray(v) ? v : []).filter(
                                (x) => x !== id,
                              ),
                        )
                      }
                    />
                    {title}
                  </label>
                ))}
              </div>
            ) : (
              <NativeSearchSelect
                aria-label={f.label}
                value={String(v ?? '')}
                disabled={disabled}
                onChange={(e) => set(e.target.value)}
              >
                <option value="">انتخاب کنید</option>
                {options.map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
              </NativeSearchSelect>
            );
        } else if (f.type === 'textarea')
          control = (
            <textarea
              aria-label={f.label}
              value={String(v ?? '')}
              rows={4}
              disabled={disabled}
              className="rounded-xl border border-border p-3"
              onChange={(e) => set(e.target.value)}
            />
          );
        else
          control = (
            <input
              aria-label={f.label}
              type={
                ['date', 'time', 'email', 'url'].includes(f.type)
                  ? f.type
                  : 'text'
              }
              inputMode={f.type === 'number' ? 'decimal' : undefined}
              value={typeof v === 'object' ? '' : String(v ?? '')}
              disabled={disabled}
              className="rounded-xl border border-border p-3"
              onChange={(e) => set(e.target.value)}
            />
          );
        return (
          <label key={f.key} className="grid gap-2 text-sm">
            {f.label}
            {control}
          </label>
        );
      })}
    </>
  );
}

export function GhestirooWorkspace({ branchId }: { branchId: string }) {
  const [kind, setKind] = useState('hotels');
  const [view, setView] = useState<'editor' | 'imports'>('editor');
  const [items, setItems] = useState<
    { id: string; title: string; version: number }[]
  >([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [tour, setTour] = useState('');
  const [combined, setCombined] = useState(false);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [applyCommand, setApplyCommand] = useState('');
  const [saveCommand, setSaveCommand] = useState(crypto.randomUUID());
  async function perform(job: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await job();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'عملیات انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  async function load(after = '', id?: string) {
    const page = await ghestirooApi.workspace(branchId, {
      action: 'list',
      kind,
      after,
    });
    setItems((old) =>
      after
        ? [...old, ...(page.items as typeof items)]
        : (page.items as typeof items),
    );
    setCursor(page.nextCursor as string | null);
    if (!after) {
      const s = await ghestirooApi.workspace(branchId, {
        action: 'schema',
        kind,
        ...(id ? { id } : {}),
      });
      if (id && !(page.items as typeof items).some((item) => item.id === id)) {
        setItems((old) => [
          ...old,
          {
            id,
            title: String((s.value as Record<string, unknown>).title),
            version: Number(s.version),
          },
        ]);
      }
      setSchema(s as unknown as Schema);
      setSaveCommand(crypto.randomUUID());
    }
  }
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      setBusy(true);
      setError('');
      void (async () => {
        try {
          const [page, s] = await Promise.all([
            ghestirooApi.workspace(branchId, { action: 'list', kind }),
            ghestirooApi.workspace(branchId, { action: 'schema', kind }),
          ]);
          if (cancelled) return;
          setItems(page.items as typeof items);
          setCursor(page.nextCursor as string | null);
          setSchema(s as unknown as Schema);
          setPreview(null);
          setFile(null);
          setTour('');
        } catch (e) {
          if (!cancelled)
            setError(e instanceof Error ? e.message : 'عملیات انجام نشد.');
        } finally {
          if (!cancelled) setBusy(false);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [branchId, kind]);
  async function download(action: string, advanced = false) {
    await perform(async () => {
      const data = await ghestirooApi.workspace(branchId, {
        action,
        kind,
        combined,
        ...(advanced ? { format: 'advanced' } : {}),
      });
      const blob = new Blob(
        [Uint8Array.from(atob(String(data.content)), (c) => c.charCodeAt(0))],
        {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = String(data.filename);
      a.click();
      URL.revokeObjectURL(url);
    });
  }
  return (
    <Card className="grid gap-4 p-5">
      <h2 className="text-lg font-bold">مدیریت خدمات قسطی‌رو</h2>
      <p className="text-sm text-muted-foreground">
        تعریف و ورود اکسل مستقیماً در سایت قسطی‌رو انجام می‌شود؛ اطلاعات در فروش
        و مالی نورا کپی نمی‌شوند.
      </p>
      <label className="grid gap-2">
        بخش سایت
        <NativeSearchSelect
          value={kind}
          onChange={(e) => {
            setSchema(null);
            setPreview(null);
            setKind(e.target.value);
          }}
          disabled={busy}
        >
          {Object.entries(kinds).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSearchSelect>
      </label>
      <nav className="flex flex-wrap gap-2">
        <Button
          variant={view === 'editor' ? 'primary' : 'outline'}
          onClick={() => setView('editor')}
        >
          تعریف و ویرایش
        </Button>
        <Button
          variant={view === 'imports' ? 'primary' : 'outline'}
          onClick={() => setView('imports')}
        >
          ورود اطلاعات با اکسل
        </Button>
      </nav>
      {error ? (
        <Alert tone="error" title="عملیات انجام نشد" description={error} />
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      {view === 'editor' ? (
        <>
          <div className="flex flex-wrap gap-2">
            <NativeSearchSelect
              aria-label="رکورد سایت"
              value={schema?.id ?? ''}
              disabled={busy}
              onChange={(e) =>
                void perform(() => load('', e.target.value || undefined))
              }
            >
              <option value="">تعریف رکورد جدید</option>
              {items.map((i) => (
                <option value={i.id} key={i.id}>
                  {i.title}
                </option>
              ))}
            </NativeSearchSelect>
            {cursor ? (
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => void perform(() => load(cursor))}
              >
                دریافت موارد بیشتر
              </Button>
            ) : null}
          </div>
          {schema ? (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void perform(async () => {
                  const result = await ghestirooApi.workspace(branchId, {
                    action: 'save',
                    kind,
                    id: schema.id,
                    version: schema.version,
                    value: schema.value,
                    command: saveCommand,
                  });
                  await load('', String(result.id));
                  setNotice('اطلاعات در سایت قسطی‌رو ثبت شد.');
                });
              }}
            >
              <Fields
                fields={schema.fields}
                value={schema.value}
                relations={schema.relations}
                disabled={busy}
                onChange={(value) => {
                  setSchema((current) =>
                    current === schema ? { ...schema, value } : current,
                  );
                  setSaveCommand(crypto.randomUUID());
                }}
              />
              <Button disabled={busy} type="submit">
                ذخیره در قسطی‌رو
              </Button>
            </form>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-sm">
            قالب و قواعد از خود سایت دریافت می‌شوند. ابتدا پیش‌نمایش بگیرید؛ ثبت
            نهایی فقط پس از تأیید شما و بررسی دوباره نسخه‌ها انجام می‌شود.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => void download('template')}
            >
              دریافت قالب اصلی سایت
            </Button>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => void download('export')}
            >
              دریافت اطلاعات فعلی با اکسل
            </Button>
            {kind === 'tours' ? (
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => void download('tour-template')}
              >
                قالب تاریخ و قیمت تور
              </Button>
            ) : null}
            {kind === 'hotels' ? (
              <>
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => void download('template', true)}
                >
                  قالب پیشرفته اتاق‌ها و نرخ هتل
                </Button>
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => void download('export', true)}
                >
                  خروجی پیشرفته اتاق‌ها و نرخ هتل
                </Button>
              </>
            ) : null}
          </div>
          {kind === 'tours' ? (
            <>
              <label>
                تور مربوط به فایل قیمت
                <NativeSearchSelect
                  value={tour}
                  disabled={busy}
                  onChange={(e) => {
                    setTour(e.target.value);
                    setPreview(null);
                  }}
                >
                  <option value="">ورود فهرست تورها با قالب عمومی</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                    </option>
                  ))}
                </NativeSearchSelect>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={combined}
                  onChange={(e) => {
                    setCombined(e.target.checked);
                    setPreview(null);
                  }}
                />
                قالب ترکیب هتل‌ها
              </label>
            </>
          ) : null}
          <input
            aria-label="فایل اکسل قسطی‌رو"
            type="file"
            accept=".xlsx"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
            }}
          />
          {file && file.size > 4 * 1024 * 1024 ? (
            <p role="alert">حجم فایل باید حداکثر ۴ مگابایت باشد.</p>
          ) : null}
          <Button
            disabled={busy || !file || file.size > 4 * 1024 * 1024}
            onClick={() =>
              void perform(async () => {
                const result = await ghestirooApi.workspace(
                  branchId,
                  {
                    action: 'preview',
                    kind,
                    command: crypto.randomUUID(),
                    ...(tour ? { tourId: tour } : {}),
                    combined,
                  },
                  file!,
                );
                setPreview(result);
                setApplyCommand(crypto.randomUUID());
              })
            }
          >
            بررسی و پیش‌نمایش
          </Button>
          {preview ? (
            <>
              <p>
                {preview.valid
                  ? 'فایل آماده ثبت است'
                  : 'فایل نیازمند اصلاح است'}
              </p>
              <div className="max-h-96 overflow-auto">
                <ExternalFields value={preview.rows} />
              </div>
              <p>
                {String(preview.rowCount)} ردیف؛ حداکثر ۵۰ ردیف در پیش‌نمایش
                نمایش داده می‌شود.
              </p>
              {Array.isArray(preview.rooms) &&
              preview.rooms.length &&
              !preview.applied ? (
                <RoomReview
                  key={String(preview.previewId)}
                  rooms={preview.rooms as Room[]}
                  disabled={busy}
                  onSubmit={(rooms) =>
                    void perform(async () => {
                      const revised = await ghestirooApi.workspace(branchId, {
                        action: 'rooms',
                        kind,
                        previewId: preview.previewId,
                        revision: preview.revision,
                        rooms,
                        command: crypto.randomUUID(),
                      });
                      setPreview(revised);
                      setApplyCommand(crypto.randomUUID());
                    })
                  }
                />
              ) : null}
              <Button
                disabled={
                  busy || preview.valid !== true || preview.applied === true
                }
                onClick={() =>
                  void perform(async () => {
                    await ghestirooApi.workspace(branchId, {
                      action: 'apply',
                      kind,
                      previewId: preview.previewId,
                      command: applyCommand,
                    });
                    setPreview({ ...preview, applied: true });
                    setNotice('اطلاعات فایل در سایت ثبت شد.');
                    await load();
                  })
                }
              >
                تأیید و ثبت نهایی فایل
              </Button>
            </>
          ) : null}
        </>
      )}
    </Card>
  );
}

type Room = { row: number; hotel: string; room: string };
function RoomReview({
  rooms,
  disabled,
  onSubmit,
}: {
  rooms: Room[];
  disabled: boolean;
  onSubmit: (rooms: Record<string, string>) => void;
}) {
  const [values, setValues] = useState(
    Object.fromEntries(rooms.map((r) => ['room_' + r.row, r.room])),
  );
  return (
    <fieldset className="grid max-h-96 gap-3 overflow-auto rounded-xl border border-border p-3">
      <legend>بررسی نوع اتاق‌ها</legend>
      {rooms.map((r) => (
        <label key={r.row}>
          {' '}
          {r.row} · {r.hotel}
          <input
            aria-label={'نوع اتاق سطر ' + r.row}
            value={values['room_' + r.row] ?? ''}
            maxLength={200}
            disabled={disabled}
            onChange={(e) =>
              setValues({ ...values, ['room_' + r.row]: e.target.value })
            }
            className="rounded-xl border border-border p-2"
          />
        </label>
      ))}
      <Button
        disabled={disabled}
        variant="outline"
        onClick={() => onSubmit(values)}
      >
        اصلاح اتاق‌ها و بررسی دوباره
      </Button>
    </fieldset>
  );
}
