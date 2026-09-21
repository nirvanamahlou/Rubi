import styles from './login-background-story.module.css';

export function LoginBackgroundStory() {
  return (
    <div className={styles.story} aria-hidden="true">
      <div className={styles.staticBackground} />
      <div className={styles.skyPatch} />
      <div className={styles.airplaneLayer} />
      <div className={styles.nooraCloud}>
        <svg
          className={styles.nooraCloudOutline}
          viewBox="0 0 640 300"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M113 250h387c55 0 98-31 98-74 0-42-31-73-78-75-18-36-53-57-94-57-4-27-30-40-59-40-42 0-76 20-94 55-18-9-37-14-59-14-50 0-91 36-96 85-39 8-68 40-68 80 0 23 9 40 25 55 15 14 33 21 58 21Z" />
        </svg>
        <span>NOORA</span>
      </div>
    </div>
  );
}
