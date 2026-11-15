# Insurance contract mobile fallback — 2026-11-15

The official provider Swagger (`https://sandboxapi.travis.ir/swagger/v1/swagger.json`, inspected read-only on 2026-11-15) declares `Person.mobile` required with `minLength: 1`; `PersonEditInput.mobile` is also required. No customer policy was created or confirmed to probe validation.

Contract-linked passenger correction accepts a blank mobile. Provider projection uses the passenger phone first, then the encrypted contract buyer phone, then the current payer customer contact. Blank or malformed phone contacts are skipped. No fallback is written into the passenger profile, and missing all real numbers remains an actionable input error. Standalone insurance retains its required mobile because it has no contract payer. Existing branch/membership and sensitive-read audit checks remain in place.

When the insured's email is blank, the final provider request uses the owner-specified `Niyayeshseir@gmail.com`. A supplied insured email takes precedence. The fallback is applied before request fingerprinting, for both contract and standalone flows, and is never written to the passenger/applicant or exposed as the form field value. No payer email is substituted.
