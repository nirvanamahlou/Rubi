import { Fragment } from 'react/jsx-dev-runtime';
import type { jsxDEV as reactJsxDev } from 'react/jsx-dev-runtime';
import { jsx } from './jsx-runtime';

export { Fragment };
export type { JSX } from 'react/jsx-runtime';

export const jsxDEV: typeof reactJsxDev = (type, props, key) => jsx(type, props, key);
