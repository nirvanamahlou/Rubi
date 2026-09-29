WITH system_permissions(code, module, name) AS (
  VALUES
    ('system.read', 'system', 'مشاهده مرکز مدیریت سامانه'),
    ('system.settings.read', 'system', 'مشاهده تنظیمات سامانه'),
    ('system.settings.manage', 'system', 'مدیریت تنظیمات سامانه'),
    ('system.security.read', 'system', 'مشاهده سیاست‌های امنیتی'),
    ('system.security.manage', 'system', 'مدیریت سیاست‌های امنیتی'),
    ('system.users.read', 'system', 'مشاهده کاربران از مرکز مدیریت'),
    ('system.users.manage', 'system', 'مدیریت کاربران از مرکز مدیریت'),
    ('system.roles.read', 'system', 'مشاهده نقش‌ها از مرکز مدیریت'),
    ('system.roles.manage', 'system', 'مدیریت نقش‌ها از مرکز مدیریت'),
    ('system.permissions.read', 'system', 'مشاهده ماتریس مجوزها'),
    ('system.permissions.manage', 'system', 'مدیریت ماتریس مجوزها'),
    ('system.branches.read', 'system', 'مشاهده شعب و دامنه سازمانی'),
    ('system.branches.manage', 'system', 'مدیریت شعب و دامنه سازمانی'),
    ('system.legal_entities.read', 'system', 'مشاهده شرکت‌ها از قرارداد عمومی'),
    ('system.sessions.read', 'system', 'مشاهده نشست‌های مدیریتی'),
    ('system.sessions.revoke', 'system', 'ابطال کنترل‌شده نشست‌ها'),
    ('system.numbering.read', 'system', 'مشاهده طرح‌های شماره‌گذاری'),
    ('system.numbering.manage', 'system', 'مدیریت طرح‌های شماره‌گذاری'),
    ('system.notifications.read', 'system', 'مشاهده تنظیمات اعلان'),
    ('system.notifications.manage', 'system', 'مدیریت تنظیمات اعلان'),
    ('system.templates.read', 'system', 'مشاهده قالب‌های سیستمی'),
    ('system.templates.manage', 'system', 'مدیریت قالب‌های سیستمی'),
    ('system.audit.read', 'system', 'مشاهده حسابرسی مدیریت سامانه'),
    ('system.audit.sensitive', 'system', 'مشاهده کنترل‌شده حسابرسی حساس'),
    ('system.health.read', 'system', 'مشاهده سلامت سرویس‌ها و Jobها'),
    ('system.jobs.retry', 'system', 'اجرای مجدد Job مجاز و idempotent'),
    ('system.feature_flags.read', 'system', 'مشاهده Feature Flagها'),
    ('system.feature_flags.manage', 'system', 'مدیریت Feature Flagها'),
    ('system.backup.request', 'system', 'ثبت درخواست پشتیبان‌گیری'),
    ('system.backup.read', 'system', 'مشاهده درخواست‌های پشتیبان‌گیری')
)
INSERT INTO "iam_permissions" ("id", "code", "module", "name")
SELECT gen_random_uuid(), code, module, name
FROM system_permissions
ON CONFLICT ("code") DO UPDATE
SET "module" = EXCLUDED."module",
    "name" = EXCLUDED."name";

INSERT INTO "iam_role_permissions" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "iam_roles" role
CROSS JOIN "iam_permissions" permission
WHERE role."code" = 'administrator'
  AND permission."code" LIKE 'system.%'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
