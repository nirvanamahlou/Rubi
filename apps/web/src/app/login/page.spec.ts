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

  it('keeps the selected B2 aviation image fixed as the page background', () => {
    expect(source).toContain('<LoginBackgroundStory />');
    expect(backgroundStyles).toContain(
      "background-image: url('/brand/login-airline-b2.png')",
    );
    expect(backgroundStyles).not.toContain('@keyframes airplaneArrival');
    expect(backgroundStory).not.toContain('airplaneLayer');
    expect(backgroundStory).not.toContain('skyPatch');
    expect(fs.existsSync(asset)).toBe(true);
    expect(fs.statSync(asset).size).toBeGreaterThan(100_000);
  });

  it('reveals persistent cloud-themed NOORA without moving the airplane', () => {
    expect(backgroundStory).toContain('NOORA');
    expect(backgroundStory).not.toContain('<svg');
    expect(backgroundStory).toContain('aria-hidden="true"');
    expect(backgroundStyles).toContain('@keyframes revealNooraMist');
    expect(backgroundStyles).toContain('2.65s both');
    expect(backgroundStyles).toContain('.staticBackground');
    expect(backgroundStyles).not.toContain('mask-image: radial-gradient');
    expect(backgroundStyles).toContain(
      '@media (prefers-reduced-motion: reduce)',
    );
  });
});
