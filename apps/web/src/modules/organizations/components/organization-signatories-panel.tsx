'use client';
import { NativeSearchSelect } from '@/components/ui/native-search-select';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  b2bSignatoryIssue,
  B2B_SIGNATORY_DOCUMENT_TYPES,
  type B2bSignatoryInputV1,
  type B2bSignatoryV1,
  type DocumentListItemV1,
  type IamPermissionCode,
} from '@nora/contracts';
import { FileSignature, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { MoneyInput } from '@/components/ui/money-input';
import { DossierDateFilters } from './dossier-date-filters';
import { inDossierDateRange } from '../model/dossier-date-range';
import { MasterDataReferenceSelector } from '@/modules/master-data/components/master-data-reference-selector';
import {
  documentsApi,
  DocumentsApiError,
} from '@/modules/documents/api/client';
import { agencyClient, B2bApiError } from '../api/agency-client';
import {
  canAttachOrganizationDocument,
  isEligibleOrganizationSignatoryProof,
  loadOrganizationSignatoryProofs,
  resolveOrganizationSignatoryProof,
} from '../model/organization-documents';
import { DossierFormDialog } from './dossier-form-dialog';
import { useDossierBranch } from './use-dossier-branch';

const labels = {
  FRAMEWORK_AGREEMENT: 'قرارداد همکاری',
  SALES_CONTRACT: 'قرارداد فروش',
  FINANCIAL_DOCUMENT: 'اسناد مالی',
  OTHER: 'سایر اسناد',
};
const blank = (branchId: string): B2bSignatoryInputV1 => ({
  branchId,
  contactId: '',
  documentTypes: ['FRAMEWORK_AGREEMENT'],
  authorityLimit: null,
  currencyCode: null,
  validFrom: new Date().toISOString().slice(0, 10),
  validTo: null,
  documentId: null,
  documentVersionId: null,
  isActive: false,
  notes: '',
});
function SignatoryFields({
  value,
  onChange,
  organizationId,
  permissions,
  onAddContact,
}: {
  value: B2bSignatoryInputV1;
  onChange: (value: B2bSignatoryInputV1) => void;
  organizationId: string;
  permissions: readonly IamPermissionCode[];
  onAddContact: () => void;
}) {
  const [documents, setDocuments] = useState<readonly DocumentListItemV1[]>([]);
  const [documentSnapshotKey, setDocumentSnapshotKey] = useState('');
  const [pagination, setPagination] = useState({ scopeKey: '', page: 1 });
  const [loadedPages, setLoadedPages] = useState(1);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [openedAt] = useState(() => Date.now());
  const canAttachDocument = canAttachOrganizationDocument(permissions);
  const documentScopeKey = JSON.stringify([
    organizationId,
    value.branchId,
    permissions,
  ]);
  const page = pagination.scopeKey === documentScopeKey ? pagination.page : 1;
  const documentRequestKey = JSON.stringify([documentScopeKey, page, reload]);
  const snapshotIsCurrent = documentSnapshotKey === documentRequestKey;
  const visibleDocuments = snapshotIsCurrent ? documents : [];
  const pages = snapshotIsCurrent ? loadedPages : 1;
  const visibleError = snapshotIsCurrent ? error : '';
  const loading = canAttachDocument && !snapshotIsCurrent;
  useEffect(() => {
    let active = true;
    if (!canAttachDocument) return;
    void loadOrganizationSignatoryProofs(
      organizationId,
      value.branchId,
      page,
      permissions,
      documentsApi.list,
    )
      .then((result) => {
        if (active && result) {
          setDocuments(result.data);
          setLoadedPages(result.meta.totalPages);
          setError('');
          setDocumentSnapshotKey(documentRequestKey);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setDocuments([]);
          setLoadedPages(1);
          setError(
            caught instanceof DocumentsApiError
              ? caught.message
              : 'دریافت مدارک ناموفق بود؛ دوباره تلاش کنید.',
          );
          setDocumentSnapshotKey(documentRequestKey);
        }
      });
    return () => {
      active = false;
    };
  }, [
    organizationId,
    value.branchId,
    permissions,
    page,
    reload,
    canAttachDocument,
    documentRequestKey,
  ]);
  const set = (patch: Partial<B2bSignatoryInputV1>) =>
    onChange({ ...value, ...patch });
  return (
    <>
      <div className="field sm:col-span-2">
        <label htmlFor="signatory-contact">شخص امضادار</label>
        <MasterDataReferenceSelector
          key={reload}
          id="signatory-contact"
          label="شخص امضادار"
          config={{
            target: 'organization-contacts',
            payload: 'id',
            scopeField: 'organizationId',
          }}
          scopeValue={organizationId}
          required
          disabled={false}
          value={value.contactId}
          onChange={(contactId) => set({ contactId })}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!permissions.includes('master_data.create')}
            onClick={onAddContact}
          >
            ثبت شخص جدید
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setReload((n) => n + 1)}
          >
            تازه‌سازی اشخاص و مدارک
          </Button>
        </div>
      </div>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 font-bold">اسناد قابل امضا</legend>
        <div className="flex flex-wrap gap-4">
          {B2B_SIGNATORY_DOCUMENT_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value.documentTypes.includes(type)}
                onChange={(event) =>
                  set({
                    documentTypes: event.target.checked
                      ? [...value.documentTypes, type]
                      : value.documentTypes.filter((item) => item !== type),
                  })
                }
              />
              {labels[type]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        سقف مبلغ اختیار (اختیاری)
        <MoneyInput
          maxLength={25}
          value={value.authorityLimit ?? ''}
          onValueChange={(authorityLimit) =>
            set({
              authorityLimit: authorityLimit || null,
              ...(authorityLimit ? {} : { currencyCode: null }),
            })
          }
        />
        <span className="panel-note">
          خالی یعنی سقف ثبت نشده است؛ به معنی اختیار نامحدود نیست.
        </span>
      </label>
      <div className="field">
        <label htmlFor="signatory-currency">ارز سقف اختیار</label>
        <MasterDataReferenceSelector
          id="signatory-currency"
          label="ارز سقف اختیار"
          config={{ target: 'currencies', payload: 'code' }}
          value={value.currencyCode ?? ''}
          disabled={value.authorityLimit === null}
          required={value.authorityLimit !== null}
          onChange={(currencyCode) =>
            set({ currencyCode: currencyCode || null })
          }
        />
        {value.authorityLimit === null ? (
          <span className="panel-note">
            برای انتخاب ارز، ابتدا سقف مبلغ اختیار را وارد کنید.
          </span>
        ) : null}
      </div>
      <div className="field">
        <span>شروع اعتبار</span>
        <DatePicker
          withinDialog
          aria-label="شروع اعتبار امضادار"
          required
          value={value.validFrom}
          onChange={(validFrom) => set({ validFrom })}
        />
      </div>
      <div className="field">
        <span>پایان اعتبار</span>
        <DatePicker
          withinDialog
          aria-label="پایان اعتبار امضادار"
          value={value.validTo ?? ''}
          onChange={(validTo) => set({ validTo: validTo || null })}
        />
      </div>
      <label className="field sm:col-span-2">
        مدرک اختیار امضا
        <NativeSearchSelect
          className="input"
          disabled={!canAttachDocument || loading}
          value={value.documentId ?? ''}
          onChange={(event) =>
            set(
              resolveOrganizationSignatoryProof(
                visibleDocuments,
                event.target.value,
                openedAt,
              ),
            )
          }
        >
          <option value="">بدون مدرک؛ ثبت غیرفعال</option>
          {value.documentId &&
          !visibleDocuments.some((d) => d.id === value.documentId) ? (
            <option value={value.documentId}>مدرک ثبت‌شده</option>
          ) : null}
          {visibleDocuments.map((document) => (
            <option
              key={document.id}
              value={document.id}
              disabled={
                !isEligibleOrganizationSignatoryProof(document, openedAt)
              }
            >
              {document.title}
              {document.currentVersion.scanStatus !== 'CLEAN'
                ? ' — در انتظار بررسی'
                : ''}
            </option>
          ))}
        </NativeSearchSelect>
        <span className="panel-note">
          از مدارک همین پرونده و شعبه انتخاب کنید. برای فعال‌سازی، مدرک باید
          کامل، معتبر و بررسی‌شده باشد.
        </span>
        {!canAttachDocument ? (
          <span className="panel-note">
            مجوز مشاهده فراداده و اتصال مدرک سازمان برای این کاربر فعال نیست.
          </span>
        ) : null}
      </label>
      {pages > 1 ? (
        <div className="flex gap-2 sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => {
              setPagination({ scopeKey: documentScopeKey, page: page - 1 });
            }}
          >
            مدارک قبلی
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={page >= pages}
            onClick={() => {
              setPagination({ scopeKey: documentScopeKey, page: page + 1 });
            }}
          >
            مدارک بعدی
          </Button>
        </div>
      ) : null}
      {visibleError ? (
        <div role="alert" className="form-error sm:col-span-2">
          <p>{visibleError}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setReload((current) => current + 1)}
          >
            تلاش دوباره
          </Button>
        </div>
      ) : null}
      <label className="field sm:col-span-2">
        توضیحات حدود اختیار
        <Textarea
          maxLength={1000}
          value={value.notes}
          onChange={(event) => set({ notes: event.target.value })}
        />
      </label>
      <label className="flex items-center gap-2 sm:col-span-2">
        <input
          type="checkbox"
          checked={value.isActive}
          disabled={!value.documentId || !value.documentVersionId}
          onChange={(event) => set({ isActive: event.target.checked })}
        />
        فعال در بازه اعتبار؛ با مدرک اختیار
      </label>
    </>
  );
}
export function OrganizationSignatoriesPanel({
  organizationId,
  onAddContact,
}: {
  organizationId: string;
  onAddContact: () => void;
}) {
  const { branches, branchId, setBranchId, permissions, sessionError } =
    useDossierBranch();
  const [rows, setRows] = useState<B2bSignatoryV1[]>([]);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<{
    id?: string;
    values: B2bSignatoryInputV1;
  }>();
  const [deleting, setDeleting] = useState<B2bSignatoryV1>();
  const [reason, setReason] = useState('');
  const sequence = useRef(0);
  const invalidate = useCallback(() => {
    ++sequence.current;
  }, []);
  const load = useCallback(async () => {
    if (!branchId) return;
    const request = ++sequence.current;
    setLoading(true);
    setError('');
    try {
      const response = await agencyClient.signatories(organizationId, branchId);
      if (request === sequence.current) setRows(response.data);
    } catch (caught) {
      if (request === sequence.current) {
        setRows([]);
        setError(
          caught instanceof Error
            ? caught.message
            : 'دریافت امضاداران ناموفق بود.',
        );
      }
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [organizationId, branchId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      invalidate();
    };
  }, [load, invalidate]);
  const close = () => {
    setEditor(undefined);
    setDeleting(undefined);
    void load();
  };
  const canManage = permissions.includes('b2b.agency.manage');
  const today = new Date().toISOString().slice(0, 10);
  const visible = rows.filter((row) =>
    inDossierDateRange(row.validFrom, dateRange),
  );
  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2 className="panel-title">
            <FileSignature size={20} />
            امضاداران
          </h2>
        </div>
        <Button
          disabled={!canManage || !branchId || loading}
          onClick={() => setEditor({ values: blank(branchId) })}
        >
          <Plus size={16} />
          افزودن امضادار
        </Button>
      </header>
      <div className="panel-body space-y-3">
        <div className="dossier-filter-grid signatory-filter-grid">
          {branches.length > 1 ? (
            <label className="field">
              شعبه داخلی مسئول همکاری
              <NativeSearchSelect
                className="input"
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </NativeSearchSelect>
            </label>
          ) : null}
          <DossierDateFilters
            value={dateRange}
            onChange={setDateRange}
            basis="شروع اختیار امضادار"
          />
        </div>
        {sessionError || error ? (
          <p role="alert" className="form-error">
            {sessionError || error}
          </p>
        ) : null}
        {loading ? (
          <p role="status">در حال دریافت امضاداران…</p>
        ) : !visible.length ? (
          <p>هنوز امضاداری ثبت نشده است؛ از «افزودن امضادار» استفاده کنید.</p>
        ) : (
          visible.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-border p-4 space-y-2"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{row.contactName}</strong>
                <span>
                  {!row.contactActive
                    ? 'شخص غیرفعال'
                    : !row.isActive
                      ? 'غیرفعال'
                      : row.validTo && row.validTo < today
                        ? 'اعتبار پایان‌یافته'
                        : row.validFrom > today
                          ? 'شروع اعتبار در آینده'
                          : 'فعال در بازه اعتبار'}
                </span>
              </div>
              <p>{row.documentTypes.map((type) => labels[type]).join('، ')}</p>
              <p>
                سقف اختیار:{' '}
                {row.authorityLimit === null
                  ? 'ثبت نشده'
                  : `${row.authorityLimit} ${row.currencyCode}`}
              </p>
              <p>
                اعتبار: <bdi>{row.validFrom}</bdi> تا{' '}
                <bdi>{row.validTo ?? 'بدون تاریخ پایان ثبت‌شده'}</bdi>
              </p>
              <p>
                {row.documentVersionId
                  ? 'مدرک اختیار متصل است'
                  : 'مدرک اختیار ثبت نشده است'}
              </p>
              {row.notes ? <p>{row.notes}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  title={`ویرایش امضادار ${row.contactName}`}
                  aria-label={`ویرایش امضادار ${row.contactName}`}
                  disabled={!canManage}
                  onClick={() =>
                    setEditor({
                      id: row.id,
                      values: {
                        branchId: row.branchId,
                        contactId: row.contactId,
                        documentTypes: row.documentTypes,
                        authorityLimit: row.authorityLimit,
                        currencyCode: row.currencyCode,
                        validFrom: row.validFrom,
                        validTo: row.validTo,
                        documentId: row.documentId,
                        documentVersionId: row.documentVersionId,
                        isActive: row.isActive,
                        notes: row.notes,
                        version: row.version,
                      },
                    })
                  }
                >
                  <Pencil aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="destructive"
                  title={`حذف دائمی امضادار ${row.contactName}`}
                  aria-label={`حذف دائمی امضادار ${row.contactName}`}
                  disabled={!canManage}
                  onClick={() => {
                    setReason('');
                    setDeleting(row);
                  }}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </article>
          ))
        )}
        <Button
          variant="outline"
          disabled={loading || !branchId}
          onClick={() => void load()}
        >
          تازه‌سازی امضاداران
        </Button>
      </div>
      {editor ? (
        <DossierFormDialog
          title={editor.id ? 'ویرایش امضادار' : 'ثبت امضادار'}
          description="شخص و حدود اختیار او را ثبت کنید. بدون مدرک معتبر می‌توانید اطلاعات را به‌صورت غیرفعال ذخیره کنید."
          onClose={close}
          onSave={async () => {
            const issue = b2bSignatoryIssue(editor.values);
            if (issue) throw new B2bApiError(issue, 400);
            await agencyClient.saveSignatory(
              organizationId,
              editor.values,
              editor.id,
            );
          }}
        >
          <SignatoryFields
            value={editor.values}
            onChange={(values) => setEditor({ ...editor, values })}
            organizationId={organizationId}
            permissions={permissions}
            onAddContact={onAddContact}
          />
        </DossierFormDialog>
      ) : null}
      {deleting ? (
        <DossierFormDialog
          title="حذف دائمی امضادار"
          description={`اختیار ثبت‌شده برای «${deleting.contactName}» حذف می‌شود؛ مشخصات شخص و مدارک پرونده حفظ می‌شوند.`}
          destructive
          onClose={close}
          onSave={async () => {
            if (reason.trim().length < 5)
              throw new B2bApiError(
                'دلیل حذف را با حداقل ۵ نویسه وارد کنید.',
                400,
              );
            await agencyClient.deleteSignatory(organizationId, deleting.id, {
              branchId,
              version: deleting.version,
              reason: reason.trim(),
            });
          }}
        >
          <label className="field sm:col-span-2">
            دلیل حذف
            <Textarea
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        </DossierFormDialog>
      ) : null}
    </section>
  );
}
