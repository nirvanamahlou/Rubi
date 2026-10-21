import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { integrationSections } from './model';
import { integrationNavigation, navigationGroup } from './navigation';
import { IntegrationNavigation } from './components/integration-navigation';

describe('Progressive Integrations navigation', () => {
  it('shows only assigned sections and keeps a partial group usable', () => {
    const html = renderToStaticMarkup(
      <IntegrationNavigation
        section="health"
        allowedSections={['health', 'logs']}
        disabled={false}
        onChange={() => {}}
      />,
    );
    expect(html).toContain('پیگیری و پایش');
    expect(html).toContain('سلامت و خطاها');
    expect(html).toContain('لاگ‌ها و سوابق');
    expect(html).not.toContain('سایت‌ها و برندها');
    expect(html).not.toContain('راه‌اندازی اتصال');
    expect(html).not.toContain('>همگام‌سازی‌ها</button>');
  });
  it('retains every existing destination exactly once under four entry points', () => {
    const destinations = integrationNavigation.flatMap((group) => [
      ...group.sections,
    ]);
    expect(integrationNavigation).toHaveLength(4);
    expect(destinations.toSorted()).toEqual(
      integrationSections.map((item) => item.id).toSorted(),
    );
    expect(new Set(destinations).size).toBe(destinations.length);
  });

  it.each(integrationSections)(
    'reveals the matching group for $id, including drill-down navigation',
    (section) => {
      const group = navigationGroup(section.id);
      const html = renderToStaticMarkup(
        <IntegrationNavigation
          section={section.id}
          disabled={false}
          onChange={() => {}}
        />,
      );
      expect(html).toContain(group.title);
      expect(html).toContain('aria-current="true"');
      for (const candidate of integrationSections) {
        const visible =
          (group.sections as readonly string[]).includes(candidate.id) &&
          group.sections.length > 1;
        // All primary groups remain visible; only the selected group's leaf links appear.
        expect(html.includes(`>${candidate.title}</button>`)).toBe(visible);
      }
      expect(html.includes('aria-current="page"')).toBe(
        group.sections.length > 1,
      );
    },
  );

  it('prevents leaving an open editor through primary or secondary navigation', () => {
    const html = renderToStaticMarkup(
      <IntegrationNavigation section="events" disabled onChange={() => {}} />,
    );
    const buttons = html.match(/<button\b[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(7);
    expect(buttons.every((button) => button.includes('disabled=""'))).toBe(
      true,
    );
  });
});
