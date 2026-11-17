# Nora chat interaction — PC-C / 2026-11-17

Branch: `codex/pc-c-nora-chat-scroll-1117`, original base `979d435ef`.

## Behavior

- A submitted user bubble appears immediately, and the input clears before any
  network operation completes. Completion appends only the assistant reply.
- Pending user bubbles stay local-only until a successful remote response; failed
  or cancelled attempts are not silently inserted into future provider history.
- Every asynchronous path displays one accessible waiting status with a spinner,
  including v2, v3 and Workbench guide selection. No invented streamed text or
  fake progress stages are shown. Errors and cancellation remove pending feedback.
- Typing the next draft does not abort an active request, erase that draft on
  completion, or enable duplicate same-tick submissions.
- Submission scrolls the transcript to its latest message. Responses and resized
  content stay pinned while the user is near the bottom. Scrolling up pauses
  following and exposes a keyboard-accessible latest-message arrow. It never
  scrolls the surrounding ERP page. Reduced-motion preference is respected.
- Existing history retention, safe rendering, guide routing, scope resets and
  authorization-denial behavior remain. No provider/API, permission, database,
  migration, dependency version or Production change.

## Verification

Targeted Assistant/English tests and scoped ESLint are recorded with final counts
in the PR. Tests exercise actual submit handlers with delayed HTTP, legacy v2,
duplicate sends, next-draft preservation, failure/history isolation, navigation,
identity changes and deterministic resize/scroll boundaries.

Browser: an isolated loopback preview mounted the actual AssistantComposer and
its CSS with synthetic identity and delayed synthetic HTTP, without ERP/Groq
access. Immediate user bubble and spinner were observed before the response;
typing remained possible; final output retained the next draft. A long response
scrolled to the bottom, Home exposed the arrow, and clicking it returned to the
latest message. The ERP page scroll position stayed0. This is UI acceptance,
not authenticated Production or live-model acceptance.

Local production compilation succeeds with Webpack. Default Turbopack rejects
the pre-existing shared dependency junction outside the worktree root; full
local type completion also encounters stale shared contracts and absent API
dependency artifacts. Do not call these full gates successful. Hosted clean
lint/type/build/test checks remain required on the final PR head. No assertions,
quality gates, compiler settings or shared dependency artifacts were weakened.

Rollback: revert this UI-only commit and rebuild Web. No migration or server
rollback is required because this task has not changed a runtime.
