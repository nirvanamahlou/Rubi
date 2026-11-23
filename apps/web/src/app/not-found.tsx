import Link from 'next/link';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.card} aria-labelledby="not-found-title">
        <div className={styles.visual} aria-hidden="true">
          <span className={styles.eyebrow}>AVINA · PAGE NOT FOUND</span>
          <div className={styles.number}>404</div>
          <svg className={styles.route} viewBox="0 0 400 180" fill="none">
            <path
              d="M28 137C72 22 173 35 160 94S292 172 351 47"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="5 8"
            />
            <circle cx="28" cy="137" r="7" fill="currentColor" />
            <circle
              cx="351"
              cy="47"
              r="18"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="m344 40 14 14m0-14-14 14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path d="m241 109 22-8-7 22-5-9-10-5Z" fill="white" />
          </svg>
          <span className={styles.visualCaption}>LET’S FIND YOUR WAY BACK</span>
        </div>
        <div className={styles.content}>
          <div className={styles.brand}>
            <span className={styles.brandDot} />
            آوینا
          </div>
          <p className={styles.label}>خطای ۴۰۴</p>
          <h1 id="not-found-title">انگار مسیر را اشتباه آمده‌ایم!</h1>
          <p className={styles.description}>
            صفحه‌ای که دنبالش هستید پیدا نشد. شاید آدرس را اشتباه وارد کرده‌اید
            یا این صفحه جابه‌جا شده است.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/">
              بازگشت به صفحهٔ اصلی<span aria-hidden="true">←</span>
            </Link>
            <Link className={styles.secondary} href="/login">
              ورود به سامانه
            </Link>
          </div>
          <p className={styles.hint}>
            آدرس را بررسی کنید یا از صفحهٔ اصلی ادامه دهید.
          </p>
        </div>
      </section>
      <p className={styles.footer}>هنوز در مسیر شماییم.</p>
    </main>
  );
}
