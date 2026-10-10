'use client';
import * as React from 'react';
import {
  SearchCombobox,
  optionText,
  type SearchOption,
} from './search-combobox';
function optionsFrom(
  children: React.ReactNode,
  groupDisabled = false,
): SearchOption[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (
      !React.isValidElement<React.OptionHTMLAttributes<HTMLOptionElement>>(
        child,
      )
    )
      return [];
    if (child.type === 'option')
      return [
        {
          value: String(child.props.value ?? optionText(child.props.children)),
          label: child.props.children,
          disabled: groupDisabled || Boolean(child.props.disabled),
        },
      ];
    return optionsFrom(
      child.props.children,
      groupDisabled || Boolean(child.props.disabled),
    );
  });
}
/** Retains a real select target and native FormData while presenting the shared search field. */
export const NativeSearchSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { optionLimit?: number }
>(
  (
    {
      children,
      value,
      defaultValue,
      onChange,
      className,
      id,
      name,
      disabled,
      required,
      'aria-label': label,
      'aria-describedby': describedBy,
      'aria-invalid': invalid,
      optionLimit,
      ...props
    },
    forwardedRef,
  ) => {
    const options = optionsFrom(children);
    const [internal, setInternal] = React.useState(
      String(defaultValue ?? options.find((o) => !o.disabled)?.value ?? ''),
    );
    const selected = String(value ?? internal),
      element = React.useRef<HTMLSelectElement>(null);
    React.useImperativeHandle(forwardedRef, () => element.current!, []);
    return (
      <>
        <select
          {...props}
          ref={element}
          hidden
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          disabled={disabled}
          value={selected}
          onChange={onChange}
        >
          {children}
        </select>
        <SearchCombobox
          id={id}
          value={selected}
          options={options}
          className={className}
          disabled={disabled}
          required={required}
          label={label}
          describedBy={describedBy}
          invalid={invalid === true || invalid === 'true'}
          {...(optionLimit === undefined ? {} : { optionLimit })}
          placeholder="جست‌وجو و انتخاب…"
          onValueChange={(next) => {
            setInternal(next);
            if (element.current) {
              element.current.value = next;
              onChange?.({
                target: element.current,
                currentTarget: element.current,
                type: 'change',
              } as React.ChangeEvent<HTMLSelectElement>);
            }
          }}
        />
      </>
    );
  },
);
NativeSearchSelect.displayName = 'NativeSearchSelect';
