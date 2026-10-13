# Dropdown substring matching — PC-A — 2026-09-29

Owner asks that text anywhere inside option names/codes match, then merge. The shared matcher now always includes displayed labels alongside aliases/search codes before case-insensitive normalized substring matching and the six-result limit. This fixes labels omitted by a separate searchText field. Existing Master Data repository already searches names, English names and codes with Prisma contains/insensitive; no backend change required.

Regression coverage: Persian middle-of-name with an independent code, middle of English aliases, middle of service codes, matching beyond the initial six, no-match results, normalization and canonical values. Twelve focused Web tests passed; lint/typecheck/build and full CI gate results are recorded in the PR. No migration/API/dependency or operational data changes.
