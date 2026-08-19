# Work Assignments

آخرین به‌روزرسانی: 2026-08-19 — PC-A

هر ردیف مالکیت یک واحد کار و فایل‌های آن را مشخص می‌کند. قبل از ویرایش، ردیف جدید
ثبت شود. وضعیت‌های مجاز: `PLANNED`، `IN_PROGRESS`، `BLOCKED`، `READY_FOR_REVIEW`،
`DONE`.

| Work ID        | مالک         | Branch                           | محدوده/فایل‌های اصلی                                                                         | وضعیت              | وابستگی یا Handoff                                                 |
| -------------- | ------------ | -------------------------------- | -------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| BOOT-001       | PC-A         | `codex/pc-a-bootstrap-docs`      | اسناد Bootstrap، معماری، ERD، workflow و backlog                                             | `READY_FOR_REVIEW` | PC-B باید همه اسناد و تصمیم‌های باز P0 را مرور کند                 |
| FOUNDATION-001 | PC-A         | `codex/pc-a-technical-bootstrap` | Technical Bootstrap: Monorepo، Web/API/Worker، Docker Compose و Prisma Client بدون مدل تجاری | `READY_FOR_REVIEW` | gateها و smoke پاس؛ PC-B می‌تواند UI پایه را پس از review شروع کند |
| FOUNDATION-002 | تخصیص‌نیافته | TBD                              | سخت‌سازی زیرساخت، CI و استقرار محیط‌های غیرمحلی                                              | `PLANNED`          | FOUNDATION-001 و تصمیم‌های میزبانی/RPO/RTO                         |
| FOUNDATION-003 | تخصیص‌نیافته | TBD                              | IAM/Audit foundation، schema دامنه و Migration اولیه                                         | `PLANNED`          | FOUNDATION-001 و تایید مدل/تصمیم‌های باز P0                        |

## قرارداد مالکیت

- یک فایل یا Migration هم‌زمان فقط یک مالک فعال دارد.
- تغییر محدود و ناگزیر در فایل مشترک باید در توضیح ردیف و Commit اعلام شود.
- وضعیت `DONE` یعنی Commit و Push شده و گزارش تست/ریسک در Project Status ثبت شده
  است؛ ادغام‌شدن را تضمین نمی‌کند.
- آزادکردن کار بدون تکمیل با تغییر مالک به `تخصیص‌نیافته` و ثبت دلیل انجام می‌شود.
