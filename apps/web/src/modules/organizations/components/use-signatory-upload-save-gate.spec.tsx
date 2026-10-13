import type * as ReactModule from 'react';
import { useLayoutEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  dossier: {
    branches: [{ id: 'branch-a', name: 'شعبه الف' }],
    branchId: 'branch-a',
    setBranchId: vi.fn(),
    permissions: ['b2b.agency.manage', 'documents.list', 'documents.upload'],
    sessionError: '',
    sessionContextKey: 'session-revision-1',
    actorIdentityKey: 'actor-a',
  },
  layouts: [] as (() => void)[],
  refIndex: 0,
  refs: [] as { current: unknown }[],
  stateIndex: 0,
  stateValues: [] as unknown[],
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    useCallback: <T,>(callback: T) => callback,
    useEffect: () => undefined,
    useLayoutEffect: (effect: () => void) => harness.layouts.push(effect),
    useRef: <T,>(initial: T) => {
      const index = harness.refIndex++;
      harness.refs[index] ??= { current: initial };
      return harness.refs[index] as { current: T };
    },
    useState: <T,>(initial: T) => {
      const index = harness.stateIndex++;
      if (index >= harness.stateValues.length)
        harness.stateValues[index] = initial;
      const setState = (next: T | ((current: T) => T)) => {
        const current = harness.stateValues[index] as T;
        harness.stateValues[index] =
          typeof next === 'function'
            ? (next as (value: T) => T)(current)
            : next;
      };
      return [harness.stateValues[index] as T, setState] as const;
    },
  };
});

vi.mock('./use-dossier-branch', () => ({
  useDossierBranch: () => harness.dossier,
}));

import { OrganizationSignatoriesPanel } from './organization-signatories-panel';
import { useSignatoryUploadSaveGate } from './use-signatory-upload-save-gate';

type Gate = ReturnType<typeof useSignatoryUploadSaveGate>;

function Probe({
  operationKey,
  refreshContext,
  capture,
}: {
  operationKey: string;
  refreshContext: string;
  capture: (gate: Gate) => void;
}) {
  const gate = useSignatoryUploadSaveGate(operationKey);
  useLayoutEffect(() => capture(gate), [capture, gate]);
  return (
    <span>{`${refreshContext}:${gate.blocked ? 'BLOCKED' : 'OPEN'}`}</span>
  );
}

function renderProbe(operationKey: string, refreshContext: string) {
  harness.stateIndex = 0;
  harness.layouts.length = 0;
  const capture = vi.fn<(gate: Gate) => void>();
  const markup = renderToStaticMarkup(
    <Probe
      operationKey={operationKey}
      refreshContext={refreshContext}
      capture={capture}
    />,
  );
  for (const layout of harness.layouts) layout();
  return { markup, gate: capture.mock.calls[0]![0] };
}

interface ElementNode {
  key: string | null;
  props: Record<string, unknown> & { children?: unknown };
}

function findSignatoryFields(node: unknown): ElementNode | undefined {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findSignatoryFields(child);
      if (found) return found;
    }
    return undefined;
  }
  const candidate = node as Partial<ElementNode>;
  if (
    candidate.props &&
    'proofRequestKey' in candidate.props &&
    'uploadContextKey' in candidate.props &&
    'saveGateKey' in candidate.props
  )
    return candidate as ElementNode;
  return findSignatoryFields(candidate.props?.children);
}

function renderPanelEditor(
  sessionContextKey: string,
  actorIdentityKey: string,
) {
  harness.dossier.sessionContextKey = sessionContextKey;
  harness.dossier.actorIdentityKey = actorIdentityKey;
  harness.stateIndex = 0;
  harness.refIndex = 0;
  harness.layouts.length = 0;
  const tree = OrganizationSignatoriesPanel({
    organizationId: 'organization-a',
    onAddContact: vi.fn(),
  });
  const fields = findSignatoryFields(tree);
  expect(fields).toBeDefined();
  return fields!;
}

beforeEach(() => {
  harness.layouts.length = 0;
  harness.refIndex = 0;
  harness.refs.length = 0;
  harness.stateIndex = 0;
  harness.stateValues.length = 0;
  harness.stateValues.push(
    [],
    { from: '', to: '' },
    '',
    false,
    {
      generation: 1,
      values: {
        branchId: 'branch-a',
        contactId: 'contact-a',
        documentTypes: ['FRAMEWORK_AGREEMENT'],
        authorityLimit: null,
        currencyCode: null,
        validFrom: '2026-10-04',
        validTo: null,
        documentId: null,
        documentVersionId: null,
        isActive: false,
        notes: '',
      },
    },
    undefined,
    '',
  );
});

describe('signatory upload save gate lifecycle', () => {
  it('keeps the actual fields mount and operation across same-actor focus refreshes', () => {
    const initial = renderPanelEditor('session-revision-1', 'actor-a');
    const pending = renderPanelEditor('', 'actor-a');
    const refreshed = renderPanelEditor('session-revision-2', 'actor-a');
    const replacedActor = renderPanelEditor('session-revision-1', 'actor-b');

    expect(pending.key).toBe(initial.key);
    expect(refreshed.key).toBe(initial.key);
    expect(pending.props.uploadContextKey).toBe(initial.props.uploadContextKey);
    expect(refreshed.props.saveGateKey).toBe(initial.props.saveGateKey);
    expect(pending.props.proofRequestKey).toBe('');
    expect(refreshed.props.proofRequestKey).toBe('session-revision-2');

    expect(replacedActor.key).not.toBe(initial.key);
    expect(replacedActor.props.uploadContextKey).not.toBe(
      initial.props.uploadContextKey,
    );
    expect(replacedActor.props.saveGateKey).not.toBe(initial.props.saveGateKey);
  });

  it('stays blocked through transient and completed same-editor focus refreshes', () => {
    const initial = renderProbe(
      'organization-a|editor-1',
      'session-revision-1',
    );
    expect(initial.markup).toContain('OPEN');
    initial.gate.update('organization-a|editor-1', true);

    expect(renderProbe('organization-a|editor-1', '').markup).toContain(
      'BLOCKED',
    );
    const refreshed = renderProbe(
      'organization-a|editor-1',
      'session-revision-2',
    );
    expect(refreshed.markup).toContain('BLOCKED');
    refreshed.gate.update('organization-a|editor-1', false);
    expect(
      renderProbe('organization-a|editor-1', 'session-revision-2').markup,
    ).toContain('OPEN');

    expect(
      renderProbe('organization-a|editor-2', 'session-revision-2').markup,
    ).toContain('OPEN');
  });
});
