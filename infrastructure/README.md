# زیرساخت توسعه محلی

فایل `compose.dev.yaml` فقط برای محیط Local است و PostgreSQL، Redis، MinIO و یک
container یک‌باراجرای MinIO برای ساخت bucket را فراهم می‌کند. Nginx عمداً در Technical
Bootstrap اضافه نشده است؛ تا پیش از مشخص‌شدن topology و دامنه‌ها، proxy محلی ارزش عملیاتی
متناسب با پیچیدگی آن ندارد.

Credentialهای پیش‌فرض صرفاً synthetic و محلی‌اند. برای اجرای Compose ابتدا `.env.example`
را به `.env` کپی کنید و مقادیر محلی را در فایل ignore‌شده `.env` نگه دارید.
