# DEC-OPEN-005 — Approval Matrix مالی و Maker/Checker

- **Status:** PROPOSED
- **Owner:** مالک مالی و مالک امنیت/IAM
- **Proposer:** PC-A/FINANCE-001
- **Date:** 2026-08-24
- **Gate:** تا ACCEPTED شدن، Approval Workflow اجرایی و Migration آن ممنوع است.

## Context

Purchase، Payment، Refund و Manual Journal حساس‌اند. یک Role ثابت، مبلغ، ارز، شعبه
و ریسک را پوشش نمی‌دهد و self-approval را به‌صورت قابل اتکا منع نمی‌کند.

## Options

1. یک Role ثابت برای همه تاییدها؛ ساده ولی بدون threshold و scope.
2. شرط hardcoded در use caseها؛ پراکنده و غیرقابل version.
3. Approval Matrix تنظیم‌پذیر و versioned با Maker/Checker.

## Proposed decision

گزینه ۳ پیشنهاد می‌شود:

- Matrix براساس operation type، amount band، currency، branch/legal entity و required
  role/permission resolve می‌شود.
- specificity و conflict resolution باید deterministic باشد؛ نبود Rule نتیجه DENY دارد.
- Purchase، Payment، Refund و Manual Journal حداقل Maker و Checker متفاوت دارند.
- ثبت‌کننده، requester یا maker نمی‌تواند همان عملیات حساس را تایید کند.
- threshold بالاتر می‌تواند چند مرحله یا تایید دوم بخواهد.
- matrix version و rule references روی Approval Request snapshot می‌شوند.
- تغییر مبلغ، ارز یا طرف‌حساب approval قبلی را invalidate و نسخه جدید می‌سازد.
- approve، reject، return، expire، delegate و exception با actor، permission snapshot،
  reason، UTC، trace و before/after redacted Audit می‌شوند.
- IAM فقط actor، permission و branch scope عمومی می‌دهد؛ Finance جدول IAM را query نمی‌کند.
- Settings مالک lifecycle Matrix و Finance مالک invariant عملیات و snapshot است.

## Rationale

Matrix versioned نیاز شعب و ارزهای مختلف و Segregation of Duties را پوشش می‌دهد، بدون
آن‌که Ruleها در کد use case پراکنده شوند.

## Consequences

- permission ایجاد و تایید هر عملیات جداست.
- تغییر Rule روی درخواست در حال بررسی retroactive نیست.
- bypass خام وجود ندارد؛ استثنا دلیل، انقضا و Audit مستقل می‌خواهد.
- Approval موفق به‌تنهایی posting یا release را اجرا نمی‌کند.
- SLA، delegation و escalation پیش از اجرا باید تعیین شوند.

## Change and migration path

نقش‌ها، thresholdها، ارز/شعبه، تعداد مراحل، SLA و delegation با مالک مالی/امنیت نهایی
می‌شوند؛ سپس Settings→Finance contract، permissionهای IAM و Migration افزایشی طراحی
خواهند شد. نسخه‌های قبلی Matrix برای Audit حفظ می‌شوند.
