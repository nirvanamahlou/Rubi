import styles from './login-background-story.module.css';

export function LoginBackgroundStory() {
  return (
    <div className={styles.story} aria-hidden="true">
      <div className={styles.staticBackground} />
      <div className={styles.skyPatch} />
      <div className={styles.airplaneLayer} />
      <div className={styles.nooraMist}>
        <span className={styles.cloudWriter} />
        <strong className={styles.nooraWord}>NOORA</strong>
      </div>
    </div>
  );
}
