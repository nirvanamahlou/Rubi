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

  it('splits the physical page left blue and right white without decorative media', () => {
    const styles = fs.readFileSync(
      path.resolve(__dirname, 'page.module.css'),
      'utf8',
    );
    expect(source).toContain('${styles.page}');
    expect(styles.replace(/\s+/g, ' ')).toContain(
      'to right, #123f8c 0 var(--login-split), #fff var(--login-split) 100%',
    );
    expect(styles).not.toContain('[dir=');
    expect(styles).not.toContain('animation');
    expect(source).not.toContain('LoginBackgroundStory');
    expect(source).not.toContain('bg-sky-100');
  });

  it('aligns the background to the unchanged desktop card divider in either direction', () => {
    const styles = fs.readFileSync(
      path.resolve(__dirname, 'page.module.css'),
      'utf8',
    );
    expect(source).toContain('lg:grid-cols-[1.1fr_1fr]');
    expect(source).toContain('max-w-5xl');
    expect(source).toContain('px-4');
    expect(styles).toContain('@media (min-width: 64rem)');
    expect(styles).toContain('calc(100% - 2rem - 2px)');
    expect(styles).toContain('calc(64rem - 2px)');
    expect(styles).toContain('--login-split: 50%');
    expect(styles).toContain('calc(50% - var(--login-card-inner-width) / 42)');
    expect(styles).toContain('.page:dir(ltr)');
    expect(styles).toContain('calc(50% + var(--login-card-inner-width) / 42)');
    for (const width of [1024, 1100, 1280, 1440, 1920]) {
      const cardWidth = Math.min(width - 32, 1024);
      const inner = cardWidth - 2;
      const cardLeft = (width - cardWidth) / 2 + 1;
      expect(width / 2 - inner / 42).toBeCloseTo(cardLeft + inner / 2.1, 8);
      expect(width / 2 + inner / 42).toBeCloseTo(
        cardLeft + (inner * 1.1) / 2.1,
        8,
      );
    }
  });

  it('restores the prior surface card, blue brand panel and standard form styling', () => {
    expect(source).toContain('bg-surface/95');
    expect(source).toContain('backdrop-blur-sm');
    expect(source).toContain('bg-[linear-gradient(145deg,#123f8c,#092354)]');
    expect(source).toContain('<LanguageSwitcher />');
    expect(source).not.toContain('p-7 text-white');
    const form = fs.readFileSync(
      path.resolve(__dirname, 'login-form.tsx'),
      'utf8',
    );
    expect(form).not.toContain('labelClassName="text-white"');
    expect(form).not.toContain('bg-white text-blue-950');
    expect(form).toContain('<Button className="w-full"');
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
