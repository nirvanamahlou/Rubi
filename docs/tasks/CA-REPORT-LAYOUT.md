# CA report layout — PC-B — 2026-09-13

User requested a denser, clearer Rubi report design and activation on Web3100. Baseline1ada1e5f preserves HR panel removal and staff/date fixes. Scope is CA Web component, CSS, tests and documentation only; backend, permissions and records unchanged.

Replaced stretched report panels with four summary cards, two equal-width status distributions, and compact satisfaction/corrective panels. Request/ticket rows show counts and percentages of their respective totals (not percentages of the largest status). Lifecycle ordering, textual labels and counts accompany color. Satisfaction remains a numeric mean out of5; no fabricated conversion rate or satisfaction percentage. Unknown states retain their labels and counts; empty data has explicit placeholders. Desktop two-column and mobile one-column layouts reuse Rubi tokens without a chart dependency. The legacy satisfaction route remains supported.

51 CA tests passed in11 files, including empty results, actual totals, part-of-total percentages, Persian corrective labels and legacy view. Frontend skill guided shared theme/accessibility and no-dependency design. Build and runtime verification are recorded below when completed.

Known repository issue: ordinary fetch/prune and a refetch attempt fail on an existing internal refs/codex/turn-diffs checkpoint object. No internal reference was deleted and remote was not replaced. This is distinct from Web build/runtime functionality.
