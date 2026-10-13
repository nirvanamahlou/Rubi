'use client';
import { Button } from '@/components/ui/button';
import type { recommendRoleAccess } from './role-access-presets';
import styles from './user-management.module.css';
export function RoleAccessProposal({
  title,
  proposal,
  onApply,
  onKeep,
}: {
  title: string;
  proposal: ReturnType<typeof recommendRoleAccess>;
  onApply: (customize: boolean) => void;
  onKeep: () => void;
}) {
  return (
    <section aria-label={'پیشنهاد دسترسی ' + title} className={styles.proposal}>
      <div className={styles.proposalHeading}>
        <strong>پیشنهاد دسترسی برای {title}</strong>
        <span>
          {proposal.screenIds.length} زیربخش · {proposal.permissionIds.length}{' '}
          مجوز عملیات
        </span>
      </div>
      <p>{proposal.reason}</p>
      <div className={styles.proposalGroups}>
        {proposal.groups.map((group) => (
          <span key={group.id}>{group.title}</span>
        ))}
      </div>
      <ul className={styles.proposalPermissions} aria-label="مجوزهای پیشنهادی">
        {proposal.permissions.map((permission) => (
          <li key={permission.id}>{permission.name}</li>
        ))}
      </ul>
      <p className={styles.proposalHint}>
        پیشنهاد فقط در محدوده دسترسی قابل واگذاری شماست. اعمال آن، تیک‌های قبلی
        بخش‌ها و عملیات را جایگزین می‌کند؛ شعب مجاز حفظ می‌شوند. تا ذخیره نکنید،
        حساب کاربر تغییر نمی‌کند.
      </p>
      <div className={styles.proposalActions}>
        <Button type="button" onClick={() => onApply(false)}>
          تأیید و اعمال پیشنهاد
        </Button>
        <Button type="button" variant="outline" onClick={() => onApply(true)}>
          اعمال و سفارشی‌سازی
        </Button>
        <Button type="button" variant="ghost" onClick={onKeep}>
          حفظ تیک‌های فعلی
        </Button>
      </div>
    </section>
  );
}
