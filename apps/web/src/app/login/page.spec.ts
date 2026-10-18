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

  it('uses a white page canvas without mounting decorative media', () => {
    expect(source).toContain('bg-white');
    expect(source).not.toContain('LoginBackgroundStory');
    expect(source).not.toContain('bg-sky-100');
  });

  it('uses the same continuous blue brand background behind both login panels', () => {
    expect(source).toContain('bg-[linear-gradient(145deg,#123f8c,#092354)]');
    expect(source).toContain('<LanguageSwitcher tone="inverse" />');
    expect(
      fs.readFileSync(path.resolve(__dirname, 'login-form.tsx'), 'utf8'),
    ).toContain('bg-white text-blue-950 hover:bg-blue-50');
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
