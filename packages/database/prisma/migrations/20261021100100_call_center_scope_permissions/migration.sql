-- Register choices only. Intentionally no user/role grants or existing permission changes.
INSERT INTO iam_permissions (id, code, module, name) VALUES
  (gen_random_uuid(), 'customer_affairs.call_center.scope.v1', 'customer_affairs', 'محدوده امن کال سنتر نسخه ۱'),
  (gen_random_uuid(), 'customer_affairs.call_center.contacts.read.own', 'customer_affairs', 'مشاهده مخاطبان و سوابق تحت مسئولیت خود'),
  (gen_random_uuid(), 'customer_affairs.call_center.contacts.read.team', 'customer_affairs', 'مشاهده مخاطبان و سوابق تیم مجاز'),
  (gen_random_uuid(), 'customer_affairs.call_center.reports.read.own', 'customer_affairs', 'مشاهده گزارش‌ها و شاخص‌های خود'),
  (gen_random_uuid(), 'customer_affairs.call_center.reports.read.team', 'customer_affairs', 'مشاهده گزارش‌ها و شاخص‌های تیم مجاز'),
  (gen_random_uuid(), 'customer_affairs.call_center.workflow.manage.team', 'customer_affairs', 'مدیریت درخواست‌ها و پیگیری‌های تیم مجاز'),
  (gen_random_uuid(), 'customer_affairs.call_center.outbound.own', 'customer_affairs', 'تماس خروجی از داخلی خود'),
  (gen_random_uuid(), 'customer_affairs.call_center.owner.assign', 'customer_affairs', 'تخصیص مسئول به مخاطب بدون مسئول'),
  (gen_random_uuid(), 'customer_affairs.call_center.owner.change', 'customer_affairs', 'تغییر مسئول ثابت مخاطب'),
  (gen_random_uuid(), 'customer_affairs.call_center.owner.history', 'customer_affairs', 'مشاهده تاریخچهٔ تخصیص و تغییر مسئول')
ON CONFLICT (code) DO NOTHING;
