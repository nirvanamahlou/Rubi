# NORA-PERSIAN-RESPONSE-1117

Owner requests Persian business wording instead of English internal field/tool/source identifiers and actual formatting instead of visible Markdown stars/dashes.

## Implementation

The shared calculation policy now requires Persian public prose, headings, formulas, explanations and limitations for Persian questions across current/future ERP domains. SQL, tool arguments, citation IDs, permissions, evidence and exact numeric operands remain unchanged. Non-cancelled and active remain distinct business populations. Literal record references and original proper names are not fabricated or transliterated.

AssistantResponseContent supports an explicit safe subset: headings, strong emphasis, inline quoted text, nested ordered/unordered lists and existing pipe tables. All content remains React-escaped text; HTML, images and executable links are never interpreted. User messages remain plain original text. Persian presentation translates complete reserved technical tokens, not substrings, arbitrary names/IDs or numbers.

Source labels use the bilingual Assistant copy dictionary with business names instead of raw schema/tool IDs. Unknown sources get a generic authorized-data label. Observation date and time are separate Tehran-localized fields. English UI localization remains supported; no internal source identifier is exposed there either.

## Validation and release

139 standalone service tests and282 Assistant/English-coverage tests pass; focused ESLint and formatting pass. Tests cover formatting, nesting, table emphasis, negative amounts, identifiers, escaped HTML/link injection, source localization and Tehran midnight. Full local typecheck is blocked by the pre-existing linked dependency setup: unchanged API voucher-settings cannot resolve @nora/contracts. A clean hosted build/typecheck and production candidate build are distinct mandatory gates; this local command is not reported successful.

No migration, dependency, data, IAM or calculation changes. Prior1766 source/runtime lease was explicitly released in its final PR notes. This unit does not edit1761 provider/SQL protocol files. Bounded Web and Nora release preparation must retain current peer source/private config, public Agent build admission, Germany-only egress, quota exemptions and host deployment lock. Verify current deployed source before patching; backup and rollback prior image/container. Final hosted checks, production activation and browser evidence will be recorded in the PR release section.