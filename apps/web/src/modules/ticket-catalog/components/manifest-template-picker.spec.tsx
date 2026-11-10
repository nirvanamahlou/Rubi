import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ManifestTemplatePicker } from './manifest-template-picker';
import { flightOfferInput } from './ticket-workspace';
import { emptyInput } from '../model/preview';

describe('manifest template field', () => {
  it('starts with a labeled default and displays an existing airline/destination selection', () => {
    const defaultHtml = renderToStaticMarkup(
      <ManifestTemplatePicker value={null} onChange={() => undefined} />,
    );
    expect(defaultHtml).toContain('انتخاب قالب منیفست');
    expect(defaultHtml).toContain('پیش‌فرض');
    expect(defaultHtml).toContain('aria-expanded="false"');
    const selectedHtml = renderToStaticMarkup(
      <ManifestTemplatePicker
        value="template"
        name="Synthetic Air — Destination"
        readOnly
        onChange={() => undefined}
      />,
    );
    expect(selectedHtml).toContain('Synthetic Air — Destination');
    expect(selectedHtml).toContain('disabled');
  });

  it('sends the selection to the authoritative offer and defaults legacy definitions to null', () => {
    const definition = emptyInput();
    definition.segments = [
      {
        ...definition.segments[0]!,
        airlineId: 'airline',
        flightNumber: 'TEST',
        departureAt: '2099-01-01T00:00:00Z',
        arrivalAt: '2099-01-01T02:00:00Z',
      },
    ];
    const references = [
      {
        id: 'airline',
        kind: 'airline' as const,
        name: 'Synthetic',
        active: true,
      },
    ];
    expect(
      flightOfferInput(definition, references)?.manifestTemplateId,
    ).toBeNull();
    definition.manifestTemplateId = 'chosen';
    expect(flightOfferInput(definition, references)?.manifestTemplateId).toBe(
      'chosen',
    );
  });
});

it('loads registered templates beyond the first page and does not hide an incomplete list', async () => {
  const { loadAllManifestTemplates } =
    await import('./manifest-template-picker');
  const calls: number[] = [];
  const result = await loadAllManifestTemplates(async (_search, page) => {
    calls.push(page);
    return {
      data: [{ id: String(page), name: 'Template ' + page }],
      hasMore: page === 1,
    };
  }, '');
  expect(calls).toEqual([1, 2]);
  expect(result.data.map((row) => row.id)).toEqual(['1', '2']);
  await expect(
    loadAllManifestTemplates(async () => ({ data: [], hasMore: true }), ''),
  ).rejects.toThrow();
});

it('shows the explicit builtin label in the export dropdown while preserving ordinary offer defaults', () => {
  const options = [
    { value: 'DEFAULT_MANIFEST', label: 'دیفالت منیفست' },
    { value: 'REPORT', label: 'گزارش‌گیری' },
  ];
  for (const option of options) {
    const html = renderToStaticMarkup(
      <ManifestTemplatePicker
        value={option.value}
        builtinOptions={options}
        onChange={() => undefined}
      />,
    );
    expect(html).toContain(option.label);
    expect(html).not.toContain('قالب انتخاب‌شده');
  }
});
