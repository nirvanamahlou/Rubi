# LOGIN-HIGGSFIELD-BACKGROUND-1003

Status: media production blocked; draft implementation only.

User decision: Higgsfield only; retain the draft until generation access is resolved. Do not substitute local composition as the producer. Existing login tests (16), scoped ESLint, Web typecheck and the 55-route production build pass. Actual media playback and visual acceptance cannot be completed without output. No live runtime change or merge.

The requested deliverable is a photorealistic 10–12 second silent sky video: one white passenger aircraft enters left, trails vapor spelling exactly NOORA above the login card, banks left and finishes small in the upper-right. No browser, form, logos or other screenshot UI may enter the video. The final frame must hold, with a matching still for loading, unsupported playback and reduced motion.

## Generation evidence

- Supplied screenshot uploaded to Higgsfield as media `cb4042b2-fda3-4e0b-8d33-91330280b6bb`.
- Seedance 2.5, 12 seconds, 1080p, silent: estimated 144 credits; submission rejected with `Requires plus plan or higher`.
- Connected account reports Free with 10 credits and no available unlimited/free generations.
- Seedance 2.0 Mini, 10 seconds, 720p, silent: estimated 10 credits; submission rejected with `Requires basic plan or higher`.
- MiniMax H3 Max, 10 seconds, 768p: estimated 25 credits, above the available 10; no submission attempted.
- After the user authorized any model within the 10-credit balance, Kling 2.6 (10s, silent) and Grok Video 1.5 Lite (10s, 480p) each quoted exactly 10 credits. Both submissions were rejected with `Requires basic plan or higher`.
- None of the rejected submissions created a job. No video was generated, downloaded, composited or represented as finished.

## Prepared integration

The login background accepts an optional local video and matching final-frame poster, with optional portrait assets. With no media supplied, the current static background remains active and no missing URL is requested. Playback is muted, inline, automatic and non-looping. The video is revealed only after playback starts; errors leave its poster visible. Reduced-motion preference prevents initial source loading, pauses an active video, and resumes from its existing position if the preference changes back. An ended video is not restarted.

## Completion gate

1. Obtain successful Higgsfield output through an account with generation access, or a user-supplied Higgsfield result.
2. Inspect the full movement and exact NOORA spelling. Composite vapor lettering if needed; do not accept malformed generated text.
3. Strip audio, encode a compact web MP4, extract its exact final frame, and provide portrait-safe media if landscape cropping hides the aircraft or lettering.
4. Supply the verified local assets to `LoginBackgroundStory` in the page. Preserve form layout and reserve sufficient visible sky above it where needed.
5. Verify desktop/mobile, actual autoplay rejection, final-frame hold and reduced-motion behavior in a browser before marking the PR ready. No merge or live runtime change while assets are missing.
