'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { B2bAgencyProfileDetailsV1 } from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { agencyClient } from '../api/agency-client';
import { DossierFormDialog } from './dossier-form-dialog';
import { useDossierBranch } from './use-dossier-branch';

const statusLabels = {
  ACTIVE: 'فعال',
  UNDER_REVIEW: 'در حال بررسی',
  SUSPENDED: 'معلق',
  ENDED: 'پایان‌یافته',
};
export function AgencyProfilePanel({
  organizationId,
  onReviewCooperation,
}: {
  organizationId: string;
  onReviewCooperation?: () => void;
}) {
  const { branches, branchId, setBranchId, permissions, sessionError } =
    useDossierBranch();
  const [details, setDetails] = useState<B2bAgencyProfileDetailsV1>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editor, setEditor] = useState<{
    manager: string;
    displayOrder: number;
  }>();
  const sequence = useRef(0);
  const invalidate = useCallback(() => {
    ++sequence.current;
  }, []);
  const load = useCallback(async () => {
    if (!branchId) return;
    const current = ++sequence.current;
    setLoading(true);
    setError('');
    setDetails(undefined);
    try {
      const response = await agencyClient.profileDetails(
        organizationId,
        branchId,
      );
      if (current === sequence.current) setDetails(response.data);
    } catch (caught) {
      if (current === sequence.current) {
        setDetails(undefined);
        setError(
          caught instanceof Error
            ? caught.message
            : 'دریافت پروفایل ناموفق بود.',
        );
      }
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [organizationId, branchId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      invalidate();
    };
  }, [load, invalidate]);
  const profile = details?.profile;
  const manager = details?.accountManagers.find(
    (item) => item.id === profile?.accountManagerUserId,
  );
  return (
    <div className="space-y-4">
      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">پروفایل همکاری و مدیر حساب</h2>
          <Button
            disabled={
              loading || !details || !permissions.includes('b2b.agency.manage')
            }
            onClick={() =>
              setEditor({
                manager: profile?.accountManagerUserId ?? '',
                displayOrder: profile?.displayOrder ?? 0,
              })
            }
          >
            {profile ? 'ویرایش پروفایل و مدیر حساب' : 'ثبت پروفایل همکاری'}
          </Button>
        </header>
        <div className="panel-body space-y-4">
          <label className="field">
            شعبه داخلی مسئول همکاری
            {branches.length > 1 ? (
              <select
                className="input"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            ) : (
              <strong>{branches[0]?.name ?? 'در حال دریافت…'}</strong>
            )}
            <span className="panel-note">
              شعبه شرکت شما که قرارداد و مسئول پیگیری این آژانس را مدیریت
              می‌کند.
            </span>
          </label>
          {sessionError || error ? (
            <p className="form-error" role="alert">
              {sessionError || error}
            </p>
          ) : null}
          {loading ? (
            <p role="status">در حال دریافت پروفایل…</p>
          ) : details ? (
            <div className="summary-list">
              <div className="summary-row">
                <span>وضعیت همکاری</span>
                <b>
                  {profile ? statusLabels[profile.status] : 'پروفایل ثبت نشده'}
                </b>
              </div>
              <div className="summary-row">
                <span>مسئول پیگیری آژانس (مدیر حساب)</span>
                <b>
                  {manager?.displayName ??
                    (profile?.accountManagerUserId
                      ? 'کاربر غیرفعال یا خارج از شعبه'
                      : 'تعیین نشده')}
                </b>
              </div>
              <div className="summary-row">
                <span>ترتیب نمایش</span>
                <b>{(profile?.displayOrder ?? 0).toLocaleString('fa-IR')}</b>
              </div>
            </div>
          ) : null}
          <p className="panel-note">
            مدیر حساب، کارمند شرکت شما و مسئول ارتباط و پیگیری همکاری با این
            آژانس است. از «ویرایش پروفایل و مدیر حساب» تعیین می‌شود.
          </p>
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
            <p className="panel-note">
              برای بررسی وضعیت همکاری، وارد «قرارداد و شرایط تجاری ← قرارداد
              چارچوب» شوید. قرارداد را تکمیل و برای بررسی ارسال کنید؛
              تأییدکننده‌ای غیر از ثبت‌کننده باید آن را تأیید کند تا همکاری «در
              حال بررسی» فعال شود.
            </p>
            {onReviewCooperation ? (
              <Button variant="outline" onClick={onReviewCooperation}>
                بررسی قرارداد و وضعیت همکاری
              </Button>
            ) : null}
          </div>
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={!branchId || loading}
          >
            تازه‌سازی
          </Button>
        </div>
        {editor && details ? (
          <DossierFormDialog
            title={
              profile
                ? 'ویرایش مدیر حساب و پروفایل'
                : 'ثبت پروفایل همکاری آژانس'
            }
            description="کارمند مسئول ارتباط و پیگیری این آژانس را از کاربران فعال شعبه داخلی مسئول همکاری انتخاب کنید."
            onClose={() => {
              setEditor(undefined);
              void load();
            }}
            onSave={async () => {
              await agencyClient.upsertProfile(organizationId, {
                branchId,
                accountManagerUserId: editor.manager || null,
                status: profile?.status ?? 'UNDER_REVIEW',
                displayOrder: editor.displayOrder,
                ...(profile ? { version: profile.version } : {}),
              });
            }}
          >
            <label className="field">
              مسئول پیگیری آژانس (مدیر حساب)
              <select
                className="input"
                value={editor.manager}
                onChange={(e) =>
                  setEditor({ ...editor, manager: e.target.value })
                }
              >
                <option value="">بدون مدیر حساب</option>
                {details.accountManagers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              ترتیب نمایش
              <Input
                type="number"
                min={0}
                max={2147483646}
                required
                value={editor.displayOrder}
                onChange={(e) =>
                  setEditor({ ...editor, displayOrder: Number(e.target.value) })
                }
              />
            </label>
          </DossierFormDialog>
        ) : null}
      </section>
    </div>
  );
}
