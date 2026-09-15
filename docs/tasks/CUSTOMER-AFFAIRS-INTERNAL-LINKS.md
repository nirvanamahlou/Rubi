# Customer Affairs connections — backend-only scope

PC-B, `codex/pc-b-customer-affairs-internal-links`, based on live combined `a1d4cf0`.

User clarified: implement backend connections only; do not add a separate section. The new frontend reference/handoff section, pickers and tests built during this work item were withdrawn before commit. Existing UI and backend are unchanged. This is not a completed backend integration delivery.

| Connection | Existing backend capability | Remaining work |
| --- | --- | --- |
| Customers | Existing-customer linkage through public service | Customer creation/conversion and deduplication contract |
| Sales | Qualification/handoff package, response API and accepted contract validation | Sales-owned intake/creation and cross-module outcome contract |
| Reservations | Verified ticket reference and internal referral | Structured response callback |
| Finance | Referral for investigation | Invoice/payment adapter and outcome callback; execution stays Finance |
| Documents | Verified ticket/voucher reference | Authorized delivery/resend contract |
| Workbench | Referral queue, IN_PROGRESS/DONE response and timeline | General task/reminder integration |
| IAM/staff | Existing permissions and scoped staff directory | Real user-linked employees where absent |
| Notifications/satisfaction | Internal assigned-user notification and survey API | Provider delivery, retries and automatic distribution |
| Websites | No persisted source-site registry/filter or live connector | Integrations-owned connection, stable external IDs, authenticated ingress, branch/site isolation, idempotency and outbound delivery |

PC-A owns Customers, Sales, Reservations, Finance and Integrations producers. New shared contracts/schema require coordinated ownership and a separately reserved work item. No producer module, permission, credential, business data or migration was changed.

Read-only QA of the withdrawn UI confirmed Documents metadata access; current account received 403 from Sales and Reservations. No successful live reference write or handoff acceptance was tested. The 42-test/build result belonged to the withdrawn frontend prototype, not to a new backend implementation. Final runtime preserves original Web3100 against API4190, without the extra section. Pending external site work requires platform/API details for jahanbastan.ir and nystkt.ir and securely provisioned connection credentials; no secret in browser code or Git.
