# Nora calculation explanations — shared contract v1

This applies to every computed answer produced by Nora, independently of the ERP
module. Connecting a new domain does not grant additional data access. Source
ownership, native IAM, scope, privacy, precision and evidence freshness remain
separate mandatory controls.

## User-facing behavior

Groq chooses prose, list, formula or table appropriate to the question. There is
no fixed table, row order, heading or Sales-only answer template. Explain the
source and metric grain, actual period/date basis/timezone, authorized scope and
applied filters, included/excluded records/statuses, formula and relevant
operands/subtotals, units/currency, rounding and incomplete coverage where
applicable. Unknown criteria must be identified as unknown, never invented.
This is a short reproducible calculation explanation, not private reasoning.

Counts, sums, averages, percentages, ratios, differences, comparisons, balances
and precomputed monetary metrics fall under the rule. Keep currencies separate
without a verified FX source. Explain ratio denominators, zero denominators,
overlapping populations, joins, confirmed vs pending money and zero vs unavailable
data. An identifier is not automatically a computed metric.

## Tool and provider integration

All current model entry points capable of authoring answers load CALCULATION_POLICY from
services/assistant/calculation-policy.mjs. The legacy messages-only planner still
cannot receive ERP results or fabricate figures; its schema is unchanged. The
Workbench guide selector only chooses catalog identifiers and cannot author a
computed answer; it stays on its existing minimal selector contract.

New calculated tool results must include bounded metadata:

```json
{"calculation":{"required":true,"operations":["sum","arithmetic"]}}
```

Use operation identifiers, not instructions, raw private SQL, secrets or record
content. Sales SQL derives metadata from the validated AST rather than keyword
matching in strings/comments. Monetary source views are marked even for direct
reads of precomputed values. The native count tool marks composed counts as
calculated. No source or query privilege expands.

For Agent factual answers citing calculated evidence, Groq supplies the optional
final-protocol field calculationExplanation (string, at most4000 characters).
The orchestration requires it for computed evidence, shows it alongside text
when separate and avoids an exact duplicate when already included. Combined
public text stays within6000 characters. Layout and wording remain model-authored.
The public v3 schema is unchanged: the explanation is displayed within text.

A missing/invalid/oversized explanation gets at most one format repair within
the existing eight turns,60 seconds and token budget. Repair does not rerun SQL;
normal context/authorization rechecks apply before the next model call and final
release. Repeated failure is controlled, not replaced with fabricated numbers or
a canned calculation. Internal calculation flags are not public source metadata.
Cited results still must belong to the current request.

## Extending a module

When registering a new Nora data tool, its owner must mark derived values,
document grain/filters/units/status and date semantics in the authorized catalog,
and test current evidence, missing explanations, unit/currency separation,
zero/missing/truncated data and scope revocation. Reuse the shared provider and
final-answer admission path. Never create a module-specific provider omitting
the common policy. Add a semantic oracle test for that tool's actual arithmetic;
presence of explanatory text alone does not prove numeric or business accuracy.

Tests use synthetic HR/overtime, inventory and money examples to verify this
module-independent formatting contract. They do not claim those domains are
connected or that live model acceptance has run for them.
