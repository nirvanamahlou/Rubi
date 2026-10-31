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
import styles from './hr-reports.module.css';
import { UsersRound, X } from 'lucide-react';

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
    <section className={styles.people} aria-label="کاربران">
      <div className={styles.peopleHeading}>
        <span>
          <UsersRound size={17} aria-hidden="true" />
          کاربران
        </span>
        <bdi>
          {value.length || people.length} / {people.length}
        </bdi>
      </div>
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
      <span className={styles.peopleSummary}>
        {value.length
          ? `${value.length} / ${people.length}`
          : 'همه کارکنان مجاز'}
      </span>
      {value.length ? (
        <div className={styles.selectedPeople}>
          {people
            .filter((person) => value.includes(person.id))
            .map((person) => (
              <span className={styles.personChip} key={person.id}>
                {person.name}
                <button
                  type="button"
                  aria-label={`حذف از انتخاب: ${person.name}`}
                  disabled={disabled}
                  onClick={() =>
                    onChange(value.filter((id) => id !== person.id))
                  }
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </span>
            ))}
        </div>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={styles.picker}>
          <DialogTitle>کاربران</DialogTitle>
          <DialogDescription>انتخاب از چارت سازمانی</DialogDescription>
          <div className={styles.pickerContent}>
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
            <div className={styles.pickerTree} style={{ fontSize: `${zoom}%` }}>
              {!filtered.length ? (
                <p className={ui.muted}>پرسنلی یافت نشد.</p>
              ) : null}
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
            <div className={styles.formActions}>
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
    </section>
  );
}
