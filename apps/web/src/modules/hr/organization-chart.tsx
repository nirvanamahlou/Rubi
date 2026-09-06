'use client';

import { Building2, Info, PencilLine } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import styles from './hr-workspace.module.css';

export type OrganizationNodeKind = 'MANAGEMENT' | 'UNIT';
export type OrganizationNodeStatus = 'فعال' | 'غیرفعال';

export interface OrganizationNode {
  id: string;
  name: string;
  kind: OrganizationNodeKind;
  branch: string;
  parentId: string | null;
  manager: string;
  positionCapacity: number;
  effectiveFrom: string;
  status: OrganizationNodeStatus;
}

export interface OrganizationNodeFormValue {
  id: string;
  name: string;
  kind: OrganizationNodeKind;
  branch: string;
  parentId: string;
  manager: string;
  positionCapacity: string;
  effectiveFrom: string;
  status: OrganizationNodeStatus;
}

type OrganizationNodeFormField = keyof OrganizationNodeFormValue;
export type OrganizationNodeFormErrors = Partial<
  Record<OrganizationNodeFormField, string>
>;

export const initialOrganizationNodes: readonly OrganizationNode[] = [
  {
    id: 'preview-org-management',
    name: 'مدیریت نمایشی',
    kind: 'MANAGEMENT',
    branch: 'شعبه مرکزی',
    parentId: null,
    manager: 'همکار نمایشی الف',
    positionCapacity: 1,
    effectiveFrom: '2026-03-21',
    status: 'فعال',
  },
  {
    id: 'preview-org-travel',
    name: 'واحد عملیات سفر',
    kind: 'UNIT',
    branch: 'شعبه مرکزی',
    parentId: 'preview-org-management',
    manager: 'همکار نمایشی الف',
    positionCapacity: 2,
    effectiveFrom: '2026-03-21',
    status: 'فعال',
  },
  {
    id: 'preview-org-sales',
    name: 'واحد فروش',
    kind: 'UNIT',
    branch: 'شعبه مرکزی',
    parentId: 'preview-org-management',
    manager: 'همکار نمایشی ب',
    positionCapacity: 2,
    effectiveFrom: '2026-03-21',
    status: 'فعال',
  },
  {
    id: 'preview-org-finance',
    name: 'واحد مالی',
    kind: 'UNIT',
    branch: 'شعبه مرکزی',
    parentId: 'preview-org-management',
    manager: 'همکار نمایشی پ',
    positionCapacity: 1,
    effectiveFrom: '2026-03-21',
    status: 'فعال',
  },
];

const emptyValue: OrganizationNodeFormValue = {
  id: '',
  name: '',
  kind: 'UNIT',
  branch: 'شعبه مرکزی',
  parentId: 'preview-org-management',
  manager: 'تعیین نشده',
  positionCapacity: '1',
  effectiveFrom: '',
  status: 'فعال',
};

const normalizeId = (value: string) => value.trim().toLocaleLowerCase('fa-IR');

function blockedParentIds(
  nodes: readonly OrganizationNode[],
  currentId?: string,
) {
  const blocked = new Set<string>();
  if (!currentId) return blocked;
  blocked.add(currentId);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parentId && blocked.has(node.parentId) && !blocked.has(node.id)) {
        blocked.add(node.id);
        changed = true;
      }
    }
  }
  return blocked;
}

export function validateOrganizationNodeForm(
  value: OrganizationNodeFormValue,
  existingIds: readonly string[],
  currentId?: string,
): OrganizationNodeFormErrors {
  const errors: OrganizationNodeFormErrors = {};
  const id = value.id.trim();
  const name = value.name.trim();
  const capacity = Number(value.positionCapacity);

  if (!id) errors.id = 'شناسه ساختاری الزامی است.';
  else if (id.length > 50) errors.id = 'شناسه باید حداکثر ۵۰ نویسه باشد.';
  else if (
    existingIds.some(
      (item) =>
        normalizeId(item) === normalizeId(id) &&
        normalizeId(item) !== normalizeId(currentId ?? ''),
    )
  )
    errors.id = 'این شناسه ساختاری قبلاً استفاده شده است.';

  if (!name) errors.name = 'عنوان ساختار الزامی است.';
  else if (name.length > 100)
    errors.name = 'عنوان باید حداکثر ۱۰۰ نویسه باشد.';

  if (!value.branch.trim()) errors.branch = 'شعبه الزامی است.';
  if (value.kind === 'UNIT' && !value.parentId)
    errors.parentId = 'واحد سازمانی باید یک والد داشته باشد.';
  if (
    value.positionCapacity.trim() === '' ||
    !Number.isInteger(capacity) ||
    capacity < 0 ||
    capacity > 9999
  )
    errors.positionCapacity = 'ظرفیت سمت باید عددی بین صفر تا ۹۹۹۹ باشد.';
  if (!value.effectiveFrom) errors.effectiveFrom = 'تاریخ اثر الزامی است.';

  return errors;
}

function FieldError({
  errors,
  field,
}: {
  errors: OrganizationNodeFormErrors;
  field: OrganizationNodeFormField;
}) {
  const message = errors[field];
  return message ? (
    <small className={styles.fieldError} id={`hr-org-${field}-error`}>
      {message}
    </small>
  ) : null;
}

interface OrganizationNodeFormProps {
  initialNode?: OrganizationNode | undefined;
  nodes: readonly OrganizationNode[];
  branchOptions: readonly string[];
  managerOptions: readonly string[];
  onCancel: () => void;
  onSubmit: (value: OrganizationNodeFormValue) => void;
}

export function OrganizationNodeForm({
  initialNode,
  nodes,
  branchOptions,
  managerOptions,
  onCancel,
  onSubmit,
}: OrganizationNodeFormProps) {
  const initialFormValue: OrganizationNodeFormValue = initialNode
    ? {
        ...initialNode,
        parentId: initialNode.parentId ?? '',
        positionCapacity: String(initialNode.positionCapacity),
      }
    : {
        ...emptyValue,
        branch: branchOptions[0] ?? '',
        parentId: nodes.find((node) => node.kind === 'MANAGEMENT')?.id ?? '',
      };
  const [value, setValue] = useState(initialFormValue);
  const [errors, setErrors] = useState<OrganizationNodeFormErrors>({});
  const blockedParents = blockedParentIds(nodes, initialNode?.id);
  const parentOptions = nodes.filter((node) => !blockedParents.has(node.id));
  const managers = Array.from(new Set(managerOptions));

  const update = (
    field: OrganizationNodeFormField,
    nextValue: OrganizationNodeFormValue[OrganizationNodeFormField],
  ) => {
    setValue((current) => ({
      ...current,
      [field]: nextValue,
      ...(field === 'kind' && nextValue === 'MANAGEMENT'
        ? { parentId: '' }
        : {}),
    }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const errorProps = (field: OrganizationNodeFormField) => ({
    'aria-describedby': errors[field] ? `hr-org-${field}-error` : undefined,
    'aria-invalid': Boolean(errors[field]),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateOrganizationNodeForm(
      value,
      nodes.map((node) => node.id),
      initialNode?.id,
    );
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    onSubmit({
      ...value,
      id: value.id.trim(),
      name: value.name.trim(),
      branch: value.branch.trim(),
      manager: value.manager.trim() || 'تعیین نشده',
      parentId: value.kind === 'MANAGEMENT' ? '' : value.parentId,
    });
  };

  return (
    <form noValidate onSubmit={submit}>
      <div className={styles.previewNote}>
        <Info aria-hidden="true" size={16} />
        تغییر چارت فقط در همین نشست نگه‌داری می‌شود و پس از تازه‌سازی صفحه باقی
        نمی‌ماند.
      </div>

      <fieldset className={styles.formFieldset}>
        <legend className={styles.formLegend}>مشخصات ساختار</legend>
        <div className={styles.formGrid}>
          <label className={styles.fieldLabel} htmlFor="hr-org-id">
            <span>شناسه ساختاری *</span>
            <input
              {...errorProps('id')}
              autoFocus
              className={styles.control}
              disabled={Boolean(initialNode)}
              id="hr-org-id"
              name="id"
              onChange={(event) => update('id', event.target.value)}
              placeholder="مانند HR-UNIT-04"
              value={value.id}
            />
            <FieldError errors={errors} field="id" />
          </label>
          <label className={styles.fieldLabel} htmlFor="hr-org-name">
            <span>عنوان *</span>
            <input
              {...errorProps('name')}
              className={styles.control}
              id="hr-org-name"
              name="name"
              onChange={(event) => update('name', event.target.value)}
              placeholder="عنوان مدیریت یا واحد"
              value={value.name}
            />
            <FieldError errors={errors} field="name" />
          </label>
          <label className={styles.fieldLabel} htmlFor="hr-org-kind">
            <span>نوع گره *</span>
            <select
              className={styles.control}
              id="hr-org-kind"
              name="kind"
              onChange={(event) =>
                update('kind', event.target.value as OrganizationNodeKind)
              }
              value={value.kind}
            >
              <option value="MANAGEMENT">مدیریت</option>
              <option value="UNIT">واحد سازمانی</option>
            </select>
          </label>
          <label className={styles.fieldLabel} htmlFor="hr-org-status">
            <span>وضعیت *</span>
            <select
              className={styles.control}
              id="hr-org-status"
              name="status"
              onChange={(event) =>
                update('status', event.target.value as OrganizationNodeStatus)
              }
              value={value.status}
            >
              <option value="فعال">فعال</option>
              <option value="غیرفعال">غیرفعال</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.formFieldset}>
        <legend className={styles.formLegend}>جایگاه در چارت</legend>
        <div className={styles.formGrid}>
          <label className={styles.fieldLabel} htmlFor="hr-org-branch">
            <span>شعبه *</span>
            <select
              {...errorProps('branch')}
              className={styles.control}
              id="hr-org-branch"
              name="branch"
              onChange={(event) => update('branch', event.target.value)}
              value={value.branch}
            >
              {branchOptions.map((branch) => (
                <option key={branch}>{branch}</option>
              ))}
            </select>
            <FieldError errors={errors} field="branch" />
          </label>
          <label className={styles.fieldLabel} htmlFor="hr-org-parent">
            <span>واحد والد *</span>
            <select
              {...errorProps('parentId')}
              className={styles.control}
              disabled={value.kind === 'MANAGEMENT'}
              id="hr-org-parent"
              name="parentId"
              onChange={(event) => update('parentId', event.target.value)}
              value={value.kind === 'MANAGEMENT' ? '' : value.parentId}
            >
              <option value="">
                {value.kind === 'MANAGEMENT' ? 'بدون والد' : 'انتخاب والد'}
              </option>
              {parentOptions.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
            <FieldError errors={errors} field="parentId" />
          </label>
          <label className={styles.fieldLabel} htmlFor="hr-org-manager">
            <span>مسئول / مدیر</span>
            <select
              className={styles.control}
              id="hr-org-manager"
              name="manager"
              onChange={(event) => update('manager', event.target.value)}
              value={value.manager}
            >
              <option>تعیین نشده</option>
              {managers.map((manager) => (
                <option key={manager}>{manager}</option>
              ))}
            </select>
          </label>
          <label className={styles.fieldLabel} htmlFor="hr-org-capacity">
            <span>ظرفیت سمت‌ها *</span>
            <input
              {...errorProps('positionCapacity')}
              className={styles.control}
              id="hr-org-capacity"
              inputMode="numeric"
              max="9999"
              min="0"
              name="positionCapacity"
              onChange={(event) => update('positionCapacity', event.target.value)}
              type="number"
              value={value.positionCapacity}
            />
            <FieldError errors={errors} field="positionCapacity" />
          </label>
          <label className={`${styles.fieldLabel} ${styles.full}`} htmlFor="hr-org-effective-from">
            <span>تاریخ اثر *</span>
            <DatePicker
              {...errorProps('effectiveFrom')}
              id="hr-org-effective-from"
              name="effectiveFrom"
              onChange={(nextValue) => update('effectiveFrom', nextValue)}
              placeholder="انتخاب تاریخ اثر"
              value={value.effectiveFrom}
            />
            <FieldError errors={errors} field="effectiveFrom" />
          </label>
        </div>
      </fieldset>

      <div className={styles.modalFooter}>
        <button className={styles.button} onClick={onCancel} type="button">
          انصراف
        </button>
        <button
          className={`${styles.button} ${styles.buttonPrimary}`}
          type="submit"
        >
          {initialNode ? 'ذخیره ویرایش' : 'افزودن به چارت'}
        </button>
      </div>
    </form>
  );
}

export function OrganizationChart({
  nodes,
  onEdit,
}: {
  nodes: readonly OrganizationNode[];
  onEdit: (node: OrganizationNode) => void;
}) {
  const roots = nodes.filter((node) => !node.parentId);
  const renderNode = (node: OrganizationNode, primary = false) => {
    const children = nodes.filter((item) => item.parentId === node.id);
    return (
      <div className={styles.orgBranch} key={node.id}>
        <article
          className={`${styles.orgNode} ${primary ? styles.orgNodePrimary : ''}`}
        >
          <button
            aria-label={`ویرایش ${node.name}`}
            className={styles.orgEditButton}
            onClick={() => onEdit(node)}
            type="button"
          >
            <PencilLine aria-hidden="true" size={14} />
            ویرایش
          </button>
          <div className={styles.orgNodeTitle}>
            <Building2 aria-hidden="true" size={17} />
            <b>{node.name}</b>
          </div>
          <small>{node.manager}</small>
          <div className={styles.orgNodeMeta}>
            <span>{node.kind === 'MANAGEMENT' ? 'مدیریت' : 'واحد سازمانی'}</span>
            <span>{new Intl.NumberFormat('fa-IR').format(node.positionCapacity)} سمت</span>
            <span>{node.status}</span>
          </div>
        </article>
        {children.length ? (
          <div className={styles.orgLevel}>
            {children.map((child) => renderNode(child))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className={styles.orgChart}>
      {roots.map((node) => renderNode(node, true))}
    </div>
  );
}

type OrganizationNodeDialogProps = Omit<OrganizationNodeFormProps, 'onCancel'> & {
  onClose: () => void;
};

export function OrganizationNodeDialog({
  initialNode,
  nodes,
  branchOptions,
  managerOptions,
  onClose,
  onSubmit,
}: OrganizationNodeDialogProps) {
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className={`${styles.modal} ${styles.employeeModal}`} dir="rtl">
        <DialogTitle>
          {initialNode ? 'ویرایش گره سازمانی' : 'افزودن گره سازمانی'}
        </DialogTitle>
        <DialogDescription>
          ارتباط شعبه، والد، مسئول و ظرفیت سمت‌های این گره را در چارت مشخص کنید.
        </DialogDescription>
        <OrganizationNodeForm
          initialNode={initialNode}
          branchOptions={branchOptions}
          managerOptions={managerOptions}
          nodes={nodes}
          onCancel={onClose}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
