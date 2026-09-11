'use client';

import type { IamPermissionCode, MasterDataRecord } from '@rubi/contracts';
import { Building2 } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  canViewOrganizationLogo,
  organizationLogoPreview,
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
  const [image, setImage] = useState<{ reference: string; url: string }>();
  const [imageNotice, setImageNotice] = useState('');
  useEffect(() => {
    if (!reference) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void organizationLogoPreview(reference, permissions, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if ('blob' in result) {
          objectUrl = URL.createObjectURL(result.blob);
          setImage({ reference, url: objectUrl });
          setImageNotice('');
        } else {
          setImage(undefined);
          setImageNotice(result.reason);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setImage(undefined);
          setImageNotice(
            'تصویر لوگو اکنون قابل دریافت نیست؛ وضعیت فایل را در آرشیو بررسی کنید.',
          );
        }
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reference, permissions, organization.version]);
  const visibleImage =
    canViewOrganizationLogo(permissions) &&
    reference &&
    image?.reference === reference
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
