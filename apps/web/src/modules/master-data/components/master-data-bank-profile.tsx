'use client';

import type { MasterDataRecord } from '@nora/contracts';
import { Eye, FilePenLine, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Alert, Card, EmptyState, Skeleton } from '@/components/ui/surfaces';
import { masterDataApi } from '../api/client';
import { getMasterDataDefinition } from '../model/catalog';
import {
  MasterDataLiveForm,
  type MasterDataFormMode,
} from './master-data-live-form';
import { MasterDataProfileDialog } from './master-data-profile-dialog';
import {
  MasterDataDetailItem,
  MasterDataDetailSection,
  MasterDataProfileIdentity,
} from './master-data-profile-details';
import { MasterDataLogoCell } from './master-data-logo-cell';

const branchDefinition = getMasterDataDefinition('bank-branches');

export function MasterDataBankProfile({
  bank,
  onOpenChange,
}: {
  bank: MasterDataRecord;
  onOpenChange: (open: boolean) => void;
}) {
  const [branches, setBranches] = useState<readonly MasterDataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [formMode, setFormMode] = useState<MasterDataFormMode | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<MasterDataRecord>();
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await masterDataApi.list('bank-branches', {
        bankId: bank.id,
        search: '',
        status: 'all',
        sortBy: 'name',
        sortDirection: 'asc',
        page,
        pageSize: 25,
      });
      setBranches(response.data);
      setTotal(response.meta.total);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'دریافت شعب بانک ناموفق بود.',
      );
    } finally {
      setLoading(false);
    }
  }, [bank.id, page]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  return (
    <>
      <MasterDataProfileDialog
        onOpenChange={onOpenChange}
        open
        title={`پروفایل بانک ${bank.name}`}
      >
        <div className="space-y-4">
          <MasterDataProfileIdentity
            eyebrow="پروفایل بانک"
            record={bank}
            title={bank.name}
          />
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setSelectedBranch(undefined);
                setFormMode('create');
              }}
            >
              <Plus aria-hidden="true" className="size-4" />
              افزودن شعبه
            </Button>
          </div>
          <MasterDataDetailSection title="مشخصات بانک">
            <MasterDataDetailItem
              label="نام انگلیسی"
              ltr
              value={String(bank.attributes.englishName ?? '')}
            />
            <MasterDataDetailItem
              label="کشور"
              value={String(bank.attributes.countryName ?? '')}
            />
            <MasterDataDetailItem
              label="SWIFT"
              ltr
              value={
                bank.attributes.swiftCode
                  ? String(bank.attributes.swiftCode)
                  : ''
              }
            />
          </MasterDataDetailSection>
          <Card className="space-y-3 p-4">
            <h3 className="font-bold">شعب بانک {bank.name}</h3>
            {notice ? <Alert title={notice} /> : null}
            {error ? (
              <div
                role="alert"
                className="flex flex-wrap items-center gap-3 text-destructive"
              >
                {error}
                <Button onClick={() => void load()} variant="outline">
                  تلاش دوباره
                </Button>
              </div>
            ) : loading ? (
              <Skeleton className="h-24 w-full" />
            ) : branches.length === 0 ? (
              <EmptyState
                description="از دکمه افزودن شعبه استفاده کنید."
                title="شعبه‌ای برای این بانک ثبت نشده است"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="p-3 text-start">کد شعبه</th>
                      <th className="p-3 text-start">لوگو</th>
                      <th className="p-3 text-start">نام شعبه</th>
                      <th className="p-3 text-start">شهر</th>
                      <th className="p-3 text-start">نشانی</th>
                      <th className="p-3 text-start">تلفن</th>
                      <th className="p-3 text-start">وضعیت</th>
                      <th className="p-3 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((branch) => (
                      <tr className="border-t border-border" key={branch.id}>
                        <td className="p-3 font-mono" dir="ltr">
                          {branch.code}
                        </td>
                        <MasterDataLogoCell record={branch} />
                        <td className="p-3">{branch.name}</td>
                        <td className="p-3">
                          {String(branch.attributes.cityName ?? '—')}
                        </td>
                        <td className="p-3">
                          {String(branch.attributes.address ?? '—')}
                        </td>
                        <td className="p-3" dir="ltr">
                          {String(branch.attributes.phone ?? '—')}
                        </td>
                        <td className="p-3">
                          {branch.status === 'active' ? 'فعال' : 'غیرفعال'}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex justify-center gap-2">
                            <Button
                              aria-label={`مشاهده ${branch.name}`}
                              onClick={() => {
                                setSelectedBranch(branch);
                                setFormMode('view');
                              }}
                              size="icon"
                              variant="outline"
                            >
                              <Eye aria-hidden="true" className="size-4" />
                            </Button>
                            <Button
                              aria-label={`ویرایش ${branch.name}`}
                              onClick={() => {
                                setSelectedBranch(branch);
                                setFormMode('edit');
                              }}
                              size="icon"
                              variant="outline"
                            >
                              <FilePenLine
                                aria-hidden="true"
                                className="size-4"
                              />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {total > 25 ? (
              <div className="flex items-center justify-between gap-3">
                <Button
                  disabled={page === 1 || loading}
                  onClick={() => setPage((value) => value - 1)}
                  variant="outline"
                >
                  قبلی
                </Button>
                <span>
                  صفحه {page.toLocaleString('fa-IR')} از{' '}
                  {Math.ceil(total / 25).toLocaleString('fa-IR')}
                </span>
                <Button
                  disabled={page >= Math.ceil(total / 25) || loading}
                  onClick={() => setPage((value) => value + 1)}
                  variant="outline"
                >
                  بعدی
                </Button>
              </div>
            ) : null}
          </Card>
        </div>
      </MasterDataProfileDialog>
      {formMode ? (
        <MasterDataLiveForm
          definition={branchDefinition}
          initialValues={{ bankId: bank.id }}
          key={`${formMode}-${selectedBranch?.id ?? 'new'}`}
          lockedFields={['bankId']}
          mode={formMode}
          onOpenChange={(open) => {
            if (!open) setFormMode(null);
          }}
          onPersist={async (values) => {
            await masterDataApi.persistWithLogo({
              resource: 'bank-branches',
              values: { ...values, bankId: bank.id },
              title: `شعبه ${values.name ?? selectedBranch?.name ?? ''}`,
              ...(formMode === 'edit' && selectedBranch
                ? { existing: selectedBranch }
                : {}),
            });
            setFormMode(null);
            setNotice('شعبه بانک با موفقیت ذخیره شد.');
            if (page === 1) await load();
            else setPage(1);
          }}
          open
          {...(selectedBranch ? { record: selectedBranch } : {})}
        />
      ) : null}
    </>
  );
}
