import styles from './hr-reports.module.css';
import type { RadanCoefficientNode } from './radan-report-fields';
import {
  coefficientPaths,
  normalizeCoefficientSelection,
} from './radan-report-fields';
import { RequiredFieldLabel } from './required-field-label';

export function HrReportChoices({
  title,
  options,
  value,
  onChange,
  required = false,
}: {
  title: string;
  options: readonly { id: string; label: string }[];
  value: readonly string[];
  onChange: (ids: string[]) => void;
  required?: boolean;
}) {
  return (
    <fieldset className={styles.choices}>
      <legend>
        <RequiredFieldLabel required={required}>{title}</RequiredFieldLabel>
      </legend>
      <label>
        <input
          type="checkbox"
          checked={options.length > 0 && value.length === options.length}
          disabled={!options.length}
          onChange={(e) =>
            onChange(e.target.checked ? options.map((option) => option.id) : [])
          }
        />
        همه{' '}
        <bdi>
          ({value.length} / {options.length})
        </bdi>
      </label>
      <div className={styles.choiceList}>
        {!options.length ? <p>گزینه‌ای برای انتخاب وجود ندارد.</p> : null}
        {options.map((option) => (
          <div key={option.id}>
            <label>
              <input
                type="checkbox"
                checked={value.includes(option.id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...value, option.id]
                      : value.filter((id) => id !== option.id),
                  )
                }
              />
              {option.label}
            </label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
export function HrCoefficientTree({
  nodes,
  parent = '',
  value,
  onChange,
}: {
  nodes: readonly RadanCoefficientNode[];
  parent?: string;
  value: readonly string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className={styles.coefficientTree}>
      {nodes.map((node) => {
        const path = parent ? `${parent} / ${node.label}` : node.label;
        const descendants = coefficientPaths([node], parent);
        const check = (
          <label>
            <input
              type="checkbox"
              checked={value.includes(path)}
              onChange={(e) =>
                onChange(
                  normalizeCoefficientSelection(
                    e.target.checked
                      ? [...new Set([...value, ...descendants])]
                      : value.filter((id) => !descendants.includes(id)),
                  ),
                )
              }
            />
            {node.label}
          </label>
        );
        return node.children ? (
          <details key={path}>
            <summary>{check}</summary>
            <div style={{ paddingInlineStart: 20 }}>
              <HrCoefficientTree
                nodes={node.children}
                parent={path}
                value={value}
                onChange={onChange}
              />
            </div>
          </details>
        ) : (
          <div key={path}>{check}</div>
        );
      })}
    </div>
  );
}
