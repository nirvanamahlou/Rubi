'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  ArrowLeft,
  FileSpreadsheet,
  FolderPen,
  Plus,
} from 'lucide-react';
import { HotelRatePacksWorkspace } from './packs-workspace';
import { PackArchivePanel } from './pack-archive-panel';
import styles from './hotel-rate-hub.module.css';

const sections = [
  {
    id: 'excel',
    title: 'ورودی اکسل نرخ‌ها',
    description: 'دریافت فایل، بررسی نرخ‌ها و ثبت بستهٔ هتل',
    icon: FileSpreadsheet,
  },
  {
    id: 'manual',
    title: 'بستهٔ جدید',
    description: 'انتخاب هتل، بازهٔ سفر و ثبت قیمت خرید',
    icon: Plus,
  },
  {
    id: 'existing',
    title: 'بسته‌های موجود',
    description: 'جست‌وجوی بسته‌ها، مشاهده و ویرایش نرخ‌ها',
    icon: FolderPen,
  },
  {
    id: 'archive',
    title: 'حذف بسته',
    description: 'کنارگذاری بسته از انتخاب‌های جدید با حفظ سابقه',
    icon: Archive,
  },
] as const;
type Section = (typeof sections)[number]['id'];

export function HotelRateHub() {
  const router = useRouter();
  const [section, setSection] = useState<Section | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [exitPage, setExitPage] = useState(false);
  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/reservations');
  };
  const backButton = (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        if (busy) return;
        if (section && section !== 'archive') {
          setExitPage(true);
          setConfirmExit(true);
        } else goBack();
      }}
    >
      بازگشت
    </button>
  );
  return (
    <div className={styles.root} dir="rtl">
      {section ? (
        <>
          <header className={styles.heading}>
            <h1>{sections.find((item) => item.id === section)?.title}</h1>
            <div className={styles.actions}>
              {backButton}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (busy) return;
                  setExitPage(false);
                  if (section === 'archive') setSection(null);
                  else setConfirmExit(true);
                }}
              >
                بازگشت به نرخ هتل
              </button>
            </div>
          </header>
          {confirmExit && (
            <div role="alert" className={styles.panel}>
              <p>
                {exitPage
                  ? 'به صفحه قبل برگردید؟ تغییرات ذخیره‌نشده از بین می‌روند.'
                  : 'به صفحهٔ نرخ هتل برگردید؟ تغییرات ذخیره‌نشده از بین می‌روند.'}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!busy) {
                    setConfirmExit(false);
                    if (exitPage) goBack();
                    else setSection(null);
                  }
                }}
              >
                تأیید
              </button>
              <button type="button" onClick={() => setConfirmExit(false)}>
                انصراف
              </button>
            </div>
          )}
          {section === 'archive' ? (
            <PackArchivePanel onBusyChange={setBusy} />
          ) : (
            <HotelRatePacksWorkspace
              key={section}
              initialMode={section}
              onBusyChange={setBusy}
            />
          )}
        </>
      ) : (
        <>
          <header className={styles.heading}>
            <h1>قیمت خرید هتل</h1>
            {backButton}
          </header>
          <div className={styles.grid}>
            {sections.map(({ id, title, description, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={styles.card}
                data-section={id}
                onClick={() => setSection(id)}
              >
                <div className={styles.cardHeading}>
                  <span className={styles.icon}>
                    <Icon size={28} aria-hidden="true" />
                  </span>
                  <h2>{title}</h2>
                </div>
                <p>{description}</p>
                <span className={styles.enter}>
                  ورود به بخش <ArrowLeft size={18} aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
