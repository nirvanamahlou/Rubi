# CALLBACK-RESOLUTION-1105

COMPUTER_ID=PC-C. Owner reports completed callback contacts remaining pending and a pre-agent disconnect description replacing the saved employee in the existing edit form.

## Root causes

The callback projection deliberately prioritized PBX technical answer flags over editable outcomes. It consequently ignored legitimate authenticated COMPLETE_CALL/SAVE receipts when a conversation was recorded after the original missed event, or when a later outgoing leg lacked a technical answer flag. Two exact production examples have ANSWERED business outcomes and authorized completion receipts, but the original PBX missed/no-answer evidence remains unchanged.

Recipient hydration separately replaced the stored operator with a derived pre-agent-disconnect description whenever the original inbound event lacked a proven destination. That description then appeared in the existing editor despite the saved conversation and employee label.

## Correction

- Read-only callback resolution accepts current ANSWERED records with exact, branch-scoped, nonanonymous COMPLETE_CALL/SAVE audit evidence. Provider answers, business conversation resolution and follow-up/task resolution remain distinct. No provider answer timestamp, answer responsibility or access grant is fabricated.
- Audit reads are paginated in batches of500. Explicit new outcome transitions record before/after outcome snapshots. Legacy records use their earliest authorized completion receipt; editing an already answered record does not extend its resolution time and hide a newer missed call. A new explicit successful transition can resolve a reopened need.
- A later genuine missed call reopens the contact. Missing receipts, unsuccessful attempts, unrelated sessions, synthetic calls and future facts do not qualify as successful conversations.
- An ANSWERED business record retains its saved operator instead of a contradictory derived missed-call label. No employee identity is inferred when absent. No form layout or provider technical history changes.

No schema, dependency, permission or historical business-data rewrite is required. Exact sample identifiers and private diagnostics remain outside Git. Production verification and final release evidence follow validation.
