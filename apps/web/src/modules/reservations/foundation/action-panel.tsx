'use client';
import { ReservationPurchaseDialog } from '../components/reservation-hotel-purchase';
import { ReservationNotes } from '../components/reservation-notes';
import { ReservationPassengers } from '../passenger-files/passengers';
import { ReservationFiles } from '../passenger-files/files';
import { EnglishHotelName } from '../components/english-hotel-name';
import { ReservationGeneralDetails } from '../components/reservation-general-details';
import { ContractPdfPreview } from '../components/contract-pdf-preview';
import { ReservationReceipts } from '../components/reservation-receipts';

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import { TravelWorkflowForm } from '../components/travel-workflow-form';
import type { RequestView } from './model';
import { statusLabels } from './model';
import styles from './action-panel.module.css';

export const contractActionGroups = [
  {
    title: 'عملیات قرارداد',
    items: [
      'مشاهده',
      'بلیط',
      'ویرایش',
      'خرید',
      'مفاد',
      'واچر',
      'دریافت',
      'بیمه‌نامه',
    ],
  },
  {
    title: 'اطلاعات قرارداد',
    items: ['مشخصات کلی', 'اسامی مسافران', 'رزرواسیون', 'مدارک', 'دریافت‌ها'],
  },
  {
    title: 'یادداشت‌ها',
    items: ['توضیحات'],
  },
] as const;

export function ContractActionContent({
  action,
  request,
}: {
  action: string;
  request: RequestView;
}) {
  if (action === 'خرید') return <ReservationPurchaseDialog id={request.id} />;
  if (action === 'مشاهده')
    return (
      <ContractPdfPreview
        contractId={request.contractId}
        contractNumber={request.contractNumber}
      />
    );
  if (action === 'مشخصات کلی')
    return <ReservationGeneralDetails key={request.id} request={request} />;
  if (action === 'توضیحات')
    return <ReservationNotes key={request.id} id={request.id} />;
  if (
    [
      'رزرواسیون',
      'Confirmation',
      'بلیط',
      'واچر',
      'بیمه‌نامه',
      'ویرایش',
    ].includes(action)
  )
    return <TravelWorkflowForm id={request.id} action={action} />;
  if (action === 'رزرواسیون') {
    return (
      <dl className={styles.details}>
        {Object.entries({
          'شماره قرارداد': request.contractNumber,
          شعبه: request.branchName,
          وضعیت: statusLabels[request.status],
          'مسئول رزرواسیون': request.assignee ?? 'تخصیص‌نیافته',
          هتل: (
            <EnglishHotelName
              hotelId={request.hotelId}
              fallback={request.hotelName ?? 'دریافت نشده'}
            />
          ),
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
    return <ReservationPassengers key={request.id} id={request.id} />;
  if (action === 'مدارک' || action === 'پیوست')
    return <ReservationFiles key={request.id} id={request.id} />;
  if (action === 'دریافت‌ها')
    return (
      <ReservationReceipts
        key={request.contractId ?? request.id}
        {...(request.contractId ? { contractId: request.contractId } : {})}
      />
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
            {group.items.map((action) =>
              action === 'مفاد' ? (
                request ? (
                  <a
                    key={action}
                    href="/contracts/terms.pdf"
                    download="مفاد.pdf"
                    className={`${styles.action} ${styles.download}`}
                    aria-label="دریافت PDF مفاد قرارداد"
                  >
                    {action}
                  </a>
                ) : (
                  <button
                    key={action}
                    type="button"
                    disabled
                    className={styles.action}
                  >
                    {action}
                  </button>
                )
              ) : (
                <Dialog key={action}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      disabled={!request}
                      className={`${styles.action} ${action === 'توضیحات' && request?.hasNotes ? styles.hasNotes : ''}`}
                      aria-label={
                        action === 'توضیحات' && request?.hasNotes
                          ? 'توضیحات؛ این قرارداد یادداشت دارد'
                          : action
                      }
                    >
                      {action}
                    </button>
                  </DialogTrigger>
                  {request && (
                    <DialogContent
                      dir="rtl"
                      className={`max-h-[92dvh] overflow-y-auto ${['مشاهده', 'دریافت‌ها'].includes(action) ? 'sm:max-w-6xl' : 'sm:max-w-3xl'}`}
                    >
                      <DialogTitle className="pe-10">{action}</DialogTitle>
                      <DialogDescription>
                        قرارداد {request.contractNumber} ·{' '}
                        {request.customerName !== '—'
                          ? request.customerName
                          : (request.passengerNames[0] ?? request.branchName)}
                      </DialogDescription>
                      <ContractActionContent
                        action={action}
                        request={request}
                      />
                    </DialogContent>
                  )}
                </Dialog>
              ),
            )}
          </div>
        </section>
      ))}
    </aside>
  );
}
