# Data Dictionary اولیه

این واژه‌نامه نام مفهومی را تثبیت می‌کند؛ type/length دقیق در Prisma schema مرحله
Foundation مشخص می‌شود. همه entityهای پایدار audit fields متناسب دارند.

## Identity، سازمان و تنظیمات

| Entity/Table پیشنهادی | کلید/فیلدهای هسته | ارتباط و قاعده |
|---|---|---|
| `users` | id, email/username, password_hash, status, branch_id, manager_id | credential امن؛ self-FK مدیر؛ disable به‌جای delete |
| `sessions` | id, user_id, refresh_family_id, token_hash, expires_at, revoked_at | refresh خام ذخیره نمی‌شود؛ reuse detection |
| `roles` / `permissions` | id/code, scope | code یکتا؛ many-to-many با join tables |
| `organizations` | id, legal_name, display_name, tax_ref?, status | profile مشترک برای B2B/Provider |
| `organization_roles` | organization_id, role_code, active dates | نقش چندگانه و pair یکتا |
| `sales_channels` | id, code, site/domain, currency, status | سایت‌ها/clientها مستقل |
| `settings` | id, key, scope_type/id, value_encrypted/json, version | effective config، versioned و audited |

## مشتری، فروش و مارکتینگ

| Entity | کلید/فیلدهای هسته | ارتباط و قاعده |
|---|---|---|
| `customers` | id, type, names, language, status, merged_into_id? | PII محدود؛ merge trace حفظ می‌شود |
| `customer_contacts` | id, customer_id, type, normalized_value, verified_at | mask/encrypt متناسب؛ dedupe signal |
| `customer_consents` | id, customer_id, purpose, channel, status, source, occurred_at | تاریخچه append؛ audience بر آخرین حالت معتبر |
| `customer_relationships` | from_customer_id, to_customer_id, relation_type | همراه/خانواده؛ pair معتبر |
| `leads` | id, source_id, channel_id, campaign_id?, assignee_id, status | conversion customer_id ثبت می‌شود |
| `opportunities` | id, lead/customer_id, stage, probability, amount/currency | stage history و expected close |
| `quotations` | id, opportunity_id, version, totals, status, valid_until | version immutable پس از ارسال |
| `campaigns` | id, code, budget/currency, start/end, status | UTM/attribution مستقل از channel/source |

## سفارش و عملیات سفر

| Entity | کلید/فیلدهای هسته | ارتباط و قاعده |
|---|---|---|
| `travel_orders` | id, order_no, customer_id, channel_id, agent_id, agency_id?, currency, totals, payment_status, booking_status, issue_status, version | aggregate اصلی؛ شماره یکتا در scope |
| `order_items` | id, order_id, service_type, provider_org_id?, buy/sell/tax/discount/commission amounts, status | هر item یک خدمت؛ snapshot مالی |
| `order_passengers` | id, order_id, customer_id?, passenger_type, encrypted identity snapshot | snapshot لازم برای سند، retention-controlled |
| `reservations` | id, order_item_id, source, provider_connection_id?, external_ref?, status, expires_at, version | manual/API؛ external ref scoped |
| `travel_segments` | id, reservation_id, sequence, origin/destination, departure/arrival UTC, carrier/service refs | grain یک segment؛ sequence یکتا |
| `issued_documents` | id, reservation_id, passenger_id?, type, issuer, official_no?, status, current_version_id | شماره رسمی فقط منبع معتبر |
| `provider_operations` | id, order_item_id, connection_id, operation, idempotency_key, attempt, status, request/response refs | log redacted، retry محدود |

## خرید و مالی

| Entity | کلید/فیلدهای هسته | ارتباط و قاعده |
|---|---|---|
| `purchase_orders` | id, po_no, supplier_org_id, source_type, currency, totals, status | سفر یا عمومی؛ approval history |
| `purchase_order_items` | id, purchase_order_id, order_item_id?, description/service, qty, unit/total | فروش و خرید جدا |
| `purchase_invoices` | id, supplier_org_id, invoice_no, dates, totals, status | supplier+invoice_no uniqueness policy |
| `sales_invoices` | id, customer/org, order_id?, invoice_no, dates, totals, status | سند فروش؛ version/void rules |
| `payments` | id, direction, method, account_id, gateway_ref?, amount/currency, verified_at, status | callback unique/idempotent؛ card data ممنوع |
| `payment_allocations` | id, payment_id, target_type/id, amount/currency | polymorphic target باید application/FK strategy امن داشته باشد |
| `refunds` | id, payment_id, order_id?, amount/currency, reason, approval/status | refund gateway و journal trace |
| `financial_accounts` | id, type, bank/cash, currency, organization/branch, status | balance فیلد دستی ندارد |
| `journal_entries` | id, entry_no, source_type/id, effective_at, base_currency, status, reversal_of_id? | source posting یکتا؛ posted immutable |
| `journal_entry_lines` | id, entry_id, account_id, debit, credit, currency, foreign_amount?, fx_rate? | entry balanced؛ debit xor credit |
| `checks` | id, direction, numbers, bank/branch, amount/currency, issue/due dates, counterparty, status | status history و reminder |

## پشتیبانی، task، سند و integration

| Entity | کلید/فیلدهای هسته | ارتباط و قاعده |
|---|---|---|
| `support_tickets` | id, ticket_no, customer_id, order_id?, category, priority, SLA dates, status, assignee | linkهای تکمیلی با relation table |
| `tasks` | id, subject, assignee_id, due_at, priority, status, source_type/id | manual/automation؛ recurrence/checklist |
| `automation_rules` / `automation_runs` | trigger, condition/action version, status/result | rule version برای reproducibility |
| `file_objects` | id, storage_key, checksum, media_type, size, classification, status | binary خارج DB؛ key غیرقابل حدس |
| `file_links` | file_id, entity_type/id, purpose, access level | authorization بر entity owner |
| `document_versions` | id, document_id, version, template_version, file_id, generated_by/at | نسخه immutable و current pointer |
| `provider_connections` | id, organization_id, environment, credential_ref, capabilities, health | sandbox/prod جدا؛ secret reference |
| `external_mappings` | connection_id, entity_type, external_id, internal_type/id | external tuple یکتا؛ canonical internal mapping |
| `webhook_events` | id, connection/client, external_event_id, signature_status, payload_ref, processing_status | raw payload encrypted/redacted و dedupe |
| `audit_events` | id, actor, action, entity, redacted change, reason, trace, occurred_at | append-only منطقی؛ retention policy |
| `report_runs` | id, definition, filters, permission_snapshot, requested_by, status, file_id? | background export و audit |

## Value Objectها و Enumهای نیازمند تثبیت

- `Money { amount: Decimal, currencyCode: ISO-4217 }`
- `ExchangeRateSnapshot { rate, from, to, kind, source, observedAt }`
- `DateRange`, `ContactValue`, `DocumentNumber`, `ExternalReference`, `IdempotencyKey`
- status enumهای order/payment/reservation/issue/invoice/check/ticket/task باید state machine و
  transition table داشته باشند، نه تغییر آزاد رشته.

## موارد باز پیش از schema

- precision/scale و rounding برای IRR و ارز خارجی
- strategy FK برای linkهای چندنوعی (typed link tables در برابر registry)
- tenant/company scope در صورت چندشرکتی‌شدن آینده
- searchable encryption و retention مدارک/تماس
- chart of accounts و mapping حسابداری قانونی
- numbering scope (company/year/branch/channel) برای Order/Invoice/Receipt
