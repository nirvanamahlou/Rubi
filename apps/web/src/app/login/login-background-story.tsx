import styles from './login-background-story.module.css';

export function LoginBackgroundStory() {
  return (
    <div className={styles.story} aria-hidden="true">
      <div className={styles.aviationBackground} />
      <div className={styles.windTrail}>
        <span />
        <span />
        <span />
      </div>
      <div className={styles.nooraMark}>
        <span className={styles.puffOne} />
        <span className={styles.puffTwo} />
        <span className={styles.puffThree} />
        <span className={styles.puffFour} />
        <div className={styles.cloudBody}>
          <span className={styles.sparkle}>✦</span>
          <strong>NOORA</strong>
        </div>
      </div>
    </div>
  );
}
