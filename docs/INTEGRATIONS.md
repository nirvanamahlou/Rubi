# معماری یکپارچه‌سازی‌ها

## اصل مرکزی

Website 1 و Website 2 مستقیماً Provider را فراخوانی نمی‌کنند. هرکدام client/channel مستقل
Booking API با credential، scope، Provider/service allowlist، pricing، gateway، currency و
branding خود هستند.

## Provider Adapter Contract

```text
search(criteria, context)
checkPrice(offerRef, context)
checkAvailability(offerRef, context)
createReservation(request, context)
confirmReservation(reservationRef, context)
issue(reservationRef, passengers, context)
cancel(reservationRef, reason, context)
refund(documentRef, request, context)
getStatus(externalRef, context)
```

Capability matrix صریح است؛ adapter متدی را که Provider پشتیبانی نمی‌کند با خطای پایدار
`CAPABILITY_NOT_SUPPORTED` رد می‌کند، نه شبیه‌سازی موفقیت. DTO داخلی Provider-neutral است؛
raw code/field در infrastructure باقی می‌ماند.

## کنترل قابلیت اطمینان

- timeout برای connect/read/overall؛ retry فقط عملیات safe یا idempotent و با backoff+jitter
- circuit breaker per connection/operation و health state قابل مشاهده
- rate limit/bulkhead برای محافظت از Provider و CRM
- idempotency key داخلی و در صورت امکان Provider key؛ status reconciliation پیش از retry مبهم
- request/response log redacted با correlation و retention محدود
- external mapping برای entity/refها؛ sandbox و production connection جدا

## Search و Cache

cache کوتاه Redis با key شامل channel/provider/criteria/currency و TTL متناسب. offer ref امضا/
opaque و دارای expiry است؛ قبل از پرداخت price/availability recheck الزامی. نتیجه cache شده
تعهد قیمت/موجودی نیست.

## Payment Gateway

- server creates intent؛ browser فقط redirect/tokenized flow
- callback signature/amount/currency/merchant/order و transaction identity verify می‌شود.
- callback تکراری inbox/idempotent؛ redirect موفق مشتری اثبات پرداخت نیست.
- state مبهم با query/reconciliation job حل می‌شود.
- card number/CVV ذخیره یا log نمی‌شود.

## Webhook و Sync

webhook ابتدا validate، persist/dedupe و سریع acknowledge می‌شود؛ processing در queue. event
خارج ترتیب با provider occurredAt/version و status query کنترل می‌شود. Dead-letter نیازمند alert،
manual replay مجاز و audit است.

## اتصال‌های برنامه‌ریزی‌شده

| نوع | کاربرد | وضعیت Bootstrap |
|---|---|---|
| Website 1/2 | search/order/payment status/document delivery | مشخصات باز |
| Flight/Bus/Hotel/Tour/Insurance | search/book/issue/cancel/refund | Providerهای موج اول باز |
| SMS/Email | notification/campaign/document link | vendor و consent policy باز |
| Payment | intent/callback/refund/reconciliation | gateway و SLA باز |
| Accounting | export/journal mapping/status | مرز قانونی و contract باز |
| Object Storage | file/document binary | MinIO local، production target باز |

## سناریوی پرداخت موفق/صدور ناموفق

پرداخت verified و journal/outbox حفظ؛ Orders به `ISSUE_PENDING` می‌رود. Worker با status check
و retry محدود اقدام می‌کند. پس از threshold، `ISSUE_FAILED`، task فوری، notification و گزینه
manual follow-up/refund approval ایجاد می‌شود. هیچ retry کور برای issue/refund مجاز نیست.

## تست Adapter

contract fixture مشترک، mock/sandbox، timeout، malformed response، partial success، duplicate/
late webhook، price change، unavailable، ambiguous booking، issue failure و refund failure.
Credential واقعی در test یا Repository استفاده نمی‌شود.
