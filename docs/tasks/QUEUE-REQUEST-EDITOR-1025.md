# QUEUE-REQUEST-EDITOR-1025

PC-C. Clicking a request in the handling queue now opens the existing request/assignee editor directly, replacing the intermediate workflow panel. It fetches the exact request within its authorized branch/contact scope and the contact's latest call for the summary. Stored title, reason, result, assignee, status and priority use the same existing editor and save endpoint as contact requests.

Pending loads are aborted on close; failed/missing requests show an error rather than a blank creation form. Read-only viewers retain read-only access with a close action. Successful saves emit the existing workflow refresh event. Closing returns focus to the queue trigger; loading-to-editor handoff suppresses premature focus restoration.

No API, migration, dependency, telephone routing or automatic popup policy changes. Existing next-env.d.ts changes remain outside this task. Validation and local runtime acceptance are recorded below on completion.

Validation complete:4 workflow tests, scoped ESLint, full Web TypeScript and production build65 pages pass. Browser acceptance onlocalhost3000 confirms direct opening of the existing prefilled editor and focus returning to its queue row on cancel. No request saved during acceptance. Closed-state restoration is covered by the existing unit test. Subsequent optional closed-row browser check was interrupted by the pre-existing outbound call popup queue; own review tab was closed without modifying calls.

Local Web PID22824 runs from F:/Projects/Rubi/tmp/queue-request-editor-1025/apps/web with .next-request-reason-1025. API remains unchanged. Screenshot tmp/queue-request-editor-1025/queue-editor.png is outside Git. Build used an isolated dependency tree and2 workers; compilation5min, TypeScript93s.
