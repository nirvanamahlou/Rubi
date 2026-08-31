// Phase A pure proposal; mirrored in Web until a shared-contract handoff.
// No persistence, permission grant, provider call or transaction guarantee.
export type CatalogStatus = 'draft' | 'active' | 'paused' | 'cancelled';
export type SupplyType = 'company' | 'allotment' | 'charter' | 'supplier';
export type ReferenceKind =
  'airline' | 'airport' | 'aircraft' | 'flightClass' | 'baggage' | 'currency';
export interface Reference {
  id: string;
  kind: ReferenceKind;
  name: string;
  active: boolean;
  code?: string;
}
export type ReferenceResolver = (
  kind: ReferenceKind,
  id: string,
) => Reference | undefined;
export interface Segment {
  airlineId: string;
  aircraftId: string;
  flightNumber: string;
  originAirportId: string;
  destinationAirportId: string;
  departureAt: string;
  arrivalAt: string;
  departureZone: string;
  arrivalZone: string;
}
export interface FareInput {
  purchase: string;
  sale: string;
  fee: string;
  commission: string;
  currencyId: string;
  currencyCode: string;
  validFrom: string;
  validTo: string;
}
export interface ProductInput {
  title: string;
  transport: 'flight';
  segments: readonly Segment[];
  flightClassId: string;
  baggageId: string;
  supplyType: SupplyType;
  companyOwned: boolean;
  entryMethod: 'manual' | 'api';
  totalCapacity: number;
  rules: string;
  fare: FareInput;
}
export interface FareVersion extends FareInput {
  version: number;
  createdAt: string;
}
export interface Product {
  id: string;
  version: number;
  status: CatalogStatus;
  definition: ProductInput;
  fares: readonly FareVersion[];
  definitions: readonly {
    version: number;
    definition: ProductInput;
    createdAt: string;
  }[];
  history: readonly {
    version: number;
    action: string;
    at: string;
    actor: string;
    reason: string;
  }[];
}
export class CatalogError extends Error {
  constructor(
    readonly code:
      'VALIDATION' | 'CONFLICT' | 'REFERENCE' | 'CAPACITY' | 'TRANSITION',
    message: string,
  ) {
    super(message);
    this.name = 'CatalogError';
  }
}
function ensure(
  value: unknown,
  message: string,
  code: CatalogError['code'] = 'VALIDATION',
): asserts value {
  if (!value) throw new CatalogError(code, message);
}
export function decimal(value: string): string {
  ensure(
    typeof value === 'string' && /^(0|[1-9]\d{0,17})(\.\d{1,6})?$/.test(value),
    'مبلغ باید رشته Decimal غیرمنفی با حداکثر ۱۸ رقم صحیح و ۶ رقم اعشار باشد.',
  );
  const [whole, fraction = ''] = value.split('.');
  const trimmed = fraction.replace(/0+$/, '');
  return trimmed ? `${whole}.${trimmed}` : whole!;
}
export function addMoney(a: string, b: string): string {
  const units = (value: string) => {
    const [whole, part = ''] = decimal(value).split('.');
    return BigInt(whole!) * 1000000n + BigInt(part.padEnd(6, '0'));
  };
  const sum = units(a) + units(b);
  return decimal(
    `${sum / 1000000n}.${(sum % 1000000n).toString().padStart(6, '0')}`,
  );
}
export function utc(value: string): string {
  ensure(
    typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value),
    'زمان باید ISO UTC با Z باشد.',
  );
  const time = new Date(value);
  ensure(
    Number.isFinite(time.getTime()) &&
      time.toISOString().replace('.000Z', 'Z') === value.replace('.000Z', 'Z'),
    'تاریخ یا ساعت نامعتبر است.',
  );
  return time.toISOString();
}
export function validZone(zone: string): void {
  ensure(Boolean(zone), 'منطقه زمانی الزامی است.');
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone }).format(0);
  } catch {
    throw new CatalogError('VALIDATION', 'منطقه زمانی معتبر IANA لازم است.');
  }
}
// The picker supplies Gregorian wall time. Explicit offset disambiguates DST;
// checking it against the IANA zone rejects nonexistent times and wrong offsets.
export function wallTimeToUtc(
  wall: string,
  zone: string,
  offset: string,
): string {
  validZone(zone);
  ensure(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(wall),
    'تاریخ و ساعت محلی کامل لازم است.',
  );
  ensure(
    /^[+-](0\d|1[0-4]):[0-5]\d$/.test(offset) &&
      (!offset.includes('14:') || offset.endsWith(':00')),
    'اختلاف ساعت UTC نامعتبر است.',
  );
  const date = new Date(`${wall}:00${offset}`);
  ensure(Number.isFinite(date.getTime()), 'زمان محلی نامعتبر است.');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  ensure(
    `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}` ===
      wall,
    'این زمان یا اختلاف UTC با منطقه زمانی سازگار نیست (تغییر ساعت تابستانی را بررسی کنید).',
  );
  return date.toISOString();
}
function count(value: number): void {
  ensure(
    Number.isSafeInteger(value) && value >= 0,
    'ظرفیت باید عدد صحیح غیرمنفی و ایمن باشد.',
    'CAPACITY',
  );
}
export interface Allocation {
  id: string;
  quantity: number;
  state: 'held' | 'confirmed' | 'released';
}
export interface Inventory {
  total: number;
  version: number;
  allocations: readonly Allocation[];
}
export function inventoryTotals(inventory: Inventory) {
  count(inventory.total);
  count(inventory.version);
  const ids = new Set<string>();
  let held = 0;
  let confirmed = 0;
  for (const allocation of inventory.allocations) {
    ensure(
      allocation.id && !ids.has(allocation.id),
      'تخصیص تکراری یا فاقد شناسه است.',
      'CAPACITY',
    );
    ids.add(allocation.id);
    count(allocation.quantity);
    ensure(allocation.quantity > 0, 'تعداد تخصیص باید مثبت باشد.', 'CAPACITY');
    ensure(
      ['held', 'confirmed', 'released'].includes(allocation.state),
      'وضعیت تخصیص نامعتبر است.',
      'CAPACITY',
    );
    if (allocation.state === 'held') held += allocation.quantity;
    if (allocation.state === 'confirmed') confirmed += allocation.quantity;
  }
  ensure(
    Number.isSafeInteger(held + confirmed) &&
      held + confirmed <= inventory.total,
    'ظرفیت کمتر از تخصیص‌ها است؛ فروش بیش از ظرفیت مجاز نیست.',
    'CAPACITY',
  );
  return {
    total: inventory.total,
    held,
    confirmed,
    remaining: inventory.total - held - confirmed,
  };
}
export function resizeInventory(
  inventory: Inventory,
  total: number,
  expectedVersion: number,
): Inventory {
  checkVersion(inventory.version, expectedVersion);
  const next = { ...inventory, total, version: inventory.version + 1 };
  inventoryTotals(next);
  return next;
}
// Reservations owns commands. This pure reducer is the inventory invariant
// proposal ONLY; caller must atomically authorize, deduplicate and persist.
export function applyAllocation(
  inventory: Inventory,
  command: {
    action: 'hold' | 'confirm' | 'release';
    allocationId: string;
    quantity?: number;
  },
  expectedVersion: number,
): Inventory {
  checkVersion(inventory.version, expectedVersion);
  inventoryTotals(inventory);
  const existing = inventory.allocations.find(
    (item) => item.id === command.allocationId,
  );
  let allocations: readonly Allocation[];
  if (command.action === 'hold') {
    ensure(!existing, 'شناسه تخصیص قبلاً استفاده شده است.', 'CONFLICT');
    ensure(
      command.allocationId && command.quantity !== undefined,
      'شناسه و تعداد Hold الزامی است.',
      'CAPACITY',
    );
    allocations = [
      ...inventory.allocations,
      { id: command.allocationId, quantity: command.quantity, state: 'held' },
    ];
  } else {
    ensure(existing, 'تخصیص وجود ندارد.', 'CAPACITY');
    ensure(
      command.action === 'confirm' || command.action === 'release',
      'فرمان نامعتبر است.',
    );
    ensure(
      existing.state === 'held',
      'فقط Hold باز قابل تأیید یا آزادسازی است؛ برگشت قطعی نیازمند قرارداد مستقل است.',
      'TRANSITION',
    );
    allocations = inventory.allocations.map((item) =>
      item.id === existing.id
        ? {
            ...item,
            state:
              command.action === 'confirm'
                ? ('confirmed' as const)
                : ('released' as const),
          }
        : item,
    );
  }
  const next = { ...inventory, version: inventory.version + 1, allocations };
  inventoryTotals(next);
  return next;
}
export function checkVersion(actual: number, expected: number): void {
  ensure(
    Number.isSafeInteger(actual) &&
      actual >= 0 &&
      actual < Number.MAX_SAFE_INTEGER &&
      actual === expected,
    'نسخه تغییر کرده است؛ داده تازه را باز کنید.',
    'CONFLICT',
  );
}
function reference(
  resolve: ReferenceResolver,
  kind: ReferenceKind,
  id: string,
  required: boolean,
) {
  if (!id) {
    ensure(
      !required,
      'مرجع ' + kind + ' هنوز انتخاب یا منتشر نشده است.',
      'REFERENCE',
    );
    return;
  }
  const value = resolve(kind, id);
  ensure(
    value && value.id === id && value.kind === kind && value.active,
    'مرجع ' + kind + ' نامعتبر، غیرفعال یا در دسترس نیست.',
    'REFERENCE',
  );
  return value;
}
export function validateProduct(
  input: ProductInput,
  resolve: ReferenceResolver,
  ready = false,
): void {
  ensure(
    input.title.trim().length > 0 && input.title.length <= 160,
    'عنوان برنامه الزامی و حداکثر ۱۶۰ نویسه است.',
  );
  ensure(
    input.transport === 'flight',
    'مرحله نخست فقط پرواز را پشتیبانی می‌کند.',
  );
  ensure(
    input.segments.length > 0 && input.segments.length <= 8,
    'برنامه باید بین یک تا هشت قطعه داشته باشد.',
  );
  count(input.totalCapacity);
  ensure(
    ['company', 'allotment', 'charter', 'supplier'].includes(input.supplyType),
    'نوع تأمین نامعتبر است.',
  );
  ensure(
    input.companyOwned === (input.supplyType === 'company'),
    'گزینه ظرفیت شرکت باید با نوع تأمین سازگار باشد.',
  );
  ensure(
    ['manual', 'api'].includes(input.entryMethod),
    'روش ورود نامعتبر است.',
  );
  ensure(input.rules.length <= 4000, 'شرایط محصول حداکثر ۴۰۰۰ نویسه است.');
  let previous: Segment | undefined;
  for (const segment of input.segments) {
    ensure(
      /^[A-Za-z0-9][A-Za-z0-9 -]{0,11}$/.test(segment.flightNumber),
      'شماره پرواز معتبر (حداکثر ۱۲ نویسه) لازم است.',
    );
    validZone(segment.departureZone);
    validZone(segment.arrivalZone);
    const departure = utc(segment.departureAt);
    const arrival = utc(segment.arrivalAt);
    ensure(
      arrival > departure,
      'رسیدن باید بعد از حرکت باشد؛ تاریخ عبور از نیمه‌شب را اصلاح کنید.',
    );
    ensure(
      !segment.originAirportId ||
        !segment.destinationAirportId ||
        segment.originAirportId !== segment.destinationAirportId,
      'مبدأ و مقصد نباید یکسان باشند.',
    );
    if (previous) {
      ensure(
        departure >= utc(previous.arrivalAt),
        'قطعه بعدی پیش از رسیدن قطعه قبلی شروع می‌شود.',
      );
      ensure(
        !previous.destinationAirportId ||
          !segment.originAirportId ||
          previous.destinationAirportId === segment.originAirportId,
        'اتصال مسیر قطعه‌ها نامعتبر است.',
      );
    }
    reference(resolve, 'airline', segment.airlineId, ready);
    reference(resolve, 'aircraft', segment.aircraftId, ready);
    reference(resolve, 'airport', segment.originAirportId, ready);
    reference(resolve, 'airport', segment.destinationAirportId, ready);
    previous = segment;
  }
  reference(resolve, 'flightClass', input.flightClassId, ready);
  reference(resolve, 'baggage', input.baggageId, ready);
  const currency = reference(resolve, 'currency', input.fare.currencyId, ready);
  ensure(
    !input.fare.currencyCode || /^[A-Z]{3}$/.test(input.fare.currencyCode),
    'کد ارز باید سه حرف بزرگ باشد.',
  );
  if (currency)
    ensure(
      currency.code === input.fare.currencyCode,
      'کد ارز با مرجع انتخابی تطابق ندارد.',
      'REFERENCE',
    );
  for (const amount of [
    input.fare.purchase,
    input.fare.sale,
    input.fare.fee,
    input.fare.commission,
  ])
    decimal(amount);
  ensure(
    utc(input.fare.validTo) > utc(input.fare.validFrom),
    'پایان اعتبار نرخ باید بعد از شروع آن باشد.',
  );
  ensure(
    utc(input.fare.validTo) <= utc(input.segments[0]!.departureAt),
    'اعتبار فروش نباید پس از حرکت اولین پرواز باشد.',
  );
}
function history(
  version: number,
  action: string,
  at: string,
  actor: string,
  reason: string,
) {
  ensure(actor.trim() && reason.trim(), 'ثبت‌کننده و دلیل تغییر لازم است.');
  return { version, action, at: utc(at), actor, reason };
}
export function createProduct(
  id: string,
  input: ProductInput,
  resolve: ReferenceResolver,
  at: string,
  actor: string,
): Product {
  ensure(id.trim(), 'شناسه برنامه الزامی است.');
  validateProduct(input, resolve);
  return {
    id,
    version: 1,
    status: 'draft',
    definition: structuredClone(input),
    fares: [{ ...input.fare, version: 1, createdAt: utc(at) }],
    definitions: [
      { version: 1, definition: structuredClone(input), createdAt: utc(at) },
    ],
    history: [history(1, 'create', at, actor, 'ایجاد پیش‌نویس')],
  };
}
export function reviseProduct(
  product: Product,
  input: ProductInput,
  expectedVersion: number,
  resolve: ReferenceResolver,
  at: string,
  actor: string,
  reason: string,
  inventory: Inventory,
): Product {
  checkVersion(product.version, expectedVersion);
  ensure(
    product.status === 'draft' || product.status === 'paused',
    'برای ویرایش ابتدا فروش را متوقف کنید.',
    'TRANSITION',
  );
  validateProduct(input, resolve);
  ensure(
    inventory.total === product.definition.totalCapacity,
    'Snapshot ظرفیت با برنامه سازگار نیست.',
    'CONFLICT',
  );
  const totals = inventoryTotals(inventory);
  if (totals.held + totals.confirmed > 0) {
    ensure(
      JSON.stringify(input.segments) ===
        JSON.stringify(product.definition.segments) &&
        input.supplyType === product.definition.supplyType &&
        input.flightClassId === product.definition.flightClassId &&
        input.baggageId === product.definition.baggageId &&
        input.rules === product.definition.rules,
      'تغییر برنامه تخصیص‌یافته منتظر Handoff رزرواسیون است.',
      'TRANSITION',
    );
  }
  resizeInventory(inventory, input.totalCapacity, inventory.version);
  const fareChanged =
    JSON.stringify(input.fare) !== JSON.stringify(product.definition.fare);
  return {
    ...product,
    version: product.version + 1,
    definition: structuredClone(input),
    definitions: [
      ...product.definitions,
      {
        version: product.version + 1,
        definition: structuredClone(input),
        createdAt: utc(at),
      },
    ],
    fares: fareChanged
      ? [
          ...product.fares,
          {
            ...input.fare,
            version: product.fares.length + 1,
            createdAt: utc(at),
          },
        ]
      : product.fares,
    history: [
      ...product.history,
      history(product.version + 1, 'revise', at, actor, reason),
    ],
  };
}
export const transitions: Record<CatalogStatus, readonly CatalogStatus[]> = {
  draft: ['active', 'cancelled'],
  active: ['paused'],
  paused: ['active', 'cancelled'],
  cancelled: [],
};
export function transitionProduct(
  product: Product,
  status: CatalogStatus,
  expectedVersion: number,
  resolve: ReferenceResolver,
  at: string,
  actor: string,
  reason: string,
  inventory: Inventory,
): Product {
  checkVersion(product.version, expectedVersion);
  ensure(
    transitions[product.status].includes(status),
    'این انتقال وضعیت مجاز نیست.',
    'TRANSITION',
  );
  ensure(
    inventory.total === product.definition.totalCapacity,
    'Snapshot ظرفیت ناسازگار است.',
    'CONFLICT',
  );
  const totals = inventoryTotals(inventory);
  if (status === 'active') {
    validateProduct(product.definition, resolve, true);
    ensure(
      totals.total > 0 &&
        utc(at) >= utc(product.definition.fare.validFrom) &&
        utc(at) < utc(product.definition.fare.validTo),
      'ظرفیت مثبت و نرخ معتبر برای فعال‌سازی لازم است.',
    );
  }
  if (status === 'cancelled')
    ensure(
      totals.held + totals.confirmed === 0,
      'لغو برنامه دارای تخصیص نیازمند هماهنگی رزرواسیون است.',
      'CAPACITY',
    );
  return {
    ...product,
    status,
    version: product.version + 1,
    history: [
      ...product.history,
      history(product.version + 1, status, at, actor, reason),
    ],
  };
}
export function copyProduct(
  product: Product,
  id: string,
  resolve: ReferenceResolver,
  at: string,
  actor: string,
): Product {
  ensure(id !== product.id, 'کپی باید شناسه جدید داشته باشد.');
  return createProduct(
    id,
    { ...product.definition, title: product.definition.title + ' — کپی' },
    resolve,
    at,
    actor,
  );
}
