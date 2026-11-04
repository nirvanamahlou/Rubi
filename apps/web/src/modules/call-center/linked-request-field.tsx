import { NativeSearchSelect } from '@/components/ui/native-search-select';
import styles from './workspace.module.css';

export function LinkedRequestField({
  requests,
  busy,
  selected,
  onChange,
}: {
  requests: { id: string; title: string; status: string }[];
  busy: boolean;
  selected: string;
  onChange: () => void;
}) {
  const open = requests.filter((request) => request.status !== 'CLOSED');
  if (!open.length) return null;
  return (
    <label>
      این تماس مربوط به کدام درخواست است؟
      <NativeSearchSelect
        name="ticketId"
        aria-label="این تماس مربوط به کدام درخواست است؟"
        className={styles.control}
        disabled={busy}
        defaultValue={open.some((r) => r.id === selected) ? selected : ''}
        onChange={onChange}
      >
        <option value="">بدون اتصال؛ پس از ثبت تعیین می‌کنم</option>
        {open.map((r) => (
          <option key={r.id} value={r.id}>
            {r.title}
          </option>
        ))}
      </NativeSearchSelect>
    </label>
  );
}
