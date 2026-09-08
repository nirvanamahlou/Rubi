'use client';

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import type { RequestView } from './model';
import { statusLabels } from './model';
import styles from './action-panel.module.css';

export const contractActionGroups = [
  {
    title: 'عملیات قرارداد',
    items: [
      'مشاهده',
      'Confirmation',
      'بلیط',
      'ویرایش',
      'خرید',
      'مفاد',
      'پیوست',
      'واچر',
      'دریافت',
      'بیمه‌نامه',
    ],
  },
  {
    title: 'اطلاعات قرارداد',
    items: [
      'مشخصات کلی',
      'طرف قرارداد',
      'اسامی مسافران',
      'رزرواسیون',
      'مدارک',
      'دریافت‌ها',
    ],
  },
  {
    title: 'ارتباطات و یادداشت‌ها',
    items: ['پیامک', 'ارسال ایمیل', 'توضیحات', 'ثبت توضیحات'],
  },
] as const;

export function ContractActionContent({
  action,
  request,
}: {
  action: string;
  request: RequestView;
}) {
  if (
    action === 'مشاهده' ||
    action === 'مشخصات کلی' ||
    action === 'رزرواسیون'
  ) {
    return (
      <dl className={styles.details}>
        {Object.entries({
          'شماره قرارداد': request.contractNumber,
          شعبه: request.branchName,
          وضعیت: statusLabels[request.status],
          'مسئول رزرواسیون': request.assignee ?? 'تخصیص‌نیافته',
          هتل: request.hotelName ?? 'دریافت نشده',
        }).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    );
  }
  if (action === 'اسامی مسافران')
    return request.passengerNames.length ? (
      <ul className={styles.passengers}>
        {request.passengerNames.map((name, index) => (
          <li key={index}>{name}</li>
        ))}
      </ul>
    ) : (
      <p className={styles.placeholder}>
        نام مسافران هنوز در اطلاعات دریافتی موجود نیست.
      </p>
    );
  if (action === 'طرف قرارداد')
    return (
      <dl className={styles.details}>
        <div>
          <dt>طرف قرارداد</dt>
          <dd>
            {request.customerName === '—'
              ? 'در اطلاعات دریافتی موجود نیست'
              : request.customerName}
          </dd>
        </div>
      </dl>
    );
  return (
    <div className={styles.placeholder}>
      <strong>فرم {action}</strong>
      <p>جزئیات این فرم هنوز تعیین نشده است.</p>
    </div>
  );
}

export function ContractActionPanel({
  request,
}: {
  request?: RequestView | undefined;
}) {
  return (
    <aside className={styles.panel} aria-label="عملیات قرارداد انتخاب‌شده">
      <div className={styles.selection} aria-live="polite">
        <span>قرارداد انتخاب‌شده</span>
        <strong>
          {request ? request.contractNumber : 'قراردادی انتخاب نشده'}
        </strong>
        <span>
          {request
            ? request.customerName !== '—'
              ? request.customerName
              : (request.passengerNames[0] ?? 'نام مسافر دریافت نشده')
            : 'روی یک قرارداد از فهرست کلیک کنید.'}
        </span>
      </div>
      {contractActionGroups.map((group) => (
        <section key={group.title} className={styles.group}>
          <h2>{group.title}</h2>
          <div className={styles.buttons}>
            {group.items.map((action) => (
              <Dialog key={action}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    disabled={!request}
                    className={styles.action}
                  >
                    {action}
                  </button>
                </DialogTrigger>
                {request && (
                  <DialogContent
                    dir="rtl"
                    className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl"
                  >
                    <DialogTitle className="pe-10">{action}</DialogTitle>
                    <DialogDescription>
                      قرارداد {request.contractNumber} ·{' '}
                      {request.customerName !== '—'
                        ? request.customerName
                        : (request.passengerNames[0] ?? request.branchName)}
                    </DialogDescription>
                    <ContractActionContent action={action} request={request} />
                  </DialogContent>
                )}
              </Dialog>
            ))}
          </div>
        </section>
      ))}
    </aside>
  );
}
