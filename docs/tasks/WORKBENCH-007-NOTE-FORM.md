# WORKBENCH-007 — note creation form

PC-B; branch codex/pc-b-workbench-note-form. User explicitly asks for new-note capability and its form. Native form UI is implemented; durable creation is not complete.

The main Workbench header and Notes tab open the same shared modal. It provides a required title (200 characters), required plain-text body (10,000 characters), counts, cancel, and explicit discard confirmation when text exists. Modal labels, focus handling, escape behavior and theme use the existing Rubi components. Background notification refresh is deferred while the editor is open so it cannot erase entered text.

The save control is disabled with a visible explanation before text entry. The form never creates a note record, sends private text, logs it, or writes browser storage. Closing with confirmation clears the transient form fields. A page reload discards them, as stated in the form. No fake successful save is presented.

Persistence blocker: current origin/codex/pc-a-finance-core-accounting WORK_ASSIGNMENTS still explicitly reserves Migration/Central Docs and shared IAM/Sales/Travel contracts to active Reservations; PR153 independently states the same. Runtime coordinator01a086a4 and B2B owner01a0818d confirmed they do not hold or transfer this schema lock. No migration may be implemented/applied under their runtime coordination alone. Original user instructions permit UI/public-port fallback while the migration lock remains, but require real private owner-only storage before claiming completion of notes.

Required follow-up: handoff/reserve migration ownership; define PrivateNote with real owner IAM FK and owner-only authorization (no supervisor/delegate access), plain-text validation and safe persistence; establish versioned public create/list/update contract; test cross-user denial, reload/login persistence and failure/retry; rehearse migrations with backup before coordinating API4190 cutover. Do not overload HR, Documents or Notifications storage.

Validation: scoped Workbench lint/typecheck and16existing model/service tests passed. Production build and browser form checks are recorded after runtime handoff. No API/data/schema/dependency changes or merge.
