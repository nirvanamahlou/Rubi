import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MasterDataClearableField,
  MasterDataClearSelection,
} from './master-data-clearable-field';
import {
  MasterDataReferenceSelector,
  OrganizationRoleSelector,
} from './master-data-reference-selector';

const props = {
  controlId: 'test-country',
  label: 'کشور',
  value: 'test-reference',
  onClear: () => undefined,
};

afterEach(() => vi.unstubAllGlobals());

describe('Master Data clear selection control', () => {
  it.each([{ value: '' }, { disabled: true }, { readOnly: true }])(
    'does not offer clearing for an empty or locked field: %j',
    (state) => {
      expect(MasterDataClearSelection({ ...props, ...state })).toBeNull();
    },
  );

  it.each(['false', '0', 'first,second'])(
    'allows clearing a nonempty selection %s',
    (value) => {
      expect(MasterDataClearSelection({ ...props, value })).not.toBeNull();
    },
  );

  it('clears only its own selection, does not submit, and returns keyboard focus', () => {
    let selected = props.value;
    const focus = vi.fn();
    const getElementById = vi.fn(() => ({ focus }));
    vi.stubGlobal('document', { getElementById });
    const onClear = vi.fn(() => {
      selected = '';
    });
    const control = MasterDataClearSelection({ ...props, onClear });

    expect(control?.props.type).toBe('button');
    expect(control?.props['aria-label']).toBe('پاک‌کردن کشور');
    expect(control?.props.title).toBe('پاک‌کردن کشور');
    control?.props.onClick();
    expect(selected).toBe('');
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(getElementById).toHaveBeenCalledWith(props.controlId);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(MasterDataClearSelection({ ...props, value: selected })).toBeNull();
  });

  it('keeps the clear button separate from the select/calendar trigger', () => {
    const markup = renderToStaticMarkup(
      MasterDataClearableField({
        ...props,
        children: React.createElement(
          'button',
          { id: props.controlId, type: 'button' },
          'انتخاب کنید',
        ),
      }),
    );
    expect(markup.match(/<button\b/g)).toHaveLength(2);
    expect(markup).toMatch(/انتخاب کنید<\/button><\/div><button/);
    expect(markup).toContain('size-11');
    expect(markup).toContain('focus-visible:ring-2');
    expect(markup).toContain('aria-hidden="true"');
  });

  it.each([false, true])(
    'renders clearing for required/optional references (optional=%s)',
    (optional) => {
      const markup = renderToStaticMarkup(
        React.createElement(MasterDataReferenceSelector, {
          config: { target: 'countries', payload: 'id', optional },
          disabled: false,
          id: props.controlId,
          label: props.label,
          value: props.value,
          onChange: () => undefined,
        }),
      );
      expect(markup).toContain('aria-label="پاک‌کردن کشور"');
    },
  );

  it.each(['', 'test-reference'])(
    'never renders a clear action for locked references (%s)',
    (value) => {
      const markup = renderToStaticMarkup(
        React.createElement(MasterDataReferenceSelector, {
          config: { target: 'countries', payload: 'id' },
          disabled: true,
          id: props.controlId,
          label: props.label,
          value,
          onChange: () => undefined,
        }),
      );
      expect(markup).not.toContain('پاک‌کردن');
    },
  );

  it('allows clearing a multi-reference field even before its options load', () => {
    const markup = renderToStaticMarkup(
      React.createElement(MasterDataReferenceSelector, {
        config: { target: 'facilities', payload: 'id', multiple: true },
        disabled: false,
        id: 'facilities',
        label: 'امکانات',
        value: 'first,second',
        onChange: () => undefined,
      }),
    );
    expect(markup).toContain('aria-label="پاک‌کردن امکانات"');
  });

  it('only shows role clearing for nonempty editable role selections', () => {
    for (const disabled of [true, false]) {
      for (const value of ['', 'AGENCY,SUPPLIER']) {
        const markup = renderToStaticMarkup(
          React.createElement(OrganizationRoleSelector, {
            id: 'roles',
            disabled,
            value,
            onChange: () => undefined,
          }),
        );
        expect(
          markup.includes('aria-label="پاک‌کردن نقش‌های انتخاب‌شده"'),
        ).toBe(Boolean(value) && !disabled);
      }
    }
  });
});
