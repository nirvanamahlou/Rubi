import type {
  IamPermissionCode,
  MasterOrganizationContactUnmasked,
} from '@nora/contracts';

export const CONTACT_UNMASK_PERMISSION =
  'master_data.sensitive_contact.unmask' as const;

export function hasCurrentContactDisclosurePermission(
  dossierPermissions: readonly IamPermissionCode[],
  accessPermissions: readonly string[] | null | undefined,
) {
  return (
    Array.isArray(accessPermissions) &&
    dossierPermissions.includes(CONTACT_UNMASK_PERMISSION) &&
    accessPermissions.includes(CONTACT_UNMASK_PERMISSION)
  );
}

export interface OrganizationContactIdentity {
  id: string;
  version: number;
  organizationId: string;
}

export interface OrganizationContactDisclosureContext {
  key: string;
  organizationId: string;
  branchId: string;
  sessionContextKey: string;
  contacts: readonly OrganizationContactIdentity[];
}

export interface OrganizationContactDisclosureSnapshot {
  contextKey: string;
  values: Readonly<Record<string, MasterOrganizationContactUnmasked>>;
  failures: Readonly<Record<string, string>>;
}

export function organizationContactDisclosureContext(input: {
  active: boolean;
  organizationId: string;
  branchId: string;
  sessionContextKey: string;
  permissions: readonly IamPermissionCode[];
  contacts: readonly OrganizationContactIdentity[];
}): OrganizationContactDisclosureContext | undefined {
  if (
    !input.active ||
    !input.organizationId ||
    !input.branchId ||
    !input.sessionContextKey ||
    !input.permissions.includes(CONTACT_UNMASK_PERMISSION)
  )
    return undefined;
  const contacts = input.contacts
    .filter((contact) => contact.organizationId === input.organizationId)
    .map(({ id, version, organizationId }) => ({
      id,
      version,
      organizationId,
    }));
  return {
    organizationId: input.organizationId,
    branchId: input.branchId,
    sessionContextKey: input.sessionContextKey,
    contacts,
    key: JSON.stringify([
      input.organizationId,
      input.branchId,
      input.sessionContextKey,
      input.contacts.map(({ id, version, organizationId }) => [
        id,
        version,
        organizationId,
      ]),
    ]),
  };
}

export function visibleOrganizationContactDisclosure(
  snapshot: OrganizationContactDisclosureSnapshot | undefined,
  currentContextKey: string,
  contactId: string,
) {
  if (!snapshot || snapshot.contextKey !== currentContextKey) return undefined;
  return snapshot.values[contactId];
}

export function visibleOrganizationContactDisclosureFailure(
  snapshot: OrganizationContactDisclosureSnapshot | undefined,
  currentContextKey: string,
  contactId: string,
) {
  if (!snapshot || snapshot.contextKey !== currentContextKey) return undefined;
  return snapshot.failures[contactId];
}

function isDisclosure(
  value: MasterOrganizationContactUnmasked,
  expectedId: string,
) {
  return (
    value.id === expectedId &&
    (value.phone === null || typeof value.phone === 'string') &&
    (value.email === null || typeof value.email === 'string')
  );
}

export async function loadOrganizationContactDisclosures(input: {
  context: OrganizationContactDisclosureContext;
  request: (
    contactId: string,
    branchId: string,
  ) => Promise<MasterOrganizationContactUnmasked>;
  isCurrent: (contextKey: string) => boolean;
}): Promise<OrganizationContactDisclosureSnapshot | undefined> {
  const values: Record<string, MasterOrganizationContactUnmasked> = {};
  const failures: Record<string, string> = {};
  let next = 0;
  const worker = async () => {
    while (input.isCurrent(input.context.key)) {
      const contact = input.context.contacts[next++];
      if (!contact) return;
      try {
        const disclosure = await input.request(
          contact.id,
          input.context.branchId,
        );
        if (!input.isCurrent(input.context.key)) return;
        if (!isDisclosure(disclosure, contact.id)) {
          failures[contact.id] =
            'پاسخ نمایش کامل اطلاعات تماس با مخاطب انتخاب‌شده مطابقت ندارد.';
          continue;
        }
        values[contact.id] = disclosure;
      } catch {
        if (!input.isCurrent(input.context.key)) return;
        failures[contact.id] = 'نمایش کامل اطلاعات تماس ناموفق بود.';
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(4, input.context.contacts.length) }, worker),
  );
  if (!input.isCurrent(input.context.key)) return undefined;
  return { contextKey: input.context.key, values, failures };
}
