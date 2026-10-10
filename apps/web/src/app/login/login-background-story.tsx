'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

import styles from './login-background-story.module.css';

export type LoginBackgroundVideo = {
  src: string;
  /** Extracted from the video's final frame. */
  poster: string;
  portrait?: { src: string; poster: string };
};

export function LoginBackgroundStory({
  video,
}: {
  video?: LoginBackgroundVideo;
}) {
  const player = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = player.current;
    if (!element || !video) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePlayback = () => {
      if (reducedMotion.matches) {
        element.pause();
        return;
      }
      // Assign a source only after checking the preference, avoiding a video
      // download for visitors who request a static background.
      if (!element.getAttribute('src')) {
        element.src =
          video.portrait && window.matchMedia('(orientation: portrait)').matches
            ? video.portrait.src
            : video.src;
      }
      if (!element.ended && !element.error) {
        void element.play().catch(() => setVisible(false));
      }
    };

    updatePlayback();
    reducedMotion.addEventListener('change', updatePlayback);
    return () => {
      reducedMotion.removeEventListener('change', updatePlayback);
      element.pause();
    };
  }, [video]);

  return (
    <div className={styles.story} aria-hidden="true">
      {video ? (
        <>
          <div
            className={styles.videoPoster}
            style={
              {
                '--landscape-poster': `url("${video.poster}")`,
                '--portrait-poster': `url("${video.portrait?.poster ?? video.poster}")`,
              } as CSSProperties
            }
          />
          <video
            ref={player}
            autoPlay
            muted
            playsInline
            preload="none"
            tabIndex={-1}
            className={styles.video}
            data-visible={visible}
            onPlaying={() => setVisible(true)}
            onError={() => setVisible(false)}
          />
        </>
      ) : (
        <div className={styles.aviationBackground} />
      )}
    </div>
  );
}
