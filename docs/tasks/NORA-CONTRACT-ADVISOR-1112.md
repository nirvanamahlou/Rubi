# Nora contract advisor: acceptance and limits

PC-C. This change is a read-only assistant integration. No new permission, migration, receipt upload, document issuance, production deployment or external model call is needed for these reports. Existing Sales operations retain their validation and authorization.

| Scenario (use synthetic records in staging) | Expected |
| --- | --- |
| Enter a Persian-digit reference whose prefix matches more than one page of results | Inspect only the exact number. Two references in one question require clarification. |
| Ask for a customer's contracts with similar names or duplicate results | Offer visible candidate numbers. Never open a record merely because it appears first. |
| Ask about a form with several missing fields, fix one, and ask again | Show current blockers only. Check route, dates, capacity, infant/adult count, rooms and ages, visa, insurance and tour price. |
| Lose the response during create; alternatively, acknowledge create but fail confirmation | Distinguish an unknown outcome from a known created number. Recommend checking before retrying. Do not write from chat. |
| Confirm submission, then fail receipt upload | Report successful dispatch and receipt failure separately; use the existing payment. |
| Ask about an IRR/USD contract with pending, rejected, confirmed and overdue entries | Separate balances by currency and distinguish evidence count from payment approval. |
| Deny access to receipt metadata or audit on an otherwise visible contract | Preserve the authorized summary and explain the unavailable section. Do not report zero or send the question to an external provider. |
| Compare partial fulfillment, changed contract and approved delivery; include floating ticket with no issuance record | Keep selected services, purchases, ticket issuance and finance approval distinct. Asking must not issue or download a ticket. |
| Request status history and amendment audit | Use Tehran times, and expose event headers without snapshots. Do not infer a refund from cancellation. |
| Request personal action queue with two accounts in separate branches | Use the authenticated owner and server scope. Exercise page 2, empty page and a closed contract. |
| Ask how long a queued contract has been stalled | Date the current contract status from its transition only. Missing evidence is unknown. This is not an SLA or time spent in a reservation queue. |
| Change account, branch, pathname or contract while awaiting a response | Recheck scope; old chat context must not reveal data from the prior account or record. |
| Ask about stale drafts, concurrent amendment, changed inventory and multiple guide topics | Provide the relevant recovery steps; never promise availability, overwrite data or claim a refund amount. |

Scope limits: the personal list is ownership-based, not a task assignment system. Lists describe the inspected page. Finance delivery clearance is not proof of actual customer delivery. Historical fee policies, undocumented transitions and documents without source evidence cannot be reconstructed by the assistant.
