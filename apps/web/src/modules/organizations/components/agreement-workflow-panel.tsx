'use client';
import { NativeSearchSelect } from '@/components/ui/native-search-select';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type {
  B2bAgreementCaseV1,
  B2bAgreementRevisionV1,
  B2bAgreementTermsV1,
  B2bCooperationRole,
  IamPermissionCode,
} from '@nora/contracts';
import { b2bAgreementTermsIssue, B2B_AGREEMENT_TYPES } from '@nora/contracts';
import {
  Plus,
  RefreshCw,
  FileText,
  History,
  Send,
  Pencil,
  ShieldCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import { agencyClient, B2bApiError } from '../api/agency-client';
import {
  blankAgreementTerms,
  agreementUploadContextKey,
  agreementUploadIsBusy,
  editableAgreementTerms,
  reviewLabels,
  serviceLabels,
} from '../model/agreement-terms';
import { AgreementTermsEditor } from './agreement-terms-editor';
import { temporaryCreditIssue } from '../model/temporary-credit';
import { DossierDateFilters } from './dossier-date-filters';
import {
  agreementMatchesRange,
  agreementReport,
  collectAgreementExport,
} from '../model/commercial-export';
import { CommercialExportActions } from './commercial-export-actions';
import { documentsApi } from '@/modules/documents/api/client';
import { organizationDocumentQuery } from '../model/organization-documents';
import { ConfidentialAccessCodeInput } from './inline-document-upload';
import { useDossierBranch } from './use-dossier-branch';

export function savedAgreementSubmission(
  record: B2bAgreementCaseV1,
  input: {
    actorIdentityKey: string;
    contextKey: string;
    saveRequestId: string;
    requestId: string;
    grantContextKey: string;
  },
) {
  if (input.requestId === input.saveRequestId)
    throw new Error(
      'ذخیره و ارسال باید شناسه‌های درخواست جداگانه داشته باشند.',
    );
  return {
    record,
    kind: 'submit' as const,
    reason: 'ارسال برای بررسی قرارداد و اعتبار',
    requestId: input.requestId,
    grantContextKey: input.grantContextKey,
    actorIdentityKey: input.actorIdentityKey,
    contextKey: input.contextKey,
    saveRequestId: input.saveRequestId,
  };
}

export function savedAgreementSubmitPayload(
  action: ReturnType<typeof savedAgreementSubmission>,
  branchId: string,
  role: B2bCooperationRole,
  referenceGrants: { documentId: string; token: string }[] = [],
) {
  return {
    branchId,
    role,
    requestId: action.requestId,
    version: action.record.version,
    reason: action.reason,
    ...(referenceGrants.length ? { referenceGrants } : {}),
  };
}

const proofIds = (terms: B2bAgreementTermsV1) =>
  [...new Set([terms.documentId, ...terms.guarantees.map((g) => g.documentId)])]
    .filter((id): id is string => Boolean(id))
    .sort();
const proofIdentity = (terms: B2bAgreementTermsV1) =>
  [
    `${terms.documentId ?? ''}:${terms.documentVersionId ?? ''}`,
    ...terms.guarantees.map(
      (guarantee) =>
        `${guarantee.documentId ?? ''}:${guarantee.documentVersionId ?? ''}`,
    ),
  ].join('|');

export function uploadedAgreementReferenceState(
  scope: string,
  documentId: string,
  token: string,
) {
  return {
    scope,
    phase: 'checking' as const,
    protectedReferences: new Set([documentId]),
    codes: {},
    grants: { [documentId]: token },
  };
}

export interface AgreementReferenceState {
  scope: string;
  phase: 'checking' | 'ready' | 'failed';
  protectedReferences: Set<string>;
  codes: Record<string, string>;
  grants: Record<string, string>;
}

export function rejectedAgreementReferenceGrantState(
  state: AgreementReferenceState,
  documentIds: readonly string[],
): AgreementReferenceState {
  const grants = { ...state.grants };
  const codes = { ...state.codes };
  for (const id of documentIds) {
    delete grants[id];
    codes[id] = '';
  }
  return { ...state, grants, codes };
}

export async function protectedAgreementProofIds(
  organizationId: string,
  branchId: string,
  ids: readonly string[],
) {
  const unresolved = new Set(ids);
  const protectedIds = new Set<string>();
  for (let page = 1; unresolved.size && page <= 100; page++) {
    const response = await documentsApi.list({
      ...organizationDocumentQuery(organizationId, branchId, page),
      pageSize: 100,
    });
    for (const item of response.data) {
      if (!unresolved.delete(item.id)) continue;
      if (item.requiresConfidentialAccessCode) protectedIds.add(item.id);
    }
    if (page >= response.meta.totalPages) break;
  }
  if (unresolved.size)
    throw new Error(
      'وضعیت دسترسی همه اسناد قرارداد قابل تأیید نیست؛ فهرست اسناد را دوباره دریافت کنید.',
    );
  return protectedIds;
}

function RevisionSummary({
  revision,
  view = 'agreements',
}: {
  revision: B2bAgreementRevisionV1;
  view?: 'agreements' | 'credit' | 'guarantees' | 'temporary';
}) {
  return (
    <div className="agreement-summary">
      <div className="summary-list" hidden={view !== 'agreements'}>
        {[
          ['عنوان', revision.title],
          ['نوع قرارداد', B2B_AGREEMENT_TYPES[revision.agreementType]],
          [
            'اعتبار زمانی',
            `${revision.startsAt} تا ${revision.endsAt ?? 'بدون پایان'}`,
          ],
          ['ارزها', revision.currencyCodes.join('، ')],
          [
            'روش پرداخت',
            revision.paymentMethodName ?? 'در نسخه قدیمی انتخاب نشده',
          ],
          ['خدمات', revision.services.map((s) => serviceLabels[s]).join('، ')],
          [
            'پرداخت',
            { PREPAID: 'پیش‌پرداخت', CREDIT: 'اعتباری', MIXED: 'ترکیبی' }[
              revision.paymentMethod
            ],
          ],
          [
            'تسویه',
            `${{ PER_ORDER: 'هر سفارش', WEEKLY: 'هفتگی', MONTHLY: 'ماهانه', CUSTOM: 'تعداد روز مشخص' }[revision.settlementCycle]}، مهلت ${revision.settlementDays} روز${revision.cutoffDay ? `، روز بستن حساب ${revision.cutoffDay}` : ''}`,
          ],
          [
            'مهلت پاسخ‌گویی',
            revision.slaHours ? `${revision.slaHours} ساعت` : 'تعیین نشده',
          ],
          ['شرایط لغو', revision.cancellationTerms || '—'],
          ['شرایط استرداد', revision.refundTerms || '—'],
          ['یادداشت', revision.notes || '—'],
          ['دلیل نسخه', revision.changeReason],
          [
            'سند قرارداد',
            revision.documentVersionId
              ? 'نسخه ثابت سند متصل است'
              : 'بدون پیوست',
          ],
          ['نتیجه بررسی', revision.reviewReason ?? '—'],
        ].map(([label, text]) => (
          <div className="summary-row" key={label}>
            <span>{label}</span>
            <b>{text}</b>
          </div>
        ))}
      </div>
      {view !== 'guarantees' && revision.creditPolicies.length ? (
        <>
          <h4>سقف‌های ارزی این نسخه</h4>
          <div className="agreement-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ارز</th>
                  <th>سقف</th>
                  <th>کنترل</th>
                  <th>مهلت بدهی</th>
                  <th>سررسید گذشته</th>
                  <th>اعتبار</th>
                </tr>
              </thead>
              <tbody>
                {revision.creditPolicies.map((p) => (
                  <tr key={p.currencyCode}>
                    <td dir="ltr">{p.currencyCode}</td>
                    <td dir="ltr">{p.creditLimit}</td>
                    <td>{p.limitType === 'HARD' ? 'سخت' : 'نرم'}</td>
                    <td>{p.dueDays} روز</td>
                    <td>{p.overdueAction === 'BLOCK' ? 'توقف' : 'هشدار'}</td>
                    <td>
                      {p.effectiveFrom} — {p.expiresAt ?? 'بدون پایان'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      {(view === 'agreements' || view === 'guarantees') &&
      revision.guarantees.length ? (
        <>
          <h4>تضمین‌های این نسخه</h4>
          {revision.guarantees.map((g, i) => (
            <div className="agreement-subcard" key={i}>
              <b>
                {
                  {
                    BANK_GUARANTEE: 'ضمانت‌نامه بانکی',
                    CHEQUE: 'چک تضمین',
                    DEPOSIT_REQUIREMENT: 'شرط سپرده',
                    OTHER: 'سایر تضمین',
                  }[g.kind]
                }{' '}
                — {g.reference}
              </b>
              <p>
                {g.amount} {g.currencyCode} · {g.issuer} ·{' '}
                {g.status === 'RECEIVED' ? 'دریافت‌شده' : 'موردنیاز'}
              </p>
              <p>
                تاریخ: {g.receivedAt} · انقضا: {g.expiresAt ?? 'بدون پایان'} ·{' '}
                {g.documentVersionId ? 'سند متصل' : 'بدون سند'}
              </p>
            </div>
          ))}
        </>
      ) : null}
      <p className="panel-note">
        ثبت نسخه: {new Date(revision.createdAt).toLocaleString('fa-IR')}
        {revision.submittedAt
          ? ` · ارسال: ${new Date(revision.submittedAt).toLocaleString('fa-IR')}`
          : ''}
        {revision.reviewedAt
          ? ` · بررسی: ${new Date(revision.reviewedAt).toLocaleString('fa-IR')}`
          : ''}
      </p>
    </div>
  );
}

export function AgreementWorkflowPanel({
  organizationId,
  organizationName = organizationId,
  role,
  view = 'agreements',
}: {
  organizationId: string;
  organizationName?: string;
  role: B2bCooperationRole;
  view?: 'agreements' | 'credit' | 'guarantees' | 'temporary';
}) {
  const {
    branches,
    branchId,
    setBranchId,
    permissions,
    sessionError,
    sessionContextKey,
    actorUserId: userId,
    actorIdentityKey,
  } = useDossierBranch();
  const workflowContextIdentity = JSON.stringify([
    actorIdentityKey,
    sessionContextKey,
    organizationId,
    branchId,
    role,
    view,
  ]);
  const [workflowGeneration, setWorkflowGeneration] = useState(0);
  const previousWorkflowContext = useRef(workflowContextIdentity);
  useEffect(() => {
    if (previousWorkflowContext.current !== workflowContextIdentity) {
      previousWorkflowContext.current = workflowContextIdentity;
      setWorkflowGeneration((generation) => generation + 1);
    }
  }, [workflowContextIdentity]);
  const workflowContextKey = JSON.stringify([
    workflowContextIdentity,
    workflowGeneration,
  ]);
  const [records, setRecords] = useState<B2bAgreementCaseV1[]>([]);
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState<{
    record?: B2bAgreementCaseV1;
    terms: B2bAgreementTermsV1;
    requestId: string;
    grantContextKey: string;
    actorIdentityKey: string;
    contextKey: string;
    permissions: readonly IamPermissionCode[];
  } | null>(null);
  const [action, setAction] = useState<{
    record: B2bAgreementCaseV1;
    kind: 'submit' | 'APPROVE' | 'REJECT';
    reason: string;
    requestId: string;
    grantContextKey: string;
    actorIdentityKey: string;
    contextKey: string;
    saveRequestId?: string;
    referenceGrants?: { documentId: string; token: string }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingOwnerKey, setUploadingOwnerKey] = useState<string | null>(
    null,
  );
  const [uncertain, setUncertain] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [referenceState, setReferenceState] =
    useState<AgreementReferenceState | null>(null);
  const sequence = useRef(0);
  const operationLock = useRef(false);
  const liveWorkflowContext = useRef(workflowContextKey);
  const liveEditorRequestId = useRef(editor?.requestId);
  const liveActionRequestId = useRef(action?.requestId);
  useLayoutEffect(() => {
    liveWorkflowContext.current = workflowContextKey;
    liveEditorRequestId.current = editor?.requestId;
    liveActionRequestId.current = action?.requestId;
  }, [workflowContextKey, editor?.requestId, action?.requestId]);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    setError('');
    setRecords([]);
    try {
      if (dateRange.from && dateRange.to && dateRange.from > dateRange.to) {
        setPages(1);
        return;
      }
      if (!sessionContextKey) {
        if (sessionError) throw new Error(sessionError);
        return;
      }
      const branch = branchId;
      if (!branch) throw new Error('شعبه مجاز وجود ندارد.');
      if (
        !permissions.includes('b2b.agreement.read') ||
        !permissions.includes('b2b.credit.read')
      )
        throw new Error(
          'برای مشاهده قرارداد و سیاست‌های ارزی، مجوز مشاهده قرارداد و اعتبار لازم است.',
        );
      const response = await agencyClient.agreements(
        organizationId,
        branch,
        role,
        dateRange.from || dateRange.to ? 1 : page,
      );
      if (current !== sequence.current) return;
      if (dateRange.from || dateRange.to) {
        const all = [...response.data];
        for (let next = 2; next <= response.meta.totalPages; next++) {
          const result = await agencyClient.agreements(
            organizationId,
            branch,
            role,
            next,
          );
          if (current !== sequence.current) return;
          all.push(...result.data);
        }
        setRecords(
          all.filter((record) =>
            agreementMatchesRange(record, view, dateRange),
          ),
        );
        setPages(1);
      } else {
        setRecords(response.data);
        setPages(response.meta.totalPages);
      }
    } catch (caught) {
      if (current === sequence.current)
        setError(
          caught instanceof Error
            ? caught.message
            : 'دریافت قراردادها ناموفق بود.',
        );
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [
    organizationId,
    role,
    branchId,
    page,
    dateRange,
    view,
    permissions,
    sessionContextKey,
    sessionError,
  ]);
  const invalidate = useCallback(() => {
    ++sequence.current;
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      invalidate();
    };
  }, [load, refresh, invalidate]);
  const currentEditor =
    editor?.actorIdentityKey === actorIdentityKey &&
    editor.contextKey === workflowContextKey
      ? editor
      : null;
  const currentAction =
    action?.actorIdentityKey === actorIdentityKey &&
    action.contextKey === workflowContextKey
      ? action
      : null;
  const editorUploadContextKey = currentEditor
    ? agreementUploadContextKey(
        userId,
        sessionContextKey,
        organizationId,
        branchId,
        currentEditor.grantContextKey,
      )
    : '';
  const uploading = agreementUploadIsBusy(
    editorUploadContextKey,
    uploadingOwnerKey,
  );
  const setUploadBusy = (isBusy: boolean, contextKey: string) =>
    setUploadingOwnerKey((current) =>
      isBusy ? contextKey : current === contextKey ? null : current,
    );
  const activeTerms =
    currentEditor?.terms ?? currentAction?.record.revisions[0];
  const activeProofKey = activeTerms ? proofIdentity(activeTerms) : '';
  const grantContextKey =
    currentEditor?.grantContextKey ?? currentAction?.grantContextKey ?? '';
  const proofIdsKey = JSON.stringify(activeTerms ? proofIds(activeTerms) : []);
  const shouldCheckReferences =
    Boolean(activeTerms && activeProofKey) && currentAction?.kind !== 'REJECT';
  const hasEditor = Boolean(currentEditor);
  const referenceScopeKey = JSON.stringify([
    actorIdentityKey,
    sessionContextKey,
    organizationId,
    branchId,
    activeProofKey,
    grantContextKey,
  ]);
  const currentReferenceState =
    referenceState?.scope === referenceScopeKey ? referenceState : null;
  const protectedReferences =
    currentReferenceState?.protectedReferences ?? new Set<string>();
  const referenceCodes = currentReferenceState?.codes ?? {};
  const referenceGrants = currentReferenceState?.grants ?? {};
  const checkingReferences =
    shouldCheckReferences &&
    (!currentReferenceState || currentReferenceState.phase === 'checking');
  const referenceCheckFailed = currentReferenceState?.phase === 'failed';
  const updateReferenceState = (
    update: (
      current: NonNullable<typeof currentReferenceState>,
    ) => NonNullable<typeof currentReferenceState>,
  ) =>
    setReferenceState((previous) => {
      const current =
        previous?.scope === referenceScopeKey
          ? previous
          : {
              scope: referenceScopeKey,
              phase: 'ready' as const,
              protectedReferences: new Set<string>(),
              codes: {},
              grants: {},
            };
      return update(current);
    });
  const setReferenceCode = (documentId: string, code: string) =>
    updateReferenceState((current) => ({
      ...current,
      codes: { ...current.codes, [documentId]: code },
    }));
  const setReferenceGrant = (documentId: string, token: string) =>
    updateReferenceState((current) => ({
      ...current,
      grants: { ...current.grants, [documentId]: token },
    }));
  const completeConfidentialUpload = (
    documentId: string,
    token: string,
    terms: B2bAgreementTermsV1,
  ) => {
    if (!currentEditor) return;
    const nextScope = JSON.stringify([
      actorIdentityKey,
      sessionContextKey,
      organizationId,
      branchId,
      proofIdentity(terms),
      currentEditor.grantContextKey,
    ]);
    setEditor({
      ...currentEditor,
      terms,
      requestId: crypto.randomUUID(),
    });
    setReferenceState(
      uploadedAgreementReferenceState(nextScope, documentId, token),
    );
    setDialogError('');
  };
  const clearRejectedReferenceGrants = (
    caught: unknown,
    documentIds: readonly string[],
  ) => {
    if (
      !(caught instanceof B2bApiError) ||
      caught.code !== 'DOCUMENT_CONFIDENTIAL_CODE_REQUIRED'
    )
      return false;
    setReferenceState((previous) =>
      previous?.scope === referenceScopeKey
        ? rejectedAgreementReferenceGrantState(previous, documentIds)
        : previous,
    );
    return true;
  };
  useEffect(() => {
    let active = true;
    if (!shouldCheckReferences) {
      return () => {
        active = false;
      };
    }
    if (!sessionContextKey || !branchId) return;
    void protectedAgreementProofIds(
      organizationId,
      branchId,
      JSON.parse(proofIdsKey) as string[],
    )
      .then((ids) => {
        if (active) {
          setReferenceState((previous) => {
            const grants =
              previous?.scope === referenceScopeKey ? previous.grants : {};
            return {
              scope: referenceScopeKey,
              phase: 'ready',
              protectedReferences: new Set([...ids, ...Object.keys(grants)]),
              codes:
                previous?.scope === referenceScopeKey ? previous.codes : {},
              grants,
            };
          });
        }
      })
      .catch((caught) => {
        if (active) {
          setReferenceState((previous) => ({
            scope: referenceScopeKey,
            phase: 'failed',
            protectedReferences: new Set(),
            codes: previous?.scope === referenceScopeKey ? previous.codes : {},
            grants:
              previous?.scope === referenceScopeKey ? previous.grants : {},
          }));
          setDialogError(
            caught instanceof Error
              ? caught.message
              : 'بررسی دسترسی اسناد قرارداد ناموفق بود.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [
    organizationId,
    branchId,
    sessionContextKey,
    referenceScopeKey,
    grantContextKey,
    proofIdsKey,
    hasEditor,
    shouldCheckReferences,
  ]);

  async function grantsFor(ids: readonly string[]) {
    const required = ids.filter((id) => protectedReferences.has(id));
    const result: { documentId: string; token: string }[] = [];
    for (const documentId of required) {
      const existing = referenceGrants[documentId];
      if (existing) {
        result.push({ documentId, token: existing });
        continue;
      }
      const code = referenceCodes[documentId];
      if (!code) throw new Error('کد دسترسی هر سند محرمانه را وارد کنید.');
      const response = await documentsApi.createAccessGrant(documentId, {
        code,
        purpose: 'CONFIDENTIAL_VIEW',
      });
      const token = response.data.token;
      result.push({ documentId, token });
      setReferenceGrant(documentId, token);
    }
    return result;
  }
  const canManage =
    permissions.includes('b2b.agreement.manage') &&
    permissions.includes('b2b.agreement.read') &&
    permissions.includes('b2b.credit.read');
  const formTitle =
    view === 'guarantees'
      ? 'ثبت و ویرایش تضمین'
      : view === 'temporary'
        ? 'درخواست افزایش موقت اعتبار'
        : 'ثبت و ویرایش سیاست اعتبار';
  function edit(record?: B2bAgreementCaseV1) {
    setDialogError('');
    setUncertain(false);
    setReferenceState(null);
    const latest = record?.revisions[0];
    setEditor({
      ...(record ? { record } : {}),
      terms: latest
        ? {
            ...editableAgreementTerms(latest),
            creditPolicies: latest.creditPolicies.map((p) => ({ ...p })),
            guarantees: latest.guarantees.map((g) => ({ ...g })),
            changeReason: latest.status === 'DRAFT' ? latest.changeReason : '',
          }
        : {
            ...blankAgreementTerms(),
            ...(record
              ? {
                  title: record.title,
                  startsAt: record.startsAt,
                  endsAt: record.endsAt,
                }
              : {}),
          },
      requestId: crypto.randomUUID(),
      grantContextKey: crypto.randomUUID(),
      actorIdentityKey,
      contextKey: workflowContextKey,
      permissions,
    });
  }
  function begin(
    record: B2bAgreementCaseV1,
    kind: 'submit' | 'APPROVE' | 'REJECT',
  ) {
    setDialogError('');
    setUncertain(false);
    setReferenceState(null);
    setAction({
      record,
      kind,
      reason: kind === 'submit' ? 'ارسال برای بررسی قرارداد و اعتبار' : '',
      requestId: crypto.randomUUID(),
      grantContextKey: crypto.randomUUID(),
      actorIdentityKey,
      contextKey: workflowContextKey,
    });
  }
  async function save() {
    if (
      !currentEditor ||
      busy ||
      operationLock.current ||
      uploading ||
      checkingReferences ||
      referenceCheckFailed
    )
      return;
    if (view === 'temporary') {
      const issue = temporaryCreditIssue(
        currentEditor.terms.creditPolicies,
        currentEditor.record?.revisions[0]?.creditPolicies ?? [],
      );
      if (issue) {
        setDialogError(issue);
        return;
      }
    }
    if (!currentEditor.terms.paymentMethodId) {
      setDialogError('روش پرداخت را از اطلاعات پایه انتخاب کنید.');
      return;
    }
    const issue = b2bAgreementTermsIssue(currentEditor.terms);
    if (issue) {
      setDialogError(issue);
      return;
    }
    const editorSnapshot = currentEditor;
    const contextKey = editorSnapshot.contextKey;
    const saveRequestId = editorSnapshot.requestId;
    const codesForPublication = { ...referenceCodes };
    operationLock.current = true;
    setBusy(true);
    setDialogError('');
    const referenceDocumentIds = proofIds(editorSnapshot.terms);
    try {
      const grants = await grantsFor(referenceDocumentIds);
      if (
        liveWorkflowContext.current !== contextKey ||
        liveEditorRequestId.current !== saveRequestId
      )
        return;
      const response = await agencyClient.saveAgreementTerms(
        organizationId,
        {
          branchId,
          role,
          requestId: saveRequestId,
          ...(editorSnapshot.record
            ? { version: editorSnapshot.record.version }
            : {}),
          terms: editorSnapshot.terms,
          ...(grants.length ? { referenceGrants: grants } : {}),
        },
        editorSnapshot.record?.id,
      );
      if (
        liveWorkflowContext.current !== contextKey ||
        liveEditorRequestId.current !== saveRequestId
      )
        return;
      const savedRecord = response;
      setEditor(null);
      setReferenceState(null);
      setUncertain(false);
      setRefresh((n) => n + 1);
      if (view !== 'agreements') {
        setNotice('قرارداد، سقف‌ها و تضمین‌ها ذخیره شد.');
        return;
      }

      const submitAction = savedAgreementSubmission(savedRecord, {
        actorIdentityKey,
        contextKey,
        saveRequestId,
        requestId: crypto.randomUUID(),
        grantContextKey: crypto.randomUUID(),
      });
      setAction(submitAction);
      setNotice('نسخه ذخیره شد؛ در حال ارسال برای بررسی مستقل.');

      const revision = savedRecord.revisions[0];
      if (!revision) {
        setDialogError(
          'نسخه ذخیره شد، اما نسخهٔ قابل ارسال از سرور دریافت نشد.',
        );
        return;
      }
      try {
        const submissionProofIds = proofIds(revision);
        const protectedIds = await protectedAgreementProofIds(
          organizationId,
          branchId,
          submissionProofIds,
        );
        if (liveWorkflowContext.current !== contextKey) return;
        if (
          [...protectedIds].some(
            (documentId) => !codesForPublication[documentId]?.trim(),
          )
        ) {
          setNotice(
            'نسخه ذخیره شد؛ برای ارسال، کد محرمانگی اسناد را وارد کنید.',
          );
          return;
        }
        const freshGrants: { documentId: string; token: string }[] = [];
        for (const documentId of protectedIds) {
          if (liveWorkflowContext.current !== contextKey) return;
          const grant = await documentsApi.createAccessGrant(documentId, {
            code: codesForPublication[documentId] ?? '',
            purpose: 'CONFIDENTIAL_VIEW',
          });
          freshGrants.push({ documentId, token: grant.data.token });
        }
        if (liveWorkflowContext.current !== contextKey) return;
        const actionWithGrants = {
          ...submitAction,
          referenceGrants: freshGrants,
        };
        setAction(actionWithGrants);
        await agencyClient.agreementAction(
          organizationId,
          savedRecord.id,
          'submit',
          savedAgreementSubmitPayload(
            actionWithGrants,
            branchId,
            role,
            actionWithGrants.referenceGrants,
          ),
        );
        if (liveWorkflowContext.current !== contextKey) return;
        setAction(null);
        setReferenceState(null);
        setUncertain(false);
        setDialogError('');
        setNotice('نسخه برای تأیید مستقل ارسال شد.');
        setRefresh((n) => n + 1);
      } catch (submitError) {
        if (liveWorkflowContext.current !== contextKey) return;
        const grantRejected = clearRejectedReferenceGrants(
          submitError,
          proofIds(revision),
        );
        if (grantRejected) {
          setReferenceState(null);
          setAction((previous) => {
            if (previous?.requestId !== submitAction.requestId) return previous;
            const renewed = { ...previous };
            delete renewed.referenceGrants;
            return renewed;
          });
        }
        setDialogError(
          submitError instanceof Error
            ? submitError.message
            : 'نسخه ذخیره شد، اما ارسال برای بررسی ناموفق بود.',
        );
        setUncertain(
          !(submitError instanceof B2bApiError) ||
            submitError.status <= 0 ||
            submitError.status >= 500,
        );
      }
    } catch (caught) {
      if (liveWorkflowContext.current !== contextKey) return;
      const grantRejected = clearRejectedReferenceGrants(
        caught,
        referenceDocumentIds,
      );
      setDialogError(
        grantRejected
          ? 'مجوز موقت یکی از اسناد منقضی یا با نشست جاری ناسازگار است؛ کد محرمانگی را دوباره وارد کنید.'
          : caught instanceof Error
            ? caught.message
            : 'ذخیره ناموفق بود.',
      );
      setUncertain(
        !grantRejected &&
          !(
            caught instanceof B2bApiError &&
            caught.status > 0 &&
            caught.status < 500
          ),
      );
    } finally {
      operationLock.current = false;
      setBusy(false);
    }
  }
  async function perform() {
    if (
      !currentAction ||
      busy ||
      operationLock.current ||
      checkingReferences ||
      referenceCheckFailed
    )
      return;
    if (currentAction.reason.trim().length < 3) {
      setDialogError('توضیح ارسال یا نتیجه بررسی را وارد کنید.');
      return;
    }
    const actionSnapshot = currentAction;
    const contextKey = actionSnapshot.contextKey;
    operationLock.current = true;
    setBusy(true);
    setDialogError('');
    const referenceDocumentIds =
      actionSnapshot.kind === 'REJECT'
        ? []
        : actionSnapshot.record.revisions[0]
          ? proofIds(actionSnapshot.record.revisions[0])
          : [];
    try {
      const grants =
        actionSnapshot.kind === 'REJECT'
          ? []
          : (actionSnapshot.referenceGrants ??
            (await grantsFor(referenceDocumentIds)));
      if (
        liveWorkflowContext.current !== contextKey ||
        liveActionRequestId.current !== actionSnapshot.requestId
      )
        return;
      if (!actionSnapshot.referenceGrants)
        setAction({ ...actionSnapshot, referenceGrants: grants });
      await agencyClient.agreementAction(
        organizationId,
        actionSnapshot.record.id,
        actionSnapshot.kind === 'submit' ? 'submit' : 'review',
        {
          branchId,
          role,
          requestId: actionSnapshot.requestId,
          version: actionSnapshot.record.version,
          reason: actionSnapshot.reason,
          ...(actionSnapshot.kind !== 'submit'
            ? { decision: actionSnapshot.kind }
            : {}),
          ...(grants.length ? { referenceGrants: grants } : {}),
        },
      );
      if (
        liveWorkflowContext.current !== contextKey ||
        liveActionRequestId.current !== actionSnapshot.requestId
      )
        return;
      setAction(null);
      setReferenceState(null);
      setUncertain(false);
      setNotice(
        actionSnapshot.kind === 'submit'
          ? 'نسخه برای تأیید مستقل ارسال شد.'
          : actionSnapshot.kind === 'APPROVE'
            ? 'قرارداد و شرایط این نسخه تأیید شد.'
            : 'نسخه رد شد؛ علت در تاریخچه ثبت شده است.',
      );
      setRefresh((n) => n + 1);
    } catch (caught) {
      if (
        liveWorkflowContext.current !== contextKey ||
        liveActionRequestId.current !== actionSnapshot.requestId
      )
        return;
      const grantRejected = clearRejectedReferenceGrants(
        caught,
        referenceDocumentIds,
      );
      if (grantRejected)
        setAction((previous) => {
          if (previous?.requestId !== actionSnapshot.requestId) return previous;
          const renewed = { ...previous };
          delete renewed.referenceGrants;
          return renewed;
        });
      setDialogError(
        grantRejected
          ? 'مجوز موقت یکی از اسناد منقضی یا با نشست جاری ناسازگار است؛ کد محرمانگی را دوباره وارد کنید.'
          : caught instanceof Error
            ? caught.message
            : 'ثبت نتیجه ناموفق بود.',
      );
      setUncertain(
        !grantRejected &&
          !(
            caught instanceof B2bApiError &&
            caught.status > 0 &&
            caught.status < 500
          ),
      );
    } finally {
      operationLock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="agreement-workflow">
      <div className="agreement-row-title agreement-toolbar dossier-filter-grid">
        <div className="commercial-section-heading">
          {view === 'agreements' ? (
            <div>
              <h3>قراردادهای همکاری</h3>
              <p className="panel-note">
                نسخه‌بندی، ویرایش پیش‌نویس و تأیید مستقل قرارداد و شرایط ارزی
              </p>
            </div>
          ) : null}
          <div className="commercial-section-actions">
            {canManage &&
            view !== 'agreements' &&
            permissions.includes('b2b.credit.manage') ? (
              <label className="field">
                <span>{formTitle}</span>
                <NativeSearchSelect
                  className="input"
                  value=""
                  disabled={loading || !branchId}
                  onChange={(e) => {
                    const selected = records.find(
                      (r) => r.id === e.target.value,
                    );
                    if (selected) edit(selected);
                  }}
                >
                  <option value="">انتخاب قرارداد مرتبط</option>
                  {records
                    .filter((r) => r.revisions[0]?.status !== 'PENDING')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                </NativeSearchSelect>
              </label>
            ) : null}
            {canManage && view === 'agreements' ? (
              <button
                className="btn primary"
                disabled={loading || !branchId}
                onClick={() => edit()}
              >
                <Plus size={16} />
                قرارداد جدید
              </button>
            ) : null}
            <CommercialExportActions
              key={`${organizationId}:${role}:${branchId}:${view}:${dateRange.from}:${dateRange.to}:${refresh}`}
              disabled={
                loading ||
                !!error ||
                !branchId ||
                !permissions.includes('b2b.agreement.read') ||
                !permissions.includes('b2b.credit.read') ||
                !!(
                  dateRange.from &&
                  dateRange.to &&
                  dateRange.from > dateRange.to
                )
              }
              loadReport={async (isCurrent) => {
                const all = await collectAgreementExport(
                  (page) =>
                    agencyClient.agreements(
                      organizationId,
                      branchId,
                      role,
                      page,
                    ),
                  isCurrent,
                );
                return agreementReport(all, view, dateRange, [
                  `سازمان: ${organizationName}`,
                  `شعبه: ${branches.find((b) => b.id === branchId)?.name ?? branchId}`,
                  `نقش: ${role === 'AGENCY' ? 'آژانس' : 'مشتری سازمانی'}`,
                ]);
              }}
            />
          </div>
        </div>
        <DossierDateFilters
          value={dateRange}
          onChange={(value) => {
            setDateRange(value);
            setPage(1);
          }}
          basis={
            view === 'guarantees'
              ? 'تاریخ تضمین'
              : view === 'credit' || view === 'temporary'
                ? 'شروع سقف اعتبار'
                : 'شروع قرارداد'
          }
        />
        <label className="field">
          <span>شعبه قرارداد</span>
          <NativeSearchSelect
            className="input"
            value={branchId}
            disabled={loading}
            onChange={(e) => {
              setBranchId(e.target.value);
              setPage(1);
              setNotice('');
            }}
          >
            {branches.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </NativeSearchSelect>
        </label>
        <button
          className="btn"
          disabled={loading}
          onClick={() => setRefresh((n) => n + 1)}
        >
          <RefreshCw size={16} />
          تازه‌سازی
        </button>
      </div>

      {error ? (
        <div role="alert" className="form-error">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="boundary-note">
          {notice}
        </div>
      ) : null}
      {view === 'credit' ? (
        <div className="boundary-note">
          سقف‌ها پس از تأیید و در بازه اعتبارشان معتبرند. مانده قابل‌استفاده
          تنها با دریافت مانده مالی محاسبه می‌شود؛ اتصال مانده مالی این بخش هنوز
          آماده نیست.
        </div>
      ) : null}
      {loading ? (
        <p role="status">در حال دریافت قراردادها…</p>
      ) : !error && !records.length ? (
        <div className="agreement-empty">
          <FileText size={32} />
          <h4>قراردادی در این شعبه ثبت نشده است</h4>
          <p>قرارداد و شرایط همکاری را به صورت پیش‌نویس ثبت کنید.</p>
        </div>
      ) : null}
      {records.map((record) => {
        const latest = record.revisions[0];
        const active = record.revisions.find(
          (r) => r.id === record.activeRevisionId,
        );
        const withCredit = Boolean(
          latest && (latest.creditPolicies.length || latest.guarantees.length),
        );
        const manage =
          canManage &&
          (!withCredit || permissions.includes('b2b.credit.manage'));
        const independent =
          latest &&
          latest.createdByUserId !== userId &&
          latest.submittedByUserId !== userId;
        const review =
          permissions.includes('b2b.agreement.approve') &&
          (!withCredit || permissions.includes('b2b.credit.approve')) &&
          independent;
        return (
          <article className="agreement-section" key={record.id}>
            <div className="agreement-row-title">
              <div>
                <h4>{record.title}</h4>
                <p className="panel-note">
                  <bdi>{record.code}</bdi> ·{' '}
                  {active
                    ? `نسخه تأییدشده ${active.number}`
                    : 'بدون نسخه تأییدشده'}
                </p>
              </div>
              <span
                className={`badge ${latest?.status === 'APPROVED' ? 'green' : latest?.status === 'REJECTED' ? 'red' : ''}`}
              >
                {latest
                  ? reviewLabels[latest.status]
                  : 'قرارداد قدیمی — نیازمند تکمیل شرایط'}
              </span>
            </div>
            {latest ? (
              <>
                <details open={view !== 'agreements'}>
                  <summary>
                    <FileText size={16} />
                    جزئیات نسخه {latest.number}
                  </summary>
                  <RevisionSummary revision={latest} view={view} />
                </details>
                {active && active.id !== latest.id ? (
                  <p className="boundary-note">
                    نسخه تأییدشده {active.number} تا تأیید اصلاحیه معتبر باقی
                    می‌ماند.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="panel-note">
                {record.startsAt} تا {record.endsAt ?? 'بدون پایان'}؛ برای تکمیل
                شرایط، نسخه جدید ثبت کنید.
              </p>
            )}
            <div className="agreement-actions">
              {manage && latest?.status !== 'PENDING' ? (
                <button className="btn" onClick={() => edit(record)}>
                  <Pencil size={16} />
                  {view !== 'agreements'
                    ? formTitle
                    : latest && latest.status !== 'DRAFT'
                      ? 'ثبت اصلاحیه / نسخه جدید'
                      : 'ویرایش پیش‌نویس'}
                </button>
              ) : null}
              {manage && latest?.status === 'DRAFT' ? (
                <button
                  className="btn primary"
                  onClick={() => begin(record, 'submit')}
                >
                  <Send size={16} />
                  ارسال برای تأیید
                </button>
              ) : null}
              {review && latest?.status === 'PENDING' ? (
                <>
                  <button
                    className="btn primary"
                    onClick={() => begin(record, 'APPROVE')}
                  >
                    <ShieldCheck size={16} />
                    تأیید نسخه
                  </button>
                  <button
                    className="btn danger"
                    onClick={() => begin(record, 'REJECT')}
                  >
                    رد با ذکر دلیل
                  </button>
                </>
              ) : null}
              {latest?.status === 'PENDING' && !independent ? (
                <span className="panel-note">
                  بررسی این نسخه باید توسط کاربر مستقل انجام شود.
                </span>
              ) : null}
            </div>
            {record.revisions.length > 1 ? (
              <details>
                <summary>
                  <History size={16} />
                  تاریخچه نسخه‌ها ({record.revisions.length - 1})
                </summary>
                {record.revisions.slice(1).map((revision) => (
                  <details key={revision.id}>
                    <summary>
                      نسخه {revision.number} · {reviewLabels[revision.status]}{' '}
                      {revision.id === record.activeRevisionId
                        ? '· نسخه تأییدشده'
                        : ''}
                    </summary>
                    <RevisionSummary revision={revision} />
                  </details>
                ))}
              </details>
            ) : null}
          </article>
        );
      })}
      {pages > 1 ? (
        <div className="agreement-actions">
          <button
            className="btn"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            صفحه قبل
          </button>
          <span>
            {page} / {pages}
          </span>
          <button
            className="btn"
            disabled={page >= pages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            صفحه بعد
          </button>
        </div>
      ) : null}
      {currentEditor ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy && !uploading) {
              setEditor(null);
              setReferenceState(null);
              if (uncertain) setRefresh((n) => n + 1);
            }
          }}
        >
          <DialogContent
            className="b2b-design b2b-modal agreement-modal"
            dir="rtl"
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogTitle>
              {view !== 'agreements'
                ? formTitle
                : currentEditor.record
                  ? 'ویرایش و نسخه‌بندی قرارداد'
                  : 'قرارداد جدید'}
            </DialogTitle>
            <DialogDescription>
              قرارداد و سقف‌های ارزی پس از تأیید مستقل فعال می‌شوند.
            </DialogDescription>
            <AgreementTermsEditor
              focus={view === 'agreements' ? 'all' : view}
              value={currentEditor.terms}
              role={role}
              branchId={branchId}
              organizationId={organizationId}
              permissions={permissions}
              uploadContextKey={editorUploadContextKey}
              disabled={busy || uncertain}
              onUploadStateChange={setUploadBusy}
              onConfidentialGrant={setReferenceGrant}
              onConfidentialUploadComplete={completeConfidentialUpload}
              onChange={(terms) =>
                setEditor({
                  ...currentEditor,
                  terms,
                  requestId: crypto.randomUUID(),
                })
              }
            />
            {[...protectedReferences]
              .filter((documentId) => !referenceGrants[documentId])
              .map((documentId) => (
                <ConfidentialAccessCodeInput
                  key={documentId}
                  value={referenceCodes[documentId] ?? ''}
                  onChange={(code) => setReferenceCode(documentId, code)}
                />
              ))}
            {dialogError ? (
              <div role="alert" className="form-error">
                {dialogError}
              </div>
            ) : null}
            {uncertain ? (
              <p className="boundary-note">
                نتیجه درخواست مشخص نیست؛ تلاش دوباره همان درخواست را پیگیری
                می‌کند و قرارداد تکراری نمی‌سازد.
              </p>
            ) : null}
            <div className="wizard-actions">
              <button
                className="btn"
                disabled={busy || uploading}
                onClick={() => {
                  setEditor(null);
                  setReferenceState(null);
                  if (uncertain) setRefresh((n) => n + 1);
                }}
              >
                بستن
              </button>
              <button
                className="btn primary"
                disabled={
                  busy ||
                  uploading ||
                  checkingReferences ||
                  referenceCheckFailed
                }
                onClick={() => void save()}
              >
                {busy
                  ? view === 'agreements'
                    ? 'در حال ذخیره و انتشار…'
                    : 'در حال ذخیره…'
                  : uncertain
                    ? 'پیگیری درخواست ذخیره'
                    : view === 'agreements'
                      ? 'ذخیره و انتشار'
                      : 'ذخیره تغییرات'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
      {currentAction ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) {
              setAction(null);
              setReferenceState(null);
            }
          }}
        >
          <DialogContent
            className="b2b-design b2b-modal agreement-review-modal"
            dir="rtl"
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogTitle>
              {currentAction.kind === 'submit'
                ? 'ارسال نسخه برای تأیید'
                : currentAction.kind === 'APPROVE'
                  ? 'تأیید قرارداد و شرایط ارزی'
                  : 'رد نسخه قرارداد'}
            </DialogTitle>
            <DialogDescription>
              {currentAction.record.title} · نسخه{' '}
              {currentAction.record.revisions[0]?.number}
            </DialogDescription>
            {currentAction.record.revisions[0] ? (
              <RevisionSummary revision={currentAction.record.revisions[0]} />
            ) : null}
            {currentAction.kind !== 'REJECT'
              ? [...protectedReferences]
                  .filter(
                    (documentId) =>
                      !currentAction.referenceGrants?.some(
                        (grant) => grant.documentId === documentId,
                      ),
                  )
                  .map((documentId) => (
                    <ConfidentialAccessCodeInput
                      key={documentId}
                      value={referenceCodes[documentId] ?? ''}
                      onChange={(code) => setReferenceCode(documentId, code)}
                    />
                  ))
              : null}
            <label className="field">
              <span>توضیح تصمیم *</span>
              <textarea
                className="textarea"
                maxLength={500}
                disabled={busy || uncertain}
                value={currentAction.reason}
                onChange={(e) => {
                  const nextAction = {
                    ...currentAction,
                    reason: e.target.value,
                    requestId: crypto.randomUUID(),
                    grantContextKey: crypto.randomUUID(),
                  };
                  delete nextAction.referenceGrants;
                  setAction(nextAction);
                  setReferenceState(null);
                }}
              />
            </label>
            {dialogError ? (
              <div role="alert" className="form-error">
                {dialogError}
              </div>
            ) : null}
            {uncertain ? (
              <p className="boundary-note">
                نتیجه نامشخص است؛ با همان شناسه درخواست دوباره پیگیری کنید.
              </p>
            ) : null}
            <div className="wizard-actions">
              <button
                className="btn"
                disabled={busy}
                onClick={() => {
                  setAction(null);
                  setReferenceState(null);
                }}
              >
                انصراف
              </button>
              <button
                className="btn primary"
                disabled={busy || checkingReferences || referenceCheckFailed}
                onClick={() => void perform()}
              >
                {busy
                  ? 'در حال ثبت…'
                  : uncertain
                    ? 'پیگیری درخواست'
                    : currentAction.kind === 'submit'
                      ? 'ارسال برای تأیید'
                      : currentAction.kind === 'APPROVE'
                        ? 'ثبت تأیید'
                        : 'ثبت رد'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
