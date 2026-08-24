# DEC-OPEN-016 — سیاست Financial Release و تحویل مدارک

- **Status:** PROPOSED
- **Owner:** مالک مالی با تایید مالک فروش/عملیات
- **Proposer:** PC-A/FINANCE-001
- **Date:** 2026-08-24
- **Gate:** تا ACCEPTED شدن، Release اجرایی، Migration و mutation بین‌ماژولی ممنوع است.

## Context

رزرواسیون ممکن است برای حفظ ظرفیت، بلیت، واچر یا بیمه‌نامه را پیش از تسویه کامل صادر
کند. تحویل زودهنگام ریسک وصول دارد و منع صدور تا تسویه نیز عملیات را مختل می‌کند.
بنابراین صدور، release و delivery باید stateهای مستقل باشند.

## Options

1. فقط تسویه کامل؛ ساده ولی ناسازگار با اعتبار، اقساط و چک معتبر.
2. Release چندمبنایی سه‌گانه با استثنای کنترل‌شده.
3. اختیار دستی مدیر بدون policy؛ سریع ولی مستعد bypass.

## Proposed decision

گزینه ۲ پیشنهاد می‌شود:

- وضعیت canonical شامل BLOCKED، CONDITIONAL و APPROVED است.
- APPROVED براساس تسویه کامل یا اعتبار مصوب و کافی قابل پیشنهاد است.
- CONDITIONAL براساس برنامه پرداخت مصوب، چک معتبر یا استثنای مدیر است.
- هر basis باید policy snapshot، exposure/settlement facts و document references داشته
  باشد؛ Finance جدول Sales/Reservations/Customers را query نمی‌کند.
- استثنای مدیر دلیل تفصیلی، expiry آینده UTC، تاییدکننده دوم متفاوت، permission مجزا و
  Audit کامل می‌خواهد. پس از expiry ارزیابی مجدد و default به BLOCKED لازم است.
- Reservations می‌تواند سند عملیاتی بسازد، ولی Documents/Sales تا release معتبر اجازه
  مشاهده، download یا ارسال به مسافر ندارند.
- رویداد financial_release.changed.v1 فقط reference، status، basis و expiry حداقلی دارد.
- revoke یا downgrade ناشی از برگشت چک، انقضای اعتبار یا شکست شرط reason/history دارد؛
  سند تحویل‌شده حذف نمی‌شود و task جبرانی ایجاد می‌شود.
- Sales/Documents مالک delivery history و Finance مالک authorization/history خودش است.

## Rationale

این مدل ریسک مالی را از صدور جدا، شرایط رایج گردشگری را پوشش و bypass مدیر را زمان‌دار
و دو‌تاییدی می‌کند.

## Consequences

- هر release به Contract و document references پایدار متصل است.
- UI فروش پیش از authorization action تحویل را پنهان یا غیرفعال می‌کند.
- برگشت چک یا expiry می‌تواند downgrade کند ولی عملیات بیرونی را rollback نمی‌کند.
- شرایط اعتبار، برنامه پرداخت و چک معتبر پیش از پذیرش باید دقیق شوند.
- ارزیابی، استثنا، revoke و delivery attempt غیرمجاز Audit می‌شوند.

## Change and migration path

مالک مالی/فروش basisها، exposure، check validity، expiry، revoke و رفتار پس از delivery
را تایید می‌کند؛ سپس ADR پذیرفته‌شده، contract tests و Migration افزایشی طراحی می‌شوند.
basis جدید با version بعدی policy/event و دوره سازگاری consumerها اضافه می‌شود.
