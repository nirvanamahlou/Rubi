'use client';

import { Building2, Info, PencilLine, Trash2 } from 'lucide-react';
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import styles from './hr-forms.module.css';
import { buttonVariants } from '@/components/ui/button';
import {
  initialOrganizationCatalogRecords,
  type OrganizationCatalogRecords,
} from './organization-catalog';
import { RequiredFieldLabel } from './required-field-label';

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
  catalogSource?: 'branch' | 'unit';
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

interface OrganizationChartEdge {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface OrganizationChartSize {
  width: number;
  height: number;
}

export function getOrganizationRelationships(
  nodes: readonly OrganizationNode[],
) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  return nodes.flatMap((node) =>
    node.parentId && nodeIds.has(node.parentId)
      ? [
          {
            id: `${node.parentId}-${node.id}`,
            parentId: node.parentId,
            childId: node.id,
          },
        ]
      : [],
  );
}

type OrganizationNodeFormField = keyof OrganizationNodeFormValue;
export type OrganizationNodeFormErrors = Partial<
  Record<OrganizationNodeFormField, string>
>;

const catalogStatus = (status: string): OrganizationNodeStatus =>
  status === 'غیرفعال' ? 'غیرفعال' : 'فعال';

const catalogCapacity = (capacity: string) => {
  const value = Number(capacity);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

export function synchronizeOrganizationChartWithCatalog(
  nodes: readonly OrganizationNode[],
  records: OrganizationCatalogRecords,
): readonly OrganizationNode[] {
  const branchIds = new Map(
    records.branches.map((branch) => [branch.title, branch.id]),
  );
  const unitIds = new Map(records.units.map((unit) => [unit.title, unit.id]));
  const capacityByUnit = new Map<string, number>();

  for (const position of records.positions) {
    capacityByUnit.set(
      position.unit,
      (capacityByUnit.get(position.unit) ?? 0) +
        catalogCapacity(position.capacity),
    );
  }

  const branchNodes = records.branches.map<OrganizationNode>((branch) => ({
    id: branch.id,
    name: branch.title,
    kind: 'MANAGEMENT',
    branch: branch.title,
    parentId: null,
    manager: branch.manager || 'تعیین نشده',
    positionCapacity: records.units
      .filter((unit) => unit.branch === branch.title)
      .reduce(
        (total, unit) => total + (capacityByUnit.get(unit.title) ?? 0),
        0,
      ),
    effectiveFrom: branch.effectiveFrom,
    status: catalogStatus(branch.status),
    catalogSource: 'branch',
  }));
  const unitNodes = records.units.map<OrganizationNode>((unit) => ({
    id: unit.id,
    name: unit.title,
    kind: 'UNIT',
    branch: unit.branch,
    parentId: unit.parent
      ? (unitIds.get(unit.parent) ?? branchIds.get(unit.branch) ?? null)
      : (branchIds.get(unit.branch) ?? null),
    manager: unit.manager || 'تعیین نشده',
    positionCapacity: capacityByUnit.get(unit.title) ?? 0,
    effectiveFrom: unit.effectiveFrom,
    status: catalogStatus(unit.status),
    catalogSource: 'unit',
  }));
  const catalogNodes = [...branchNodes, ...unitNodes];
  const catalogNodeIds = new Set(catalogNodes.map((node) => node.id));
  const manualNodeIds = new Set(
    nodes.filter((node) => !node.catalogSource).map((node) => node.id),
  );
  const manualNodes = nodes
    .filter((node) => !node.catalogSource && !catalogNodeIds.has(node.id))
    .map((node) => ({
      ...node,
      parentId:
        node.parentId &&
        (catalogNodeIds.has(node.parentId) || manualNodeIds.has(node.parentId))
          ? node.parentId
          : null,
    }));

  return [...catalogNodes, ...manualNodes];
}

export const initialOrganizationNodes: readonly OrganizationNode[] =
  synchronizeOrganizationChartWithCatalog(
    [],
    initialOrganizationCatalogRecords,
  );

const emptyValue: OrganizationNodeFormValue = {
  id: '',
  name: '',
  kind: 'UNIT',
  branch: 'نیایش سیر',
  parentId: 'preview-org-management',
  manager: 'تعیین نشده',
  positionCapacity: '1',
  effectiveFrom: '',
  status: 'فعال',
};

const normalizeId = (value: string) => value.trim().toLocaleLowerCase('fa-IR');

export function nextOrganizationNodeId(
  nodes: readonly Pick<OrganizationNode, 'id'>[],
): string {
  const existing = new Set(nodes.map((node) => normalizeId(node.id)));
  let sequence = 1;
  while (existing.has(`hr-org-${String(sequence).padStart(3, '0')}`))
    sequence += 1;
  return `HR-ORG-${String(sequence).padStart(3, '0')}`;
}

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
      if (
        node.parentId &&
        blocked.has(node.parentId) &&
        !blocked.has(node.id)
      ) {
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
  else if (name.length > 100) errors.name = 'عنوان باید حداکثر ۱۰۰ نویسه باشد.';

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
        id: nextOrganizationNodeId(nodes),
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
            <RequiredFieldLabel required>شناسه ساختاری</RequiredFieldLabel>
            <input
              {...errorProps('id')}
              className={styles.control}
              id="hr-org-id"
              name="id"
              placeholder="مانند HR-UNIT-04"
              readOnly
              required
              value={value.id}
            />
            <small className={styles.fieldHint}>
              این شناسه به‌صورت خودکار تخصیص داده می‌شود.
            </small>
            <FieldError errors={errors} field="id" />
          </label>
          <label className={styles.fieldLabel} htmlFor="hr-org-name">
            <RequiredFieldLabel required>عنوان</RequiredFieldLabel>
            <input
              {...errorProps('name')}
              autoFocus
              className={styles.control}
              id="hr-org-name"
              name="name"
              onChange={(event) => update('name', event.target.value)}
              placeholder="عنوان مدیریت یا واحد"
              required
              value={value.name}
            />
            <FieldError errors={errors} field="name" />
          </label>
          <label className={styles.fieldLabel} htmlFor="hr-org-kind">
            <RequiredFieldLabel required>نوع گره</RequiredFieldLabel>
            <select
              className={styles.control}
              disabled={Boolean(initialNode?.catalogSource)}
              id="hr-org-kind"
              name="kind"
              onChange={(event) =>
                update('kind', event.target.value as OrganizationNodeKind)
              }
              required
              value={value.kind}
            >
              <option value="MANAGEMENT">مدیریت</option>
              <option value="UNIT">واحد سازمانی</option>
            </select>
          </label>
          <label className={styles.fieldLabel} htmlFor="hr-org-status">
            <RequiredFieldLabel required>وضعیت</RequiredFieldLabel>
            <select
              className={styles.control}
              id="hr-org-status"
              name="status"
              onChange={(event) =>
                update('status', event.target.value as OrganizationNodeStatus)
              }
              required
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
            <RequiredFieldLabel required>شعبه</RequiredFieldLabel>
            <select
              {...errorProps('branch')}
              className={styles.control}
              disabled={initialNode?.catalogSource === 'branch'}
              id="hr-org-branch"
              name="branch"
              onChange={(event) => update('branch', event.target.value)}
              required
              value={value.branch}
            >
              {branchOptions.map((branch) => (
                <option key={branch}>{branch}</option>
              ))}
            </select>
            <FieldError errors={errors} field="branch" />
          </label>
          <label className={styles.fieldLabel} htmlFor="hr-org-parent">
            <RequiredFieldLabel required={value.kind === 'UNIT'}>
              واحد والد
            </RequiredFieldLabel>
            <select
              {...errorProps('parentId')}
              className={styles.control}
              disabled={value.kind === 'MANAGEMENT'}
              id="hr-org-parent"
              name="parentId"
              onChange={(event) => update('parentId', event.target.value)}
              required={value.kind === 'UNIT'}
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
            <RequiredFieldLabel>مسئول / مدیر</RequiredFieldLabel>
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
            <RequiredFieldLabel required>ظرفیت سمت‌ها</RequiredFieldLabel>
            <input
              {...errorProps('positionCapacity')}
              className={styles.control}
              id="hr-org-capacity"
              inputMode="numeric"
              max="9999"
              min="0"
              name="positionCapacity"
              onChange={(event) =>
                update('positionCapacity', event.target.value)
              }
              readOnly={Boolean(initialNode?.catalogSource)}
              required
              type="number"
              value={value.positionCapacity}
            />
            {initialNode?.catalogSource ? (
              <small className={styles.fieldHint}>
                ظرفیت از مجموع سمت‌های ثبت‌شده برای این ساختار محاسبه می‌شود.
              </small>
            ) : null}
            <FieldError errors={errors} field="positionCapacity" />
          </label>
          <label
            className={`${styles.fieldLabel} ${styles.full}`}
            htmlFor="hr-org-effective-from"
          >
            <RequiredFieldLabel required>تاریخ اثر</RequiredFieldLabel>
            <DatePicker
              {...errorProps('effectiveFrom')}
              id="hr-org-effective-from"
              name="effectiveFrom"
              onChange={(nextValue) => update('effectiveFrom', nextValue)}
              placeholder="انتخاب تاریخ اثر"
              required
              value={value.effectiveFrom}
            />
            <FieldError errors={errors} field="effectiveFrom" />
          </label>
        </div>
      </fieldset>

      <div className={styles.modalFooter}>
        <button
          className={buttonVariants({ variant: 'outline' })}
          onClick={onCancel}
          type="button"
        >
          انصراف
        </button>
        <button
          className={buttonVariants({ variant: 'primary' })}
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
  onDelete,
  editable = true,
  confirmDelete = true,
}: {
  nodes: readonly OrganizationNode[];
  onEdit: (node: OrganizationNode) => void;
  onDelete: (node: OrganizationNode) => void;
  editable?: boolean;
  confirmDelete?: boolean;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [edges, setEdges] = useState<readonly OrganizationChartEdge[]>([]);
  const [chartSize, setChartSize] = useState<OrganizationChartSize>({
    width: 1,
    height: 1,
  });
  const roots = nodes.filter((node) => !node.parentId);

  const updateEdges = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const chartRect = chart.getBoundingClientRect();
    const nextEdges = getOrganizationRelationships(nodes).flatMap(
      (relationship) => {
        const parent = nodeRefs.current.get(relationship.parentId);
        const child = nodeRefs.current.get(relationship.childId);
        if (!parent || !child) return [];
        const parentRect = parent.getBoundingClientRect();
        const childRect = child.getBoundingClientRect();
        return [
          {
            id: relationship.id,
            startX: parentRect.left - chartRect.left + parentRect.width / 2,
            startY: parentRect.bottom - chartRect.top,
            endX: childRect.left - chartRect.left + childRect.width / 2,
            endY: childRect.top - chartRect.top,
          },
        ];
      },
    );
    const nextSize = {
      width: Math.max(1, chart.clientWidth),
      height: Math.max(1, chart.scrollHeight),
    };
    setChartSize((current) =>
      current.width === nextSize.width && current.height === nextSize.height
        ? current
        : nextSize,
    );
    setEdges((current) =>
      current.length === nextEdges.length &&
      current.every((edge, index) => {
        const next = nextEdges[index];
        return (
          next !== undefined &&
          edge.id === next.id &&
          edge.startX === next.startX &&
          edge.startY === next.startY &&
          edge.endX === next.endX &&
          edge.endY === next.endY
        );
      })
        ? current
        : nextEdges,
    );
  }, [nodes]);

  useLayoutEffect(() => {
    let animationFrame = 0;
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateEdges);
    };
    updateEdges();
    window.addEventListener('resize', scheduleUpdate);
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(scheduleUpdate);
    if (chartRef.current) observer?.observe(chartRef.current);
    nodeRefs.current.forEach((element) => observer?.observe(element));
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', scheduleUpdate);
      observer?.disconnect();
    };
  }, [updateEdges]);

  const renderNode = (node: OrganizationNode, primary = false) => {
    const children = nodes.filter((item) => item.parentId === node.id);
    return (
      <div className={styles.orgBranch} key={node.id}>
        <article
          className={`${styles.orgNode} ${primary ? styles.orgNodePrimary : ''}`}
          data-org-node={node.id}
          ref={(element) => {
            if (element) nodeRefs.current.set(node.id, element);
            else nodeRefs.current.delete(node.id);
          }}
        >
          {editable ? (
            <div className={styles.orgNodeActions}>
              <button
                aria-label={`ویرایش ${node.name}`}
                className={styles.orgEditButton}
                onClick={() => onEdit(node)}
                type="button"
              >
                <PencilLine aria-hidden="true" size={14} />
                ویرایش
              </button>
              <button
                aria-label={`حذف ${node.name}`}
                className={`${styles.orgEditButton} ${styles.orgDeleteButton}`}
                onClick={() => {
                  if (
                    !confirmDelete ||
                    window.confirm(
                      `«${node.name}» و همه زیرشاخه‌های آن از چارت موقت حذف شوند؟`,
                    )
                  )
                    onDelete(node);
                }}
                type="button"
              >
                <Trash2 aria-hidden="true" size={14} />
                حذف
              </button>
            </div>
          ) : null}
          <div className={styles.orgNodeTitle}>
            <Building2 aria-hidden="true" size={17} />
            <b>{node.name}</b>
          </div>
          <small>{node.manager}</small>
          <div className={styles.orgNodeMeta}>
            <span>
              {node.kind === 'MANAGEMENT' ? 'مدیریت' : 'واحد سازمانی'}
            </span>
            <span>
              {new Intl.NumberFormat('fa-IR').format(node.positionCapacity)} سمت
            </span>
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
    <div className={styles.orgChart} ref={chartRef}>
      <svg
        aria-hidden="true"
        className={styles.orgEdges}
        data-edge-count={getOrganizationRelationships(nodes).length}
        preserveAspectRatio="none"
        viewBox={`0 0 ${chartSize.width} ${chartSize.height}`}
      >
        {edges.map((edge) => {
          const middleY = edge.startY + (edge.endY - edge.startY) / 2;
          return (
            <path
              className={styles.orgEdge}
              d={`M ${edge.startX} ${edge.startY} V ${middleY} H ${edge.endX} V ${edge.endY}`}
              key={edge.id}
            />
          );
        })}
      </svg>
      {roots.map((node) => renderNode(node, true))}
    </div>
  );
}

type OrganizationNodeDialogProps = Omit<
  OrganizationNodeFormProps,
  'onCancel'
> & {
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
      <DialogContent
        className={`${styles.modal} ${styles.employeeModal}`}
        dir="rtl"
      >
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
