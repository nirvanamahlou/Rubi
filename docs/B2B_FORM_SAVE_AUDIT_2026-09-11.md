# Agency form save audit — 2026-09-11

PC-B. Authenticated UI audit on localhost:3100. Synthetic organization: ORG_Q9WGXUJ2F2AN (آزمایش فرم‌ها ۲۰ شهریور). No existing customer records overwritten; no contract approval, credit activation or accounting transaction executed.

| Form | Observed result |
| --- | --- |
| Initial cooperation wizard | Organization saved but representative initially failed because preferredChannel was omitted. Fixed in613436e. Email-only representative saved successfully on runtime retest. |
| Organization identity | Name, legal type, AGENCY role and synthetic national ID persisted. |
| Representative | Standalone representative and wizard representative both visible after returning to profile. |
| Profile/account manager | Nirvana, HQ, displayOrder99 persisted; cooperation under review. |
| Agency branch/address | Synthetic Tehran address saved and remained visible after login renewal. |
| Signatory | Inactive synthetic signatory saved; no signing authority activated. |
| Contract | Draft AGR-D82F5FA090674CB2 saved with synthetic attachment. |
| Credit policy | 1,000,000IRR saved in draft. |
| Guarantee | QA-GUARANTEE-0911 and1,000,000IRR saved with separate attachment; required, not received. |
| Temporary credit | Draft updated to1,500,000IRR, ending2026-10-02; visible in details. |
| Agreed rate | 250,000IRR saved, inactive. |
| Discount | 5% saved, inactive. |
| Commission | 2% saved, inactive. |
| Financial statement document | File stored and listed; expiry displayed one day late. |
| Invoice document | File stored and listed; same expiry issue reproduced. |
| Activity report | 17 stored HQ events visible, including profile, contract revisions, rates and document events. |

Expiry defect: Documents normalizes the calendar expiry to UTC23:59 on its public service. Local-time display incorrectly showed the next day. Final fix3af6ebe preserves the existing service serialization and renders the UTC calendar date; the regression test uses the service-shaped expiry. The earlier request-only fix80c1169 was insufficient and is superseded. Existing records need no rewrite.

Validation:107 Organizations tests, Web lint and TypeScript pass. Wizard fix already passed combined production build and live retest. Final expiry display retest passed on combined source004c669 / hr005-02787b347c596a3e at3100: existing statement document now displays selected1405/7/10 after a full reload. Combined build passed; API unchanged.

Limitations: finance transaction rows are explicitly synthetic previews; real document storage is tested, not accounting posting. New-user form requires entry of a new credential and must be completed by the user under browser handoff policy. Report download event was not observed; no successful export claim.
Additional UI verification: logo PNG uploaded, image shown in header and archive link created. Organization edit saved displayOrder91; reopening showed version4 and the saved value. Two representative records confirmed in the profile list.
Edit checks: representative job title changed to آزمون ذخیره و ویرایش and remained visible with existing masked email retained. Branch address updated with و ویرایش and saved correctly. These edits affect only the synthetic organization.

All six finance upload forms saved a separate synthetic PNG and displayed the new record. Branch: جهان آکادمیا. Document codes: statement E199C009DF29; invoice ED167788B6EF; receipt18AB73F3957D; cheque67D3F12AAA8E; settlement0A15F78E5E21; dispute2A94D1B56C58 (all prefixed DOC-20260911-). Stored expiry date2026-10-02. These are document records, not financial postings.

User handoff: new-user form prepared with synthetic display name, username agency_form_qa_0911, inactive status and profile-only default visibility. Password left empty; no submission. User must enter the new password and submit. This form is not counted as a successful save.
