# SALES-OUTPUT-TERMS-0907

PC-A; current local Sales branch; base 148fdf8. COMPLETE_LOCAL.

## Change

Added the three user-provided notices below signatures and above Nystkt.ir in the shared contract print/PDF template:

- در صورت تأیید نشدن هتل درخواستی، هتل مشابه جایگزین می‌گردد.
- توجه داشته باشید این برگه بدون قبض رسید صندوق فاقد هرگونه اعتبار می‌باشد.
- با آگاهی از مفاد قراردادهای خارج از کشور که توسط سازمان میراث فرهنگی و گردشگری تهیه گردیده است، نسبت به ارسال درخواست به آژانس نیایش سیر سحر اقدام نموده و ارسال درخواست به منزله قبول تمامی شرایط، مواد و تبصره‌های قرارداد فوق می‌باشد.

Typography is 8.5pt B Nazanin with 1.35 line height and a non-splitting notice block. Compact whitespace and a wider Latin hotel-name column retain the normal two-passenger A4 layout without reducing money/table typography. Existing six sections, signatures, English money, Finance values and website remain.

This is user-supplied presentation text, not a legal-validity assessment. No API, schema, permission, confirmation, customer-consent record, hotel replacement workflow or cashier receipt status changed.

## Verification / handoff

- 14 print/PDF route tests, scoped ESLint, production Web TypeScript/build passed.
- Actual PDF renderer generated a one-page two-passenger and three-page 42-passenger sample. All four final pages inspected for clipping, correct notice placement and readability.
- Previous Web build retained at ignored tmp/terms-web-before-0907; local Web3100 updated. API/database unchanged.
- Task-specific template and central-doc reservations released. Local commit only; no public remote push or merge.
