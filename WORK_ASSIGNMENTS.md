# Work Assignments

آخرین به‌روزرسانی: 2026-08-19 — PC-A

هر ردیف مالکیت یک واحد کار و فایل‌های آن را مشخص می‌کند. قبل از ویرایش، ردیف جدید
ثبت شود. وضعیت‌های مجاز: `PLANNED`، `IN_PROGRESS`، `BLOCKED`، `READY_FOR_REVIEW`،
`DONE`.

| Work ID | مالک | Branch | محدوده/فایل‌های اصلی | وضعیت | وابستگی یا Handoff |
|---|---|---|---|---|---|
| BOOT-001 | PC-A | `codex/pc-a-bootstrap-docs` | اسناد Bootstrap، معماری، ERD، workflow و backlog | `READY_FOR_REVIEW` | PC-B باید همه اسناد و تصمیم‌های باز P0 را مرور کند |
| FOUNDATION-001 | تخصیص‌نیافته | TBD | Monorepo/toolchain skeleton | `PLANNED` | تصمیم‌های باز P0 و پذیرش BOOT-001 |
| FOUNDATION-002 | تخصیص‌نیافته | TBD | Docker Compose و سرویس‌های محلی | `PLANNED` | FOUNDATION-001 |
| FOUNDATION-003 | تخصیص‌نیافته | TBD | Prisma baseline و IAM/Audit foundation | `PLANNED` | FOUNDATION-001/002 و تایید مدل اولیه |

## قرارداد مالکیت

- یک فایل یا Migration هم‌زمان فقط یک مالک فعال دارد.
- تغییر محدود و ناگزیر در فایل مشترک باید در توضیح ردیف و Commit اعلام شود.
- وضعیت `DONE` یعنی Commit و Push شده و گزارش تست/ریسک در Project Status ثبت شده
  است؛ ادغام‌شدن را تضمین نمی‌کند.
- آزادکردن کار بدون تکمیل با تغییر مالک به `تخصیص‌نیافته` و ثبت دلیل انجام می‌شود.
