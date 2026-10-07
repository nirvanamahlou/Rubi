'use client';
import NextLink from '@/i18n/link';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { useRouteAccess } from '@/modules/iam/access-context';
const AccessLink = forwardRef<
  HTMLAnchorElement,
  ComponentPropsWithoutRef<typeof NextLink>
>((props, ref) => {
  const allowed = useRouteAccess();
  const href =
    typeof props.href === 'string'
      ? props.href
      : (props.href.pathname ?? '') +
        (props.href.query
          ? '?' +
            (typeof props.href.query === 'string'
              ? props.href.query
              : new URLSearchParams(
                  Object.entries(props.href.query)
                    .filter(([, value]) => value !== undefined)
                    .map(([key, value]) => [key, String(value)]),
                ).toString())
          : '');
  if (href?.startsWith('/') && !allowed(href)) return null;
  return <NextLink {...props} ref={ref} />;
});
AccessLink.displayName = 'AccessLink';
export default AccessLink;
