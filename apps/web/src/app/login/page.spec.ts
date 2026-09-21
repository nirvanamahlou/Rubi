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

  it('keeps the selected B2 aviation image as a fixed page background', () => {
    expect(source).toContain('<LoginBackgroundStory />');
    expect(backgroundStyles).toContain(
      "background-image: url('/brand/login-airline-b2.png')",
    );
    expect(backgroundStyles).toContain('background-size: cover');
    expect(backgroundStyles).toContain('inset: -3%');
    expect(backgroundStyles).not.toContain('@keyframes');
    expect(backgroundStyles).not.toContain('animation:');
    expect(fs.existsSync(asset)).toBe(true);
    expect(fs.statSync(asset).size).toBeGreaterThan(100_000);
  });

  it('does not render the NOORA cloud or decorative wind layers', () => {
    expect(backgroundStory).toContain('aria-hidden="true"');
    expect(backgroundStory).not.toContain('NOORA');
    expect(backgroundStory).not.toContain('nooraMark');
    expect(backgroundStory).not.toContain('cloudBody');
    expect(backgroundStory).not.toContain('windTrail');
    expect(backgroundStyles).not.toContain('.nooraMark');
    expect(backgroundStyles).not.toContain('.cloudBody');
    expect(backgroundStyles).not.toContain('.windTrail');
  });
});
