# Data Dictionary اولیه

این واژه‌نامه نام مفهومی را تثبیت می‌کند؛ type/length دقیق در Prisma schema مرحله
Foundation مشخص می‌شود. همه entityهای پایدار audit fields متناسب دارند.

## Identity، سازمان و تنظیمات

| Entity/Table پیشنهادی   | کلید/فیلدهای هسته                                                  | ارتباط و قاعده                                                                |
| ----------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `users`                 | id, email/username, password_hash, status, access_branch_scope?    | credential امن؛ scope دسترسی جدا از assignment استخدام؛ disable به‌جای delete |
| `sessions`              | id, user_id, refresh_family_id, token_hash, expires_at, revoked_at | refresh خام ذخیره نمی‌شود؛ reuse detection                                    |
| `roles` / `permissions` | id/code, scope                                                     | code یکتا؛ many-to-many با join tables                                        |
| `organizations`         | id, legal_name, display_name, tax_ref?, status                     | profile مشترک برای B2B/Provider                                               |
| `organization_roles`    | organization_id, role_code, active dates                           | نقش چندگانه و pair یکتا                                                       |
| `sales_channels`        | id, code, site/domain, currency, status                            | سایت‌ها/clientها مستقل                                                        |
| `settings`              | id, key, scope_type/id, value_encrypted/json, version              | effective config، versioned و audited                                         |

## مشتری، فروش و مارکتینگ

| Entity                   | کلید/فیلدهای هسته                                              | ارتباط و قاعده                               |
| ------------------------ | -------------------------------------------------------------- | -------------------------------------------- |
| `customers`              | id, type, names, language, status, merged_into_id?             | PII محدود؛ merge trace حفظ می‌شود            |
| `customer_contacts`      | id, customer_id, type, normalized_value, verified_at           | mask/encrypt متناسب؛ dedupe signal           |
| `customer_consents`      | id, customer_id, purpose, channel, status, source, occurred_at | تاریخچه append؛ audience بر آخرین حالت معتبر |
| `customer_relationships` | from_customer_id, to_customer_id, relation_type                | همراه/خانواده؛ pair معتبر                    |
| `customer_requests`      | id, customer_id?, source/channel, assignee_id, status          | مالک Customer Affairs؛ handoff به Sales      |
| `leads`                  | id, request_id?, source_id, channel_id, campaign_id?, status   | qualification و conversion history           |
| `sales_cases`            | id, lead/customer_id, owner_id, stage, expected_close          | مالک Sales؛ bridge به quotation/contract     |
| `quotations`             | id, sales_case_id, version, totals, status, valid_until        | version immutable پس از ارسال                |
| `sales_contracts`        | id, contract_no, sales_case_id?, payer/customer refs, status, current_version | فعال‌سازی snapshot و outbox اتمیک |
| `sales_contract_versions` | id, contract_id, version, totals/currency, terms, valid range | amendment نسخه جدید؛ immutable پس از تایید   |
| `contract_passengers`    | id, contract_id, customer_id?, identity_snapshot_ref          | فقط Sales تغییر می‌دهد                        |
| `contract_service_items` | id, contract_version_id, service_type, sell/tax/discount amounts, status | تعهد فروش؛ خرید/اجرا جدا             |
| `passenger_service_allocations` | contract_passenger_id, service_item_id, room/seat/request snapshot | اتصال passenger/service فقط Sales  |
| `campaigns`              | id, code, budget/currency, start/end, status                   | UTM/attribution مستقل از channel/source      |

## تعریف بلیت و عملیات رزرواسیون

| Entity | کلید/فیلدهای هسته | ارتباط و قاعده |
| --- | --- | --- |
| `ticket_products` | id, service_type, source_type, airline/ref, route, status | محصول قابل فروش؛ صدور passenger ندارد |
| `flight_departures` | id, ticket_product_id, flight_no, departure/arrival UTC, terminal/class/baggage refs | برنامه versioned |
| `ticket_fare_versions` | id, departure_id, version, buy/sell/currency/markup, valid range | تغییر قیمت تاریخچه دارد |
| `ticket_inventories` | departure_id, total, held, confirmed, sold, version | منفی/oversell ممنوع؛ optimistic lock |
| `availability_requests` | id, sales_contract_id, requested_version, status, expires_at | Sales ایجاد؛ Reservation پاسخ می‌دهد |
| `capacity_holds` | id, inventory/service ref, request_id, qty, expires_at, status, idempotency_key | hold/confirm/release اتمیک |
| `reservation_executions` | id, sales_contract_id, contract_version, snapshot_ref, status | snapshot فقط‌خواندنی |
| `reservation_operations` | id, execution_id, contract_service_item_id, operation_type, provider_ref?, status, version | اجرای هر خدمت |
| `issued_travel_documents` | id, operation_id, contract_passenger_id?, type, issuer, official_no?, status, current_version_id | شماره رسمی فقط منبع معتبر |
| `manifests` / `manifest_versions` | flight_departure_id, version, template_ref, status, generated/sent/ack timestamps | مالک Reservations؛ نسخه immutable |
| `manifest_passengers` | manifest_version_id, contract_passenger_id, immutable identity snapshot | PII حداقلی و audited export |
| `provider_operations` | id, reservation_operation_id, connection_id, operation, idempotency_key, attempt, status | log redacted، retry محدود |

## خرید و مالی

| Entity                 | کلید/فیلدهای هسته                                                                           | ارتباط و قاعده                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `purchase_requests`    | id, reservation_operation_id?, contract_service_item_id?, supplier_org_id, status           | Reservations ایجاد؛ Procurement مالک state                    |
| `purchase_price_versions` | id, request_id, quoted, supplier_discount, fee/tax, net_amount/currency, version          | net محاسباتی و immutable پس از approval                        |
| `purchase_orders`      | id, po_no, supplier_org_id, source_type, currency, totals, status                           | سفر یا عمومی؛ approval history                                 |
| `purchase_order_items` | id, purchase_order_id, contract_service_item_id?, request_id?, description/service, qty, unit/total | فروش و خرید جدا                                      |
| `purchase_invoices`    | id, supplier_org_id, invoice_no, dates, totals, status                                      | supplier+invoice_no uniqueness policy                          |
| `sales_invoices`       | id, customer/org, sales_contract_id?, invoice_no, dates, totals, status                     | سند فروش؛ version/void rules                                   |
| `payments`             | id, direction, method, account_id, gateway_ref?, amount/currency, verified_at, status       | callback unique/idempotent؛ card data ممنوع                    |
| `payment_allocations`  | id, payment_id, target_type/id, amount/currency                                             | polymorphic target باید application/FK strategy امن داشته باشد |
| `refunds`              | id, payment_id, sales_contract_id?, amount/currency, reason, approval/status                | refund gateway و journal trace                                 |
| `financial_accounts`   | id, type, bank/cash, currency, organization/branch, status                                  | balance فیلد دستی ندارد                                        |
| `journal_entries`      | id, entry_no, source_type/id, effective_at, base_currency, status, reversal_of_id?          | source posting یکتا؛ posted immutable                          |
| `journal_entry_lines`  | id, entry_id, account_id, debit, credit, currency, foreign_amount?, fx_rate?                | entry balanced؛ debit xor credit                               |
| `checks`               | id, direction, numbers, bank/branch, amount/currency, issue/due dates, counterparty, status | status history و reminder                                      |
| `financial_releases`   | id, sales_contract_id, issued_document_id?, policy_snapshot, status, reason, actor/time      | کنترل مشاهده/تحویل سند؛ history اجباری                        |

## منابع انسانی

نام‌ها مفهومی‌اند و پیش از Schema/Migration باید توسط Migration Owner تثبیت شوند.

| Entity                                                | کلید/فیلدهای هسته                                                                     | ارتباط و قاعده                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `employees`                                           | id, personnel_no, user_id?, employment_status, hired_at, ended_at?                    | مستقل از customer/passenger؛ user فقط login اختیاری  |
| `employee_contacts` / `emergency_contacts`            | employee_id, type/name/relation, encrypted contact fields                             | Restricted، دسترسی و export جدا                      |
| `employee_assignments`                                | employee_id, branch_id, department_id, position_id, manager_employee_id?, valid range | تاریخچه شعبه/واحد/سمت/مدیر و چارت سازمانی            |
| `employment_contracts`                                | employee_id, contract_type, start/end, status, terms ref                              | version/history؛ پایان قرارداد reminder می‌سازد      |
| `attendance_records`                                  | employee_id, work_date, check-in/out, source, status                                  | UTC + timezone context؛ correction/approval audit    |
| `shifts` / `shift_assignments`                        | shift definition, employee_id, date range                                             | تقویم/تعطیلات و overlap policy                       |
| `leave_requests` / `mission_requests`                 | employee_id, type, date/time range, reason, approver, status                          | balance/policy و approval history                    |
| `overtime_records`                                    | employee_id, date/time range, approved duration, approver, status                     | فقط داده تاییدشده وارد payroll input می‌شود          |
| `performance_reviews`                                 | employee_id, cycle, reviewer, score/result, status                                    | Confidential/Restricted و permission جدا             |
| `trainings` / `employee_certificates`                 | course/certificate, issuer, issue/expiry, status                                      | reminder انقضا و document link                       |
| `employee_assets`                                     | employee_id, asset ref/serial, delivered/returned dates, condition                    | custody history و receipt document                   |
| `hr_document_links`                                   | employee_id, file_id, purpose, classification, expiry                                 | binary در Documents؛ مجوز semantic در HR             |
| `payroll_input_batches` / `payroll_input_batch_items` | period, employee_id, approved time/leave/overtime and payable inputs, status          | snapshot حداقلی برای Finance؛ نه payroll قانونی کامل |

## پشتیبانی، task، سند و integration

| Entity                                 | کلید/فیلدهای هسته                                                                          | ارتباط و قاعده                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `support_tickets`                      | id, ticket_no, customer_id, sales_contract_id?, category, priority, SLA dates, status, assignee | linkهای تکمیلی با relation table             |
| `tasks`                                | id, subject, assignee_id, due_at, priority, status, source_type/id                         | manual/automation؛ recurrence/checklist         |
| `automation_rules` / `automation_runs` | trigger, condition/action version, status/result                                           | rule version برای reproducibility               |
| `file_objects`                         | id, storage_key, checksum, media_type, size, classification, status                        | binary خارج DB؛ key غیرقابل حدس                 |
| `file_links`                           | file_id, entity_type/id, purpose, access level                                             | authorization بر entity owner                   |
| `document_versions`                    | id, document_id, version, template_version, file_id, generated_by/at                       | نسخه immutable و current pointer                |
| `provider_connections`                 | id, organization_id, environment, credential_ref, capabilities, health                     | sandbox/prod جدا؛ secret reference              |
| `external_mappings`                    | connection_id, entity_type, external_id, internal_type/id                                  | external tuple یکتا؛ canonical internal mapping |
| `webhook_events`                       | id, connection/client, external_event_id, signature_status, payload_ref, processing_status | raw payload encrypted/redacted و dedupe         |
| `audit_events`                         | id, actor, action, entity, redacted change, reason, trace, occurred_at                     | append-only منطقی؛ retention policy             |
| `report_runs`                          | id, definition, filters, permission_snapshot, requested_by, status, file_id?               | background export و audit                       |

## Value Objectها و Enumهای نیازمند تثبیت

- `Money { amount: Decimal, currencyCode: ISO-4217 }`
- `ExchangeRateSnapshot { rate, from, to, kind, source, observedAt }`
- `DateRange`, `ContactValue`, `DocumentNumber`, `ExternalReference`, `IdempotencyKey`
- status enumهای contract/capacity/reservation/issue/manifest/purchase/release/payment/invoice/check/support/task باید state machine و
  transition table داشته باشند، نه تغییر آزاد رشته.

## موارد باز پیش از schema

- precision/scale و rounding برای IRR و ارز خارجی
- strategy FK برای linkهای چندنوعی (typed link tables در برابر registry)
- tenant/company scope در صورت چندشرکتی‌شدن آینده
- searchable encryption و retention مدارک/تماس
- chart of accounts و mapping حسابداری قانونی
- قواعد تقویم کاری، حضور، مرخصی، اضافه‌کاری و حداقل payload ورودی پرداخت حقوق
- numbering scope (company/year/branch/channel) برای Contract/Reservation/Purchase/Invoice/Receipt
