import type { HrEmployeeDto } from '@nora/contracts';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import { HrButton } from './hr-controls';
import ui from './hr-unified.module.css';

/** Selection changes are local; reporting never writes employee data. */
export function HrReportPeoplePicker({
  people,
  value,
  onChange,
  disabled = false,
}: {
  people: readonly HrEmployeeDto[];
  value: readonly string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(''),
    [draft, setDraft] = useState<readonly string[]>([]),
    [zoom, setZoom] = useState(100);
  const filtered = people.filter((person) =>
    `${person.name} ${person.personnelCode} ${person.unit}`.includes(
      search.trim(),
    ),
  );
  const toggle = (ids: string[], checked: boolean) =>
    setDraft((current) =>
      checked
        ? [...new Set([...current, ...ids])]
        : current.filter((id) => !ids.includes(id)),
    );
  return (
    <div>
      <span>کاربران</span>
      <HrButton
        disabled={disabled}
        onClick={() => {
          setDraft(value);
          setSearch('');
          setZoom(100);
          setOpen(true);
        }}
      >
        افزودن
      </HrButton>
      <span>
        {value.length
          ? `${value.length} / ${people.length}`
          : 'همه کارکنان مجاز'}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>کاربران</DialogTitle>
          <DialogDescription>انتخاب از چارت سازمانی</DialogDescription>
          <div className={ui.spaced}>
            <label className={ui.field}>
              جست‌وجو
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className={ui.filters}>
              <HrButton
                aria-label="کوچک‌نمایی"
                onClick={() => setZoom((value) => Math.max(50, value - 10))}
              >
                −
              </HrButton>
              <span>{zoom}%</span>
              <HrButton
                aria-label="بزرگ‌نمایی"
                onClick={() => setZoom((value) => Math.min(150, value + 10))}
              >
                +
              </HrButton>
              <HrButton onClick={() => setZoom(100)}>تنظیم مجدد</HrButton>
            </div>
            <div
              style={{
                maxHeight: '45vh',
                overflow: 'auto',
                fontSize: `${zoom}%`,
              }}
            >
              {[...new Set(filtered.map((person) => person.unit))]
                .sort()
                .map((unit) => {
                  const members = filtered.filter(
                    (person) => person.unit === unit,
                  );
                  return (
                    <details open key={unit}>
                      <summary>{unit || 'بدون واحد'}</summary>
                      <label>
                        <input
                          type="checkbox"
                          checked={members.every((person) =>
                            draft.includes(person.id),
                          )}
                          onChange={(event) =>
                            toggle(
                              members.map((person) => person.id),
                              event.target.checked,
                            )
                          }
                        />
                        انتخاب واحد
                      </label>
                      {members.map((person) => (
                        <div key={person.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={draft.includes(person.id)}
                              onChange={(event) =>
                                toggle([person.id], event.target.checked)
                              }
                            />
                            {person.personnelCode} — {person.name}
                          </label>
                        </div>
                      ))}
                    </details>
                  );
                })}
            </div>
            <div className={ui.filters}>
              <HrButton onClick={() => setOpen(false)}>لغو</HrButton>
              <HrButton onClick={() => setDraft([])}>همه کارکنان مجاز</HrButton>
              <HrButton
                primary
                onClick={() => {
                  onChange([...draft]);
                  setOpen(false);
                }}
              >
                تایید
              </HrButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
