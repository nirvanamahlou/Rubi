'use client';

import type {
  MasterDataRecord,
  MasterOrganizationContactUnmasked,
} from '@nora/contracts';
import { useEffect, useMemo, useState } from 'react';

import { masterDataApi } from '@/modules/master-data/api/client';
import { useAccessPermissions } from '@/modules/iam/access-context';
import {
  CONTACT_UNMASK_PERMISSION,
  hasCurrentContactDisclosurePermission,
  loadOrganizationContactDisclosures,
  organizationContactDisclosureContext,
  visibleOrganizationContactDisclosure,
  visibleOrganizationContactDisclosureFailure,
  type OrganizationContactDisclosureSnapshot,
} from '../model/organization-contact-disclosure';
import { useDossierBranch } from './use-dossier-branch';

interface DisclosureState {
  contextKey: string;
  loading: boolean;
  snapshot?: OrganizationContactDisclosureSnapshot;
}

const emptyState: DisclosureState = { contextKey: '', loading: false };

export function useOrganizationContactDisclosures(input: {
  active: boolean;
  organizationId: string;
  contacts: readonly MasterDataRecord[];
}) {
  const { branchId, permissions, sessionContextKey, sessionError } =
    useDossierBranch();
  const accessPermissions = useAccessPermissions();
  const canUnmask = hasCurrentContactDisclosurePermission(
    permissions,
    accessPermissions,
  );
  const identities = useMemo(
    () =>
      input.contacts.map(({ id, version, attributes }) => ({
        id,
        version,
        organizationId: String(attributes.organizationId ?? ''),
      })),
    [input.contacts],
  );
  const context = useMemo(
    () =>
      organizationContactDisclosureContext({
        active: input.active,
        organizationId: input.organizationId,
        branchId,
        sessionContextKey,
        permissions: canUnmask ? [CONTACT_UNMASK_PERMISSION] : [],
        contacts: identities,
      }),
    [
      branchId,
      identities,
      input.active,
      input.organizationId,
      canUnmask,
      sessionContextKey,
    ],
  );
  const contextKey = context?.key ?? '';
  const [state, setState] = useState<DisclosureState>(emptyState);

  useEffect(() => {
    let active = true;
    if (!context) {
      void Promise.resolve().then(() => {
        if (active) setState(emptyState);
      });
      return () => {
        active = false;
      };
    }
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (!active) return;
      setState({ contextKey: context.key, loading: identities.length > 0 });
      const snapshot = await loadOrganizationContactDisclosures({
        context,
        request: async (contactId, requestedBranchId) =>
          (
            await masterDataApi.unmaskOrganizationContact(contactId, {
              branchId: requestedBranchId,
              signal: controller.signal,
            })
          ).data,
        isCurrent: (expectedContextKey) =>
          active && expectedContextKey === context.key,
      });
      if (!snapshot || !active) return;
      setState({ contextKey: context.key, loading: false, snapshot });
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [context, identities.length]);

  const visibleState = state.contextKey === contextKey ? state : emptyState;
  const mismatchedContacts = useMemo(
    () =>
      new Set(
        identities
          .filter((contact) => contact.organizationId !== input.organizationId)
          .map((contact) => contact.id),
      ),
    [identities, input.organizationId],
  );
  const disclosure = (
    contactId: string,
  ): MasterOrganizationContactUnmasked | undefined =>
    visibleOrganizationContactDisclosure(
      visibleState.snapshot,
      contextKey,
      contactId,
    );
  const failure = (contactId: string) => {
    if (mismatchedContacts.has(contactId))
      return 'مخاطب به سازمان جاری متصل نیست.';
    return visibleOrganizationContactDisclosureFailure(
      visibleState.snapshot,
      contextKey,
      contactId,
    );
  };
  let status = '';
  if (input.active && input.contacts.length) {
    if (sessionError) status = sessionError;
    else if (!sessionContextKey)
      status = 'در حال بررسی مجوز نمایش اطلاعات تماس…';
    else if (!Array.isArray(accessPermissions))
      status = 'دسترسی نمایش کامل اطلاعات تماس در حال بررسی است.';
    else if (!canUnmask)
      status =
        'اطلاعات تماس مطابق سطح دسترسی به‌صورت پوشیده نمایش داده شده است.';
    else if (visibleState.loading) status = 'در حال دریافت اطلاعات کامل تماس…';
  }
  return { disclosure, failure, status };
}
