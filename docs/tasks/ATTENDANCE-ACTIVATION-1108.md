# Attendance activation — PC-B

User-authorized employee/date exclusion, not employee deactivation or punch deletion.

- `POST /hr/attendance/activation` takes ISO `from`, `to`, `employeeIds` and boolean `active`; optional `recordId`/`version` restricts an individual edit. Native demo/nima + hr.manage authority, employee branch scope, closed-period rules, serializable transaction, idempotency and audit apply. Maximum366 days,200 employees and2000 employee-days per transaction; oversized work is rejected before writes.
- Persist `attendanceActive:false` on the daily attendance record and status `غیرفعال`; absent/future days get a marker. Device recalculation preserves exclusion and refreshes the retained underlying metrics/status. Reactivation restores the latest underlying status. Original checkins and their provider identifiers are never modified by activation.
- HR and employee-profile history remain visible with muted rows; status changes are available in their common editor. Operational exports omit excluded rows. Self performance, daily penalties, dashboard and reporting projections exclude disabled attendance; the detailed report also removes corresponding employee/date checkins.
- Payroll worksheets currently accept explicit manual inputs, with no automatic attendance import. Any future attendance-fed payroll must use the HR eligible-attendance projection (`attendanceForUse`) rather than raw HrRecord/checkins or visible history rows. An inactive day is excluded, not an absence and not a zero-rate working day. This change does not rewrite previously approved payroll/financial documents.
- No schema migration, dependency changes or operational data changes during implementation.

Validation: persisted database regression covers disable-before-sync, device recomputation, reactivation, idempotent replay, cross-employee transaction rollback and byte-equivalent original punch rows. Unit checks cover native access, scope, stale versions, closed periods, consumer filtering, zero penalty eligibility and self totals/history/today exclusion. UI datasets retain inactive row identities for both history tables.
