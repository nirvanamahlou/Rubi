'use client';
import {
  Activity,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Phone, Maximize2 } from 'lucide-react';
import { useAccessActor } from '@/modules/iam/access-context';
import { CallForm } from './call-form';
import { useUnsavedGuard } from './use-unsaved-guard';
import styles from './call-form-host.module.css';

type FormProps = ComponentProps<typeof CallForm>;
type Entry = {
  id: string;
  props: FormProps;
  minimized: boolean;
  retain: boolean;
};
type Host = {
  put: (id: string, props: FormProps, retain: boolean) => void;
  release: (id: string) => void;
};
const Context = createContext<Host | null>(null);

export function CallFormProvider({ children }: { children: ReactNode }) {
  const actor = useAccessActor();
  return (
    <SessionHost key={actor?.userId ?? 'anonymous'}>{children}</SessionHost>
  );
}
function SessionHost({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const put = useCallback((id: string, props: FormProps, retain: boolean) => {
    setEntries((current) => {
      const found = current.some((row) => row.id === id);
      return found
        ? current.map((row) =>
            row.id === id ? { ...row, props, retain } : row,
          )
        : [
            ...current.map((row) => ({ ...row, minimized: true })),
            { id, props, retain, minimized: false },
          ];
    });
  }, []);
  const release = useCallback((id: string) => {
    setEntries((current) =>
      current.filter((row) => row.id !== id || (row.retain && row.minimized)),
    );
  }, []);
  const context = useMemo(() => ({ put, release }), [put, release]);
  const remove = (id: string) =>
    setEntries((current) => current.filter((row) => row.id !== id));
  const minimize = (id: string) =>
    setEntries((current) =>
      current.map((row) => (row.id === id ? { ...row, minimized: true } : row)),
    );
  const restore = (id: string) =>
    setEntries((current) =>
      current.map((row) => ({ ...row, minimized: row.id !== id })),
    );
  useUnsavedGuard(
    entries.some((row) => row.minimized),
    true,
  );
  return (
    <Context.Provider value={context}>
      {children}
      <aside className={styles.dock} aria-label="تماس‌های کوچک‌شده">
        {entries
          .filter((row) => row.minimized)
          .map((row) => (
            <button
              key={row.id}
              type="button"
              className={styles.tab}
              aria-label={`بازکردن فرم تماس ${row.props.event.phone || row.props.previous?.name || ''}`}
              title="بازکردن فرم تماس"
              onClick={() => restore(row.id)}
            >
              <Phone size={18} aria-hidden="true" />
              <span>فرم تماس</span>
              <Maximize2 size={14} aria-hidden="true" />
            </button>
          ))}
      </aside>
      {entries.map((row) => (
        <Activity key={row.id} mode={row.minimized ? 'hidden' : 'visible'}>
          <HostedEditor
            entry={row}
            onMinimize={() => minimize(row.id)}
            onRemove={() => remove(row.id)}
          />
        </Activity>
      ))}
    </Context.Provider>
  );
}
function HostedEditor({
  entry,
  onMinimize,
  onRemove,
}: {
  entry: Entry;
  onMinimize: () => void;
  onRemove: () => void;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <CallForm
      {...entry.props}
      busy={saving || entry.props.busy}
      allowInternalNavigation
      onMinimize={onMinimize}
      onClose={() => {
        entry.props.onClose();
        onRemove();
      }}
      onSave={async (call) => {
        if (saving) return;
        setSaving(true);
        try {
          await entry.props.onSave(call);
          onRemove();
          window.dispatchEvent(new Event('call-center:outbound-received'));
        } finally {
          setSaving(false);
        }
      }}
    />
  );
}
/** The shell owns the mounted editor so a minimized manual draft survives route changes. */
export function HostedCallForm({
  retainOnNavigation = false,
  ...props
}: FormProps & { retainOnNavigation?: boolean }) {
  const host = useContext(Context);
  const id = `${props.branchId}:${props.event.id}`;
  useEffect(() => {
    host?.put(id, props, retainOnNavigation);
  }, [host, id, props, retainOnNavigation]);
  useEffect(() => () => host?.release(id), [host, id]);
  return host ? null : <CallForm {...props} />;
}
