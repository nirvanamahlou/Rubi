# WORKBENCH-009 — Message emoji composer

PC-B; codex/pc-b-workbench-message-emoji. User requested emoji insertion in Workbench Messages.

Adds a shared-theme text composer with 24 named Unicode emoji, Persian search, keyboard-accessible buttons and caret/selection-aware insertion. Emoji sequences are accepted atomically within the native textarea 4000-code-unit limit. No dependency, API, schema, browser persistence or message transmission is added. The composer prominently states that sending/storage are unavailable and text is lost on leaving the section; Send remains disabled pending the real owner service and migration handoff.

Validation: 28 Workbench tests, scoped ESLint and web typecheck passed. Five new tests cover caret insertion, selection replacement, multi-code-unit emoji, capacity rejection and replacement at capacity. Production build and browser verification pending the B2B owner-approved pause. Owner requested including 80c1169 (Tehran end-of-day organization document fix) in the same runtime build; API4190 remains unchanged. Prior combined-runtime prerequisites are retained; no merge.

Delivery: production build passed. Source a102dbf404e0ffc8590635882fb73c32c2c25dc9, manifest hr005-0b702d158c6d4660, Web3100/PID24240. API4190 unchanged and health200. Owner granted a safe pause and was notified immediately to resume forms. Authenticated browser QA confirmed Persian heart search, replacing selected text with a complete heart emoji, focus return and correct count; screenshot confirmed themed layout. Synthetic draft cleared, picker left open. PR169draft: https://github.com/nirvanamahlou/Rubi/pull/169. No message or business data submitted.
