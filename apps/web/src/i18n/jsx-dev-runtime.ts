import { Fragment, jsxDEV as reactJsxDev } from 'react/jsx-dev-runtime';
import { localize } from './jsx-runtime';

export { Fragment };
export type { JSX } from 'react/jsx-runtime';

export const jsxDEV: typeof reactJsxDev = (
  type,
  props,
  key,
  isStaticChildren,
  source,
  self,
) =>
  localize(
    (localizedType, localizedProps, localizedKey) =>
      reactJsxDev(
        localizedType,
        localizedProps,
        localizedKey,
        isStaticChildren,
        source,
        self,
      ),
    type,
    props,
    key,
  );
