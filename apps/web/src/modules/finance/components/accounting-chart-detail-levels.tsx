'use client';

import type {
  AccountingAttributes,
  AccountingSnapshotV1,
} from '@nora/contracts';
import {
  changeDetailType,
  chartDetailLevels,
  chartDetailLevelTitles,
  detailTypeIds,
  enableChartDetailLevel,
  type ChartDetailLevel,
} from '../accounting-chart-form';

export function AccountingChartDetailLevels({
  attributes,
  types,
  level,
  onSelect,
  onChange,
}: {
  attributes: AccountingAttributes;
  types: AccountingSnapshotV1['configurations'];
  level: ChartDetailLevel | null;
  onSelect: (level: ChartDetailLevel) => void;
  onChange: (attributes: AccountingAttributes) => void;
}) {
  const selected = level === null ? [] : detailTypeIds(attributes, level);
  const controlled =
    level === null ? [] : attributes[`detail${level}NatureTypeIds`];
  const choices = types
    .filter(
      (type) =>
        type.kind === 'detail-types' &&
        (type.active || selected.includes(type.id)),
    )
    .sort((a, b) => a.title.localeCompare(b.title, 'fa'));
  return (
    <div className="grid min-h-64 gap-3 @min-[30rem]:grid-cols-[minmax(10rem,1fr)_2fr]">
      <fieldset className="min-w-0 border border-slate-300 p-1">
        <legend className="px-1">سطوح تفصیلی</legend>
        <table className="w-full text-right" aria-label="سطوح تفصیلی">
          <thead className="bg-sky-50">
            <tr>
              <th className="w-8" />
              <th className="px-2 py-1.5">عنوان</th>
            </tr>
          </thead>
          <tbody>
            {chartDetailLevels.map((item) => (
              <tr
                key={item}
                onDoubleClick={() => onSelect(item)}
                className={`border-t ${level === item ? 'bg-sky-100' : 'odd:bg-slate-50/60'}`}
              >
                <td className="px-2">
                  <input
                    type="checkbox"
                    aria-label={`فعال بودن ${chartDetailLevelTitles[item]}`}
                    checked={attributes[`detail${item}Required`] === true}
                    onDoubleClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      onChange({
                        ...(event.target.checked
                          ? enableChartDetailLevel(attributes, item)
                          : attributes),
                        [`detail${item}Required`]: event.target.checked,
                      })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    aria-pressed={level === item}
                    aria-controls="coa-detail-type-grid"
                    className="w-full px-2 py-2 text-right outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500"
                    onClick={() => onSelect(item)}
                  >
                    {chartDetailLevelTitles[item]}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>
      <fieldset className="min-w-0 border border-slate-300 p-1">
        <legend className="px-1">انواع تفصیلی</legend>
        <div
          key={level ?? 'unselected'}
          className="h-60 overflow-auto"
          id="coa-detail-type-grid"
        >
          <table
            className="w-full text-right"
            aria-label={
              level === null
                ? 'انواع تفصیلی'
                : `انواع تفصیلی ${chartDetailLevelTitles[level]}`
            }
          >
            <thead className="sticky top-0 z-10 bg-sky-50">
              <tr>
                <th className="w-8" />
                {attributes.natureControlScope === 'SELECTED_DETAIL' && (
                  <th>کنترل ماهیت</th>
                )}
                <th className="px-2 py-1.5">عنوان</th>
              </tr>
            </thead>
            <tbody>
              {level !== null &&
                choices.map((type) => (
                  <tr
                    key={type.id}
                    className="border-t odd:bg-slate-50/60 hover:bg-sky-50"
                  >
                    <td className="px-2">
                      <input
                        id={`coa-detail-type-${type.id}`}
                        type="checkbox"
                        aria-label={`انتخاب ${type.title} در ${chartDetailLevelTitles[level]}`}
                        checked={selected.includes(type.id)}
                        disabled={!type.active && !selected.includes(type.id)}
                        onChange={(event) =>
                          onChange(
                            changeDetailType(
                              attributes,
                              level,
                              type.id,
                              event.target.checked,
                            ),
                          )
                        }
                      />
                    </td>
                    {attributes.natureControlScope === 'SELECTED_DETAIL' && (
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`کنترل ماهیت ${type.title} در ${chartDetailLevelTitles[level]}`}
                          disabled={!selected.includes(type.id)}
                          checked={
                            Array.isArray(controlled) &&
                            controlled.includes(type.id)
                          }
                          onChange={(event) =>
                            onChange({
                              ...attributes,
                              [`detail${level}NatureTypeIds`]: event.target
                                .checked
                                ? [
                                    ...new Set([
                                      ...(Array.isArray(controlled)
                                        ? controlled
                                        : []),
                                      type.id,
                                    ]),
                                  ]
                                : (Array.isArray(controlled)
                                    ? controlled
                                    : []
                                  ).filter((id) => id !== type.id),
                            })
                          }
                        />
                      </td>
                    )}
                    <td>
                      <label
                        htmlFor={`coa-detail-type-${type.id}`}
                        className="block cursor-pointer px-2 py-2"
                      >
                        {type.title}
                      </label>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </fieldset>
    </div>
  );
}
