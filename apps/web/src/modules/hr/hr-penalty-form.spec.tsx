import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { getHrResource } from '@nora/contracts';
import { ContextualHrForm } from './contextual-hr-form';
it('defaults both per-minute rates to 50000 Toman with explicit date and exemption fields', () => {
  const definition = getHrResource('time', 'penaltySettings')!;
  const html = renderToStaticMarkup(
    <ContextualHrForm
      context={{
        section: 'time',
        tab: 'penaltySettings',
        title: 'تنظیمات جریمه',
        description: '',
        columns: definition.columns,
        mode: 'create',
      }}
      onCancel={() => {}}
      onSubmit={() => {}}
    />,
  );
  expect((html.match(/value="50000"/g) ?? []).length).toBe(2);
  for (const column of definition.columns) expect(html).toContain(column);
  expect(definition.fields.slice(0, 6).every((field) => field.required)).toBe(
    true,
  );
  expect(definition.fields.slice(6).map((field) => field.type)).toEqual([
    'money',
    'money',
  ]);
});
it('shows saved rates and exemptions in edit mode instead of create defaults', () => {
  const definition = getHrResource('time', 'penaltySettings')!;
  const html = renderToStaticMarkup(
    <ContextualHrForm
      context={{
        section: 'time',
        tab: 'penaltySettings',
        title: 'تنظیمات جریمه',
        description: '',
        columns: definition.columns,
        mode: 'edit',
        initialValues: ['1234', '5678', '2026-11-08', 'بله', 'خیر', 'بله'],
      }}
      onCancel={() => {}}
      onSubmit={() => {}}
    />,
  );
  expect(html).toContain('value="1234"');
  expect(html).toContain('value="5678"');
  expect(html).not.toContain('value="50000"');
});
