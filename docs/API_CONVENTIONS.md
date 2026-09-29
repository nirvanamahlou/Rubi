# قرارداد API

## اصول

- REST JSON روی HTTPS، prefix نسخه `/api/v1`; breaking change نسخه جدید می‌خواهد.
- OpenAPI منبع قرارداد قابل تولید است؛ DTOها با Zod/ValidationPipe در boundary validate.
- نام resource و field انگلیسی `camelCase` در JSON و شناسه‌ها opaque هستند.
- تاریخ RFC 3339 UTC، مبلغ به‌صورت string decimal همراه `currencyCode` برگردد.
- timezone/تاریخ شمسی مسئول presentation است؛ API canonical Gregorian/UTC می‌ماند.

## الگوی endpoint

```text
GET    /api/v1/customers/{customerId}
POST   /api/v1/sales-contracts
POST   /api/v1/sales-contracts/{contractId}/passenger-service-allocations
POST   /api/v1/sales-contracts/{contractId}/actions/request-availability
POST   /api/v1/reservation-executions/{executionId}/actions/issue
POST   /api/v1/reservation-operations/{operationId}/purchase-requests
POST   /api/v1/manifests/{manifestId}/actions/send
POST   /api/v1/financial-releases/{releaseId}/actions/authorize
POST   /api/v1/booking/searches
POST   /api/v1/webhooks/payments/{connectionCode}
```

Commandهای state transition action صریح دارند و update آزاد status با PATCH ممنوع است.

## پاسخ و خطا

موفقیت single resource: `{ "data": {...}, "meta": { "requestId": "..." } }`.

خطا:

```json
{
  "error": {
    "code": "RESERVATION_PRICE_CHANGED",
    "message": "The offer price has changed.",
    "details": [{ "field": "offerId", "reason": "expired" }],
    "retryable": false
  },
  "meta": { "requestId": "req_...", "traceId": "..." }
}
```

کدها پایدار و machine-readable؛ message قابل ترجمه است. `400` validation، `401`
unauthenticated، `403` denied، `404` unavailable/not found، `409` conflict/idempotency/state،
`422` business validation، `429` rate limit، `502/503/504` dependency failure. stack/raw Provider
response یا PII در پاسخ نمایش داده نمی‌شود.

## Pagination، filter و sort

- list پرتغییر: cursor opaque با `limit` حداکثر کنترل‌شده و `nextCursor`.
- گزارش/جدول stable می‌تواند page/size با total محاسبه‌شده یا async داشته باشد.
- allowlist برای filter/sort؛ wildcard جست‌وجوی پرهزینه و sort دلخواه DB ممنوع.
- filterهای export/report دقیقاً snapshot و audit می‌شوند.

## Idempotency و concurrency

- `Idempotency-Key` برای create contract، capacity hold/confirm/release، purchase request،
  payment، booking/issue/cancel/refund، insurance policy و manifest send الزامی است.
- scope کلید = authenticated client/user + operation؛ request hash متفاوت با همان کلید `409`.
- پاسخ موفق/قابل تکرار برای مدت مصوب replay می‌شود.
- webhook با external event/transaction ID و signature dedupe می‌شود.
- aggregateهای حساس `version`/ETag دارند؛ conflict stale با `409 CONCURRENT_MODIFICATION`.

## Authentication/Authorization

- staff: access JWT کوتاه‌عمر و refresh rotation؛ cookie امن یا storage strategy مصوب.
- websites/system clients: credential مستقل، audience/scope محدود، rotation و rate limit جدا.
- Provider webhook: signature/mTLS/IP allowlist در صورت قابلیت Provider؛ replay window.
- authorization در use-case علاوه بر route guard و با branch/org/ownership scope اعمال می‌شود.

## Async operation

کار طولانی `202 Accepted` با `operationId` می‌دهد. endpoint وضعیت، progress محدود، result/
failure code و expiry دارد. queue retry داخلی نباید باعث درخواست تکراری مالی شود.

## قراردادهای مرزی دامنه سفر

- فقط Sales مجاز به command تغییر contract party/passenger/service allocation است.
- Reservations فقط contract execution snapshot versioned را مصرف و correction request تولید می‌کند.
- Ticket Catalog فقط query محصول/قیمت/ظرفیت و commandهای versioned inventory منتشر می‌کند؛
  endpoint صدور passenger document ندارد.
- Reservations درخواست خرید را از public Procurement port ایجاد می‌کند؛ repository یا جدول
  Procurement قابل import/query مستقیم نیست.
- Finance تنها مرجع `financialReleaseStatus` است؛ Sales پس از authorization مجاز به دریافت
  signed URL و ثبت delivery می‌شود.
- DTO/Eventهای این جریان مطابق
  [TRAVEL_WORKFLOW_ARCHITECTURE.md](TRAVEL_WORKFLOW_ARCHITECTURE.md) version می‌شوند.

## Versioning و deprecation

OpenAPI diff و consumer contract test در CI. field افزوده backward-compatible؛ حذف/تغییر
semantic با version. deprecation header و زمان مهاجرت ثبت می‌شود. Eventها version مستقل دارند.

## Correlation و audit

`X-Request-Id` پذیرفته/تولید و trace در queue/provider propagate می‌شود. actor، client،
action و reason عملیات حساس audit می‌شود؛ headerها و payload حساس redacted هستند.
