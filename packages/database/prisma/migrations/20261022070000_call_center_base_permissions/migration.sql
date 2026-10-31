-- These pre-existing API guards must be selectable even on installations which
-- deploy migrations without rerunning the global seed. Never backfill role grants.
INSERT INTO iam_permissions (id, code, module, name) VALUES
  (gen_random_uuid(), 'customer_affairs.call_center.read', 'customer_affairs', 'مشاهده کال سنتر'),
  (gen_random_uuid(), 'customer_affairs.call_center.calls.create', 'customer_affairs', 'ثبت تماس دستی'),
  (gen_random_uuid(), 'customer_affairs.call_center.notes.create', 'customer_affairs', 'ثبت یادداشت کال سنتر'),
  (gen_random_uuid(), 'customer_affairs.call_center.workflow.manage', 'customer_affairs', 'مدیریت درخواست‌ها و پیگیری‌های خود')
ON CONFLICT (code) DO NOTHING;
