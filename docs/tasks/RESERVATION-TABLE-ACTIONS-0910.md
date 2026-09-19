# RESERVATION-TABLE-ACTIONS-0910

PC-A; base88c7c6b; branch codex/pc-a-reservation-table-actions-0910.

Hotel action/confirmation cells now offer accessible checkbox buttons opening the selected contract's existing workflow dialog. Action opens the reservation form and register-sending command; confirmation opens supplier confirmation plus atomic voucher issuance. Legacy confirmed-but-unissued requests open voucher issuance directly. Existing required reason, branding, supplier reference, insurance acknowledgement, versioning, permission checks and Finance delivery gate remain enforced by the original workflow.

Opening a checkbox or cancelling the dialog does not mutate state. Checkmarks and row colors follow persisted refreshed queue data via the existing workflow-change event. Completed steps cannot be repeated or unchecked; cancelled requests and actors without reservations.documents.manage cannot execute these shortcuts. The confirmation checkmark now means voucherIssued, not merely supplierStatus CONFIRMED. Legacy supplier confirmation remains light gray; voucher issuance is dark gray. XLSX consumes the same corrected flags.

Scope is Web only. No backend/schema/permission/financial changes, actual supplier messages or real voucher issuance. Local publication hold retained. Web activation requires restarting the user's existing PowerShell process due the previously observed startup policy restriction; API need not restart.

Validation:46 Web tests and7 API workflow tests passed. Scoped ESLint, TypeScript and41-route production build passed. Synthetic browser opened the actual checkbox/dialog without a mutation, verified insurance acknowledgement gates confirmation, checked submitted command/version/reference and kept the checkbox unchecked after a simulated409. No real approvals or supplier messages were sent.
