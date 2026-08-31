'use client';

import { useState } from 'react';
import { Alert, Button, Card, Input } from '@/components/ui';
import type { Product, Reference } from '../model/catalog';
import {
  composePreviewJourney,
  previewTripCandidates,
  type ProductSelection,
  type TripType,
} from '../model/journey';
import { displayTime } from '../model/preview';

function TicketChoice({
  label,
  products,
  selected,
  onSelect,
  disabled,
  references,
}: {
  label: string;
  products: readonly Product[];
  selected: ProductSelection | undefined;
  onSelect: (product: Product) => void;
  disabled?: boolean;
  references: readonly Reference[];
}) {
  const [search, setSearch] = useState('');
  const city = (id: string) =>
    references.find((ref) => ref.kind === 'city' && ref.id === id)?.name ??
    'شهر انتخاب نشده';
  const text = (p: Product) => {
    const first = p.definition.segments[0]!;
    const last = p.definition.segments.at(-1)!;
    return `${p.definition.title} • ${first.flightNumber} • ${city(first.originCityId)} ← ${city(last.destinationCityId)} • ${displayTime(first.departureAt)}`;
  };
  const normalize = (value: string) =>
    value
      .normalize('NFKC')
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .toLocaleLowerCase('fa-IR');
  const rows = products.filter((p) =>
    normalize(text(p)).includes(normalize(search.trim())),
  );
  return (
    <fieldset
      disabled={disabled}
      className="min-w-0 space-y-3 rounded-xl border p-3 disabled:opacity-60"
    >
      <legend className="px-2 font-semibold">{label}</legend>
      <Input
        aria-label={`جست‌وجوی ${label}`}
        placeholder="نام بلیت، شماره پرواز یا شهر…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {rows.map((product) => (
          <Button
            key={product.id}
            type="button"
            variant={selected?.productId === product.id ? 'primary' : 'outline'}
            className="h-auto min-h-11 w-full whitespace-normal justify-start text-start"
            aria-pressed={selected?.productId === product.id}
            onClick={() => onSelect(product)}
          >
            {text(product)}
          </Button>
        ))}
        {!rows.length ? (
          <p role="status" className="text-sm">
            {disabled
              ? 'ابتدا بلیت رفت را انتخاب کنید.'
              : 'بلیت منطبق در این پیش‌نمایش وجود ندارد.'}
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}
export function JourneyPreview({
  products,
  references,
}: {
  products: readonly Product[];
  references: readonly Reference[];
}) {
  const [type, setType] = useState<TripType>('one-way');
  const [outbound, setOutbound] = useState<ProductSelection>();
  const [inbound, setInbound] = useState<ProductSelection>();
  const [checked, setChecked] = useState(false);
  const out = products.find(
    (p) =>
      p.id === outbound?.productId && p.version === outbound.productVersion,
  );
  let message = '';
  if (outbound) {
    try {
      composePreviewJourney(products, type, outbound, inbound);
    } catch (error) {
      message = error instanceof Error ? error.message : 'ترکیب معتبر نیست.';
    }
  }
  const pick = (p: Product): ProductSelection => ({
    productId: p.id,
    productVersion: p.version,
  });
  return (
    <Card className="min-w-0 space-y-4 p-4">
      <h2 className="font-bold">انتخاب بلیت یک‌طرفه یا رفت‌وبرگشت</h2>
      <p className="text-sm leading-7 text-muted-foreground">
        پیش‌نمایش ترکیب سفر: هر بلیت رفت و برگشت به‌تنهایی هم قابل انتخاب است.
        ترکیب دو بلیت، محصول یا ظرفیت جدید نمی‌سازد. قیمت فروش در فروش تعیین
        می‌شود؛ این بخش فروش یا رزرو واقعی ثبت نمی‌کند.
      </p>
      <div role="group" aria-label="نوع سفر" className="flex flex-wrap gap-2">
        {(
          [
            ['one-way', 'یک‌طرفه'],
            ['round-trip', 'رفت‌وبرگشت'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={type === value ? 'primary' : 'outline'}
            aria-pressed={type === value}
            onClick={() => {
              setType(value);
              setInbound(undefined);
              setChecked(false);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <TicketChoice
          label={type === 'one-way' ? 'بلیت مستقل' : 'بلیت رفت'}
          products={previewTripCandidates(products)}
          selected={outbound}
          references={references}
          onSelect={(p) => {
            setOutbound(pick(p));
            setInbound(undefined);
            setChecked(false);
          }}
        />
        {type === 'round-trip' ? (
          <TicketChoice
            key={outbound?.productId}
            label="بلیت برگشت"
            products={out ? previewTripCandidates(products, out) : []}
            selected={inbound}
            references={references}
            disabled={!out}
            onSelect={(p) => {
              setInbound(pick(p));
              setChecked(false);
            }}
          />
        ) : null}
      </div>
      {type === 'round-trip' ? (
        <p className="text-xs text-muted-foreground">
          برگشت‌ها بر اساس مسیر معکوس کشور/شهر یا فرودگاه و زمان بعد از رسیدن
          رفت فیلتر می‌شوند. بلیت فاقد مسیر مشخص را نمی‌توان به‌عنوان برگشت
          تأیید کرد.
        </p>
      ) : null}
      {message ? <Alert tone="warning" title={message} /> : null}
      <Button
        type="button"
        disabled={!outbound || Boolean(message)}
        onClick={() => setChecked(true)}
      >
        بررسی ترکیب پیش‌نمایش
      </Button>
      {checked && !message && outbound ? (
        <Alert
          title="ترکیب پیش‌نمایش معتبر است؛ فروش یا رزرو ثبت نشد."
          description={`${type === 'round-trip' ? 'دو بلیت مستقل' : 'یک بلیت مستقل'} انتخاب شده است. قیمت نهایی باید در قرارداد فروش تعیین شود.`}
        />
      ) : null}
    </Card>
  );
}
