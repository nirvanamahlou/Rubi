import styles from './completion-status.module.css';

export function CompletionStatus({
  result,
  callId,
  onEdit,
  disabled = false,
}: {
  result: string;
  callId?: string | undefined;
  onEdit?: ((id: string) => void) | undefined;
  disabled?: boolean | undefined;
}) {
  const complete = result === 'COMPLETE';
  return (
    <button
      type="button"
      className={`${styles.button} ${complete ? styles.complete : styles.incomplete}`}
      disabled={disabled || !callId || !onEdit}
      title="ویرایش اطلاعات تماس"
      onClick={() => {
        if (!disabled && callId && onEdit) onEdit(callId);
      }}
    >
      {complete ? 'تکمیل‌شده' : 'نیازمند تکمیل'}
    </button>
  );
}
