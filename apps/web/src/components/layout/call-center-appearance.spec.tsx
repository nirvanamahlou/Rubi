import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { IllustrationIcon } from '../ui/illustration-icon';
import {
  isCallCenterAppearance,
  callCenterGroupIllustrations,
  callCenterNavigationIllustration,
} from './call-center-appearance';

describe('Call Center visual isolation', () => {
  it('limits the appearance to the actual Call Center route and descendants', () => {
    expect(isCallCenterAppearance('/customer-affairs/call-center')).toBe(true);
    expect(
      isCallCenterAppearance('/customer-affairs/call-center/details'),
    ).toBe(true);
    for (const path of [
      '/customer-affairs',
      '/customer-affairs/call-center-other',
      '/dashboard',
      '/finance',
      '/sales',
    ]) {
      expect(isCallCenterAppearance(path)).toBe(false);
    }
  });
  it('renders repeated illustrations with unique local gradients and decorative semantics', () => {
    const html = renderToStaticMarkup(
      <>
        <IllustrationIcon kind="headset" />
        <IllustrationIcon kind="headset" />
      </>,
    );
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const match of html.matchAll(/url\(#([^)]+)\)/g))
      expect(ids).toContain(match[1]);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(2);
    expect(html.match(/focusable="false"/g)).toHaveLength(2);
    expect(html).not.toContain('<image');
    expect(html).not.toContain('<title');
  });
  it('keeps navigation illustrations renderable without changing destinations', () => {
    for (const kind of [
      ...Object.values(callCenterGroupIllustrations),
      callCenterNavigationIllustration('/customer-affairs/call-center'),
    ]) {
      const html = renderToStaticMarkup(<IllustrationIcon kind={kind} />);
      expect(html).toContain('<svg');
      expect(html).toContain('viewBox="0 0 64 64"');
      expect(html).not.toContain('undefined');
    }
  });
});
