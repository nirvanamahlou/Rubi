# Call dossier audio download — 2026-10-24

PC-C, owner explicitly authorizes the download action below registration time in
each call's expanded description. Base cd561146 preserves approved dossier cards.
The local runtime's separate caller-name work is retained by scoped copies.

## Behavior and contracts

- New localized action: دانلود فایل صوتی / Download audio file. Text precedes the
  decorative icon in logical order: icon left in RTL Persian, right in LTR English.
  Existing secondary-button styling, keyboard activation and visible focus retained.
- No eager per-row audio requests. First click obtains actual completed recordings
  for that call, downloads a single file or shows separate choices for multiple files.
  Empty/expired/unauthorized/network cases display explicit localized messages.
  Repeated clicks are guarded, pending fetch aborts on unmount and blob URLs expire.
- `GET /integrations/telephony/recordings/calls/:callId` returns opaque IDs/sizes only.
  `GET /integrations/telephony/recordings/calls/:callId/:id/audio` returns authenticated
  WAV bytes with attachment disposition and a server-generated UUID filename.
- Both require Call Center read plus existing recordings.read permission. Current
  actor branch scope is checked against the call and recording connection. Exact
  call-session connection/root/reference binding prevents substituting a different
  call's recording. Complete/unexpired storage, chunk integrity, no-store, rate
  budget and read audit reuse the existing media service.
- Customer Affairs exposes a public callRecordingContext; Integrations does not
  query its tables. Existing attention-only media route retains its offer/claim
  restrictions. The new dossier route deliberately uses visible-call scope plus
  explicit recordings permission, so capture-only calls do not need popup offers.
- Browser uses the configured ERP API, credentials and branch header. Provider
  URLs are never accepted. Redirects and non-WAV responses cannot become downloads.

## Boundaries

No permission grants, data migration, dependencies, PBX changes or automatic popup
activation. No technical/test section added. The only UI change is the requested
download action and its necessary file selection/status feedback.

This feature serves audio actually ingested into the existing encrypted storage.
The known PBX recording directory is not an HTTP download URL. Real PBX audio
ingestion/correlation still requires the pending file access/SSH integration.
Missing recordings are never represented by a fabricated URL or successful download.
Users lacking recordings.read see a disabled action with an explanation.

## Validation

11 Web tests pass: exact audio bytes, authenticated URL/branch/abort/no-cache,
empty/multiple manifests, denial/expiry/rate/server errors, provider URL rejection,
non-audio response rejection and both icon directions/permission presentation.
10 disposable PostgreSQL scenarios pass, including additional dossier download
without active offers, byte equality, missing media permission, wrong branch/call,
expired recordings, audit and shared rate-limit enforcement. No test data entered
the operational database. Authenticated browser acceptance and download of an
actual company recording remain dependent on login/permission and ingested audio.

Scoped API/Web ESLint and API TypeScript passed; Web production build includes
TypeScript and all65 pages. API Nest build passed into dist-audio-download-1024;
Web output is .next-audio-download-1024 in the completion runtime worktree.
An existing unrelated generated CSS warning remains; no CSS changed.
Before activation, ports3000/4000 were found replaced by concurrent work (API
dist-answer-1024 in call-center-publish-1022). Those processes were preserved;
switching the live preview awaits user coordination. No live activation claimed.

Follow-up2026-10-24: owner authorized local activation with all approved changes.
RECORDING-READINESS-1024 composes this feature with current own/team authorization
and staff-answer display, and records actual local activation and remaining gates.
