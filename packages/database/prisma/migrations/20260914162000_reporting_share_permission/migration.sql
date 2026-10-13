INSERT INTO "iam_permissions" ("id", "code", "module", "name", "description")
VALUES (
  gen_random_uuid(),
  'reporting.share',
  'reporting',
  'اشتراک‌گذاری گزارش ذخیره‌شده با کاربران مجاز',
  'مالک گزارش می‌تواند آن را فقط با کاربر فعال و دارای مجوز مشاهده همان گزارش به اشتراک بگذارد.'
)
ON CONFLICT ("code") DO UPDATE
SET "module" = EXCLUDED."module",
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description";

INSERT INTO "iam_role_permissions" ("roleId", "permissionId")
SELECT manager_permission."roleId", share_permission."id"
FROM "iam_role_permissions" manager_permission
JOIN "iam_permissions" manager
  ON manager."id" = manager_permission."permissionId"
 AND manager."code" = 'reporting.manage'
JOIN "iam_permissions" share_permission
  ON share_permission."code" = 'reporting.share'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
