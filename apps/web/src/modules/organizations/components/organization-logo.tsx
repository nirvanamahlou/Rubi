'use client';

import type { IamPermissionCode, MasterDataRecord } from '@nora/contracts';
import { Building2 } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  canViewOrganizationLogo,
  watchOrganizationLogoPreview,
} from '../model/organization-logo';

export function OrganizationLogo({
  organization,
  permissions,
}: {
  organization: MasterDataRecord;
  permissions: readonly IamPermissionCode[];
}) {
  const reference = String(
    organization.attributes.logoFileReference ?? '',
  ).trim();
  const permissionKey = permissions.join('\u0000');
  const identity = `${organization.id}\u0000${reference}\u0000${organization.version}\u0000${permissionKey}`;
  const [image, setImage] = useState<{ identity: string; url: string }>();
  const [imageNotice, setImageNotice] = useState('');
  useEffect(() => {
    if (!reference) return;
    const currentPermissions = permissionKey
      .split('\u0000')
      .filter(Boolean) as IamPermissionCode[];
    return watchOrganizationLogoPreview({
      documentId: reference,
      permissions: currentPermissions,
      onState: (state) => {
        if ('imageUrl' in state) {
          setImage({ identity, url: state.imageUrl });
          setImageNotice('');
        } else {
          setImage(undefined);
          setImageNotice(state.reason);
        }
      },
    });
  }, [identity, permissionKey, reference]);
  const visibleImage =
    canViewOrganizationLogo(permissions) &&
    reference &&
    image?.identity === identity
      ? image.url
      : undefined;
  return (
    <div className="organization-logo-control">
      <div className="org-logo" title={imageNotice || organization.name}>
        {visibleImage ? (
          <Image
            src={visibleImage}
            alt={`لوگوی ${organization.name}`}
            width={64}
            height={64}
            unoptimized
            className="organization-logo-image"
          />
        ) : (
          <Building2 size={30} aria-hidden="true" />
        )}
      </div>
      {reference && imageNotice && (
        <span className="sr-only" role="status">
          {imageNotice}
        </span>
      )}
    </div>
  );
}
