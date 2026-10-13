'use client';
import * as React from 'react';
import type * as SelectPrimitive from '@radix-ui/react-select';
import {
  SearchCombobox,
  optionText,
  type SearchOption,
} from './search-combobox';
type ItemProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>;
type RootProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>;
const Context = React.createContext<{
  value: string;
  options: SearchOption[];
  change: (value: string) => void;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
  name?: string | undefined;
} | null>(null);
function items(children: React.ReactNode): SearchOption[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (
      !React.isValidElement<{
        value?: string;
        children?: React.ReactNode;
        disabled?: boolean;
        textValue?: string;
      }>(child)
    )
      return [];
    if (child.type === SelectItem)
      return [
        {
          value: child.props.value ?? '',
          label: child.props.children,
          ...(child.props.disabled === undefined
            ? {}
            : { disabled: child.props.disabled }),
          searchText: child.props.textValue ?? optionText(child.props.children),
        },
      ];
    return items(child.props.children);
  });
}
export function Select({
  children,
  value,
  defaultValue,
  onValueChange,
  disabled,
  required,
  name,
}: RootProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? '');
  const selected = value ?? internal;
  return (
    <Context.Provider
      value={{
        value: selected,
        options: items(children),
        change: (next) => {
          setInternal(next);
          onValueChange?.(next);
        },
        disabled,
        required,
        name,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(
  (
    {
      children,
      id,
      className,
      disabled,
      'aria-label': label,
      'aria-describedby': describedBy,
      'aria-invalid': invalid,
      'aria-required': ariaRequired,
      style,
      ...attributes
    },
    _ref,
  ) => {
    void _ref;
    const context = React.useContext(Context);
    if (!context) throw Error('SelectTrigger requires Select');
    const child = React.Children.toArray(children).find(
      React.isValidElement<{
        placeholder?: React.ReactNode;
        children?: React.ReactNode;
      }>,
    );
    const placeholder =
      child && React.isValidElement<{ placeholder?: React.ReactNode }>(child)
        ? optionText(child.props.placeholder)
        : '';
    return (
      <SearchCombobox
        style={style}
        dataAttributes={Object.fromEntries(
          Object.entries(attributes).filter(([key]) => key.startsWith('data-')),
        )}
        id={id}
        className={className}
        label={label}
        describedBy={describedBy}
        invalid={invalid === true || invalid === 'true'}
        value={context.value}
        options={context.options}
        disabled={disabled ?? context.disabled}
        required={
          context.required || ariaRequired === true || ariaRequired === 'true'
        }
        name={context.name}
        selectedLabel={
          child && React.isValidElement<{ children?: React.ReactNode }>(child)
            ? child.props.children
            : undefined
        }
        placeholder={placeholder ? 'جست‌وجو — ' + placeholder : undefined}
        onValueChange={context.change}
      />
    );
  },
);
SelectTrigger.displayName = 'SelectTrigger';
export function SelectValue(
  _props: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Value>,
) {
  void _props;
  return null;
}
export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>((_props, _ref) => {
  void _props;
  void _ref;
  return null;
});
SelectContent.displayName = 'SelectContent';
export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  ItemProps
>((_props, _ref) => {
  void _props;
  void _ref;
  return null;
});
SelectItem.displayName = 'SelectItem';
