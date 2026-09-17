import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('login background', () => {
  const source = fs.readFileSync(path.resolve(__dirname, 'page.tsx'), 'utf8');
  const backgroundStory = fs.readFileSync(
    path.resolve(__dirname, 'login-background-story.tsx'),
    'utf8',
  );
  const backgroundStyles = fs.readFileSync(
    path.resolve(__dirname, 'login-background-story.module.css'),
    'utf8',
  );
  const asset = path.resolve(
    __dirname,
    '../../../public/brand/login-airline-b2.png',
  );

  it('uses the selected B2 aviation image as the animated page background', () => {
    expect(source).toContain('<LoginBackgroundStory />');
    expect(backgroundStyles).toContain(
      "background-image: url('/brand/login-airline-b2.png')",
    );
    expect(backgroundStyles).toContain('@keyframes backgroundPlaneArrival');
    expect(backgroundStyles).toContain('translate3d(34%, 0, 0)');
    expect(fs.existsSync(asset)).toBe(true);
    expect(fs.statSync(asset).size).toBeGreaterThan(100_000);
  });

  it('reveals persistent cloud-themed NOORA after the background stops', () => {
    expect(backgroundStory).toContain('NOORA');
    expect(backgroundStory).not.toContain('<svg');
    expect(backgroundStory).toContain('aria-hidden="true"');
    expect(backgroundStyles).toContain('@keyframes revealNooraCloud');
    expect(backgroundStyles).toContain('2.65s both');
    expect(backgroundStyles).toContain(
      '@media (prefers-reduced-motion: reduce)',
    );
  });
});
