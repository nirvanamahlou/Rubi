# Ticket round-trip fare return date — 2026-09-29

- `COMPUTER_ID=PC-A`; branch `codex/pc-a-ticket-roundtrip-return-date-0929`, based on `origin/develop@de3f70eb` and integrated with develop through `24f07449`. Implementation commit: `50e4d67e`; PR: [#465](https://github.com/nirvanamahlou/Rubi/pull/465).
- Ticket Management now lists each round-trip fare under its outbound offer with the matching return departure date and time. Hovering or keyboard-focusing the entry opens an accessible tooltip with the return flight number and exact date/time.
- Multiple return offers for one outbound flight remain separate rows. A missing return-offer row does not discard its fare; the UI labels its date as unknown while retaining the fare amount.
- Implementation is Web-only. No API or shared contract, database/schema/migration, permission, dependency/lockfile, operational data, or runtime change.
- Validation: 6 focused Vitest checks passed; affected-file ESLint passed; Web typecheck passed; Web production build passed (55 routes). Browser-authenticated visual interaction was not run.
