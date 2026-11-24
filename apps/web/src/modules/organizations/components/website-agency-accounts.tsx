'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { agencyClient, type WebsiteAgencyAccount } from '../api/agency-client';

const sites: Record<string, { name: string; reset?: string }> = {
  'jahan-bastan': {
    name: 'جهان باستان',
    reset: 'https://jahanbastan.ir/account/forgot-password/',
  },
  nss: { name: 'نیایش‌سیر' },
  ghestiroo: { name: 'قسطی‌رو', reset: 'https://ghestiroo.ir/forgot-password' },
};

export function WebsiteAgencyAccounts({
  organizationId,
  canApprove = false,
}: {
  organizationId?: string;
  canApprove?: boolean;
}) {
  const [expanded, setExpanded] = useState(Boolean(organizationId));
  const [rows, setRows] = useState<WebsiteAgencyAccount[]>([]);
  const [status, setStatus] = useState<'idle' | 'ready' | 'error'>('idle');
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!expanded) return;
    let mounted = true;
    agencyClient.websiteAccounts(organizationId).then(
      ({ data }) => {
        if (mounted) {
          setRows(data);
          setStatus('ready');
        }
      },
      () => {
        if (mounted) setStatus('error');
      },
    );
    return () => {
      mounted = false;
    };
  }, [expanded, organizationId, revision]);

  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">
          {organizationId
            ? 'حساب‌های کاربری سایت‌ها'
            : 'درخواست‌های حساب آژانس از سایت‌ها'}
        </h2>
        {!organizationId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'بستن' : 'مشاهده'}
          </Button>
        )}
      </header>
      {expanded && (
        <div className="panel-body space-y-3">
          {status === 'idle' && <p role="status">در حال دریافت اطلاعات…</p>}
          {status === 'error' && (
            <Button variant="outline" onClick={() => setRevision((n) => n + 1)}>
              دوباره تلاش کنید
            </Button>
          )}
          {status === 'ready' && !rows.length && <p>موردی ثبت نشده است.</p>}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {rows.map((row) => (
            <article
              key={row.id}
              className="rounded-md border border-border p-3"
            >
              <h3 className="font-semibold">
                {sites[row.site]?.name ?? row.site} ·{' '}
                {row.status === 'LINKED' ? 'متصل' : 'در انتظار بررسی'}
              </h3>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <dt>نام حقوقی</dt>
                  <dd>{row.legalName}</dd>
                </div>
                <div>
                  <dt>نام کاربری</dt>
                  <dd>
                    <bdi>{row.username ?? '—'}</bdi>
                  </dd>
                </div>
                <div>
                  <dt>ایمیل</dt>
                  <dd>
                    <bdi>{row.email ?? '—'}</bdi>
                  </dd>
                </div>
                <div>
                  <dt>شناسه ملی</dt>
                  <dd>
                    <bdi>{row.nationalId ?? '—'}</bdi>
                  </dd>
                </div>
                <div>
                  <dt>کد اقتصادی</dt>
                  <dd>
                    <bdi>{row.economicCode ?? '—'}</bdi>
                  </dd>
                </div>
                <div>
                  <dt>شماره ثبت</dt>
                  <dd>
                    <bdi>{row.registrationNumber ?? '—'}</bdi>
                  </dd>
                </div>
                {row.profile?.phone && (
                  <div>
                    <dt>شماره تماس</dt>
                    <dd>
                      <bdi>{row.profile.phone}</bdi>
                    </dd>
                  </div>
                )}
                {row.profile?.address && (
                  <div>
                    <dt>نشانی</dt>
                    <dd>{row.profile.address}</dd>
                  </div>
                )}
              </dl>
              {row.status === 'LINKED' && sites[row.site]?.reset && (
                <a
                  href={sites[row.site]?.reset}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block underline"
                >
                  بازنشانی رمز عبور در سایت
                </a>
              )}
              {row.status === 'REVIEW' &&
                row.username &&
                canApprove &&
                (row.site === 'ghestiroo' || row.siteApproved) && (
                  <Button
                    className="mt-2"
                    disabled={pending !== undefined}
                    onClick={async () => {
                      setPending(row.id);
                      setError('');
                      try {
                        await agencyClient.approveWebsiteAccount(row.id);
                        setRevision((n) => n + 1);
                      } catch (caught) {
                        setError(
                          caught instanceof Error
                            ? caught.message
                            : 'عملیات انجام نشد.',
                        );
                      } finally {
                        setPending(undefined);
                      }
                    }}
                  >
                    تأیید اتصال
                  </Button>
                )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
