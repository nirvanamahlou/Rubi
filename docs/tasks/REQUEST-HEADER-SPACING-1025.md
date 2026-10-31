# REQUEST-HEADER-SPACING-1025

PC-C. User requested a small gap between the contact summary and the first request field. The WorkflowEditor summary now has a scoped editorContact class with margin-block-end:16px. The logical spacing works for both Persian and English. No fields, validation, data, API or popup policy changed.

No migration/dependency change. Existing generated next-env.d.ts modifications are preserved outside this task's commit. Verify existing workflow tests, lint and full Web typecheck/build, then visually check the local popup.

Scoped ESLint and all3 existing workflow tests pass. Production Web build uses an isolated folder and private dependency junctions; the current local service remains active during compilation.

Completed:3 workflow tests, scoped ESLint and full Web TypeScript/build65 pages passed. Local Web3000/PID25116 runs from F:/Projects/Rubi/tmp/request-header-spacing-1025/apps/web; API unchanged. Browser DOM measurement confirms summary-to-form gap changed from0px to16px. Screenshot tmp/request-header-spacing-1025/spacing.png is outside Git. No form saved during acceptance. Copied build cache was discarded after slow memory-heavy compilation; a fresh isolated build succeeded.
