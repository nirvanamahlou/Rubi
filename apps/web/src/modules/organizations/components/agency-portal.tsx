'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  B2B_DOSSIER_SECTIONS,
  type B2bPortalIdentity,
  type B2bPortalSection,
} from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { clearHeaderSession } from '@/lib/header-session';
import { logoutAuthenticatedSession } from '@/modules/profile/api/client';
import { agencyClient } from '../api/agency-client';
import './corporate-design.css';
export function AgencyPortal() {
  const router = useRouter();
  const [identity, setIdentity] = useState<B2bPortalIdentity>(),
    [section, setSection] = useState(''),
    [content, setContent] = useState<B2bPortalSection>(),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  async function logout() {
    try {
      await logoutAuthenticatedSession();
      clearHeaderSession();
      router.replace('/login?next=%2Fagency-portal');
      router.refresh();
    } catch {
      setError('خروج از حساب انجام نشد؛ دوباره تلاش کنید.');
    }
  }
  useEffect(() => {
    let active = true;
    void agencyClient
      .portalIdentity()
      .then((r) => {
        if (active) {
          setIdentity(r.data);
          setSection(r.data.sections[0] ?? '');
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'دسترسی پرونده در دسترس نیست.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (!section) return;
    void agencyClient
      .portalSection(section)
      .then((r) => {
        if (active) {
          setContent(r.data);
          setError('');
        }
      })
      .catch((e) => {
        if (active) {
          setContent(undefined);
          setError(e instanceof Error ? e.message : 'دریافت بخش ناموفق بود.');
        }
      });
    return () => {
      active = false;
    };
  }, [section]);
  return (
    <main className="b2b-design min-h-screen p-6" dir="rtl">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="panel p-5">
          <h1 className="text-2xl font-bold">
            پرونده ۳۶۰ {identity?.organizationName ?? 'آژانس'}
          </h1>
          <p className="mt-2">
            {identity
              ? `${identity.displayName} · ${identity.roleName}`
              : 'ورود با حساب اختصاصی آژانس'}
          </p>
          {identity ? (
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => void logout()}
            >
              خروج از حساب
            </Button>
          ) : (
            <a
              className="mt-3 inline-block underline"
              href="/login?next=%2Fagency-portal"
            >
              ورود به حساب
            </a>
          )}
        </header>
        {loading ? <p>در حال دریافت دسترسی…</p> : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <nav className="flex flex-wrap gap-3" aria-label="بخش‌های مجاز پرونده">
          {B2B_DOSSIER_SECTIONS.filter((s) =>
            identity?.sections.includes(s.id),
          ).map((s) => (
            <Button
              key={s.id}
              variant={section === s.id ? 'primary' : 'outline'}
              onClick={() => {
                if (section === s.id) return;
                setContent(undefined);
                setSection(s.id);
              }}
            >
              {s.label}
            </Button>
          ))}
        </nav>
        {content ? (
          <section className="panel">
            <header className="panel-head">
              <h2 className="panel-title">{content.title}</h2>
            </header>
            <div className="panel-body space-y-4">
              {content.notice ? <p>{content.notice}</p> : null}
              {!content.rows.length && !content.notice ? (
                <p>هنوز اطلاعاتی برای این بخش ثبت نشده است.</p>
              ) : null}
              {content.rows.map((row, index) => (
                <article className="rounded-xl border p-4" key={index}>
                  <h3 className="font-bold">{row.label}</h3>
                  <dl className="mt-3 space-y-2">
                    {row.values.map((v, i) => (
                      <div
                        className="flex flex-wrap justify-between gap-3"
                        key={i}
                      >
                        <dt className="text-muted-foreground">{v.label}</dt>
                        <dd>{v.value}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
