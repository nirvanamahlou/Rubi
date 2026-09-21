import styles from './login-background-story.module.css';

export function LoginBackgroundStory() {
  return (
    <div className={styles.story} aria-hidden="true">
      <div className={styles.aviationBackground} />
    </div>
  );
}
