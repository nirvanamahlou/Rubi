'use client';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { HrButton } from './hr-controls';
import { hrRequest } from './hr-api';
const labels: Record<string, string> = {
  daily: 'دستمزد روزانه',
  seniority: 'پایه سنوات',
  children: 'تعداد فرزند',
  married: 'حق تأهل',
  childRate: 'حق اولاد هر فرزند',
  housing: 'حق مسکن',
  food: 'بن کارگری',
  overtimeHourly: 'دستمزد هر ساعت اضافه کار',
  shortageHourly: 'کسری هر ساعت کسر کار',
  days: 'روز کارکرد',
};
export interface PayConfiguration {
  version: number;
  values: Record<string, string>;
}
export function payrollConfiguration(branch: string, employee = 'defaults') {
  return `/payroll-worksheets/configuration/${branch}/${employee}`;
}
export function HrPayrollConfiguration({
  branchId,
  employeeId,
  writable,
}: {
  branchId: string;
  employeeId?: string;
  writable: boolean;
}) {
  const [data, setData] = useState<PayConfiguration>();
  const [error, setError] = useState('');
  const [edit, setEdit] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    hrRequest<PayConfiguration>(payrollConfiguration(branchId, employeeId))
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setError('دریافت اطلاعات انجام نشد.');
      });
    return () => {
      active = false;
    };
  }, [branchId, employeeId]);
  async function save() {
    if (!data || !edit) return;
    setBusy(true);
    setError('');
    try {
      const next = await hrRequest<PayConfiguration>(
        payrollConfiguration(branchId, employeeId),
        {
          method: 'POST',
          body: JSON.stringify({
            version: data.version,
            values: { ...data.values, [edit]: value },
          }),
        },
      );
      setData(next);
      setEdit(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {error && <p role="alert">{error}</p>}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
          gap: 16,
        }}
      >
        {data &&
          Object.entries(data.values).map(([key, v]) => (
            <div
              key={key}
              style={{
                position: 'relative',
                border: '1px solid #d4e2f7',
                borderRadius: 16,
                padding: 24,
                background: '#f5f8ff',
                minHeight: 115,
              }}
            >
              <span
                style={{ display: 'block', paddingLeft: 32, minHeight: 24 }}
              >
                {labels[key]}
              </span>
              {writable && (
                <HrButton
                  aria-label={`ویرایش ${labels[key]}`}
                  style={{ position: 'absolute', left: 8, top: 8 }}
                  onClick={() => {
                    setEdit(key);
                    setValue(v);
                  }}
                >
                  <Plus size={16} />
                </HrButton>
              )}
              <strong style={{ display: 'block', marginTop: 18, fontSize: 22 }}>
                {v ? Number(v).toLocaleString('fa-IR') : 'خودکار'}
              </strong>
              <small>
                {key === 'children' ? 'فرزند' : key === 'days' ? 'روز' : 'ریال'}
              </small>
            </div>
          ))}
      </div>
      <Dialog
        open={edit !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setEdit(null);
        }}
      >
        <DialogContent>
          <DialogTitle>{labels[edit ?? '']}</DialogTitle>
          {error && <p role="alert">{error}</p>}
          <input
            aria-label={labels[edit ?? '']}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{
              width: '100%',
              padding: 12,
              border: '1px solid #c8d8ef',
              borderRadius: 10,
            }}
          />
          <HrButton primary disabled={busy} onClick={() => void save()}>
            ثبت
          </HrButton>
        </DialogContent>
      </Dialog>
    </div>
  );
}
