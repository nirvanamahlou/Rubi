# Jahan Bastan document branding

PC-A presentation-only work. The issuing company code JAHAN_BASTAN selects the supplied logo and canonical company name in contract, issued flight-ticket, reservation-form and hotel-voucher outputs. Existing company uploads for this own-company brand are superseded by the new bundled logo; agency uploads and other company brands retain their behavior. No stored contract/workflow/company data is changed.

Asset: apps/web/public/brand/jahan-bastan-transparent.png, RGBA1254×1254, alpha0–255. Extracted from the user-supplied Jahan Bastan JPEG using the built-in image_gen tool. Existing horizontal asset retained.

Final image prompt:

> Use case: background-extraction. Edit target: supplied JAHAN BASTAN company logo. Remove ONLY the white and light-gray checkerboard background entirely, producing true transparent alpha including all internal letter counters and gaps. Preserve precisely the navy blue and medium gray symbol, plane and swooshes, Persian lettering جهان باستان, line and small triangle, and Latin JAHANBASTAN lettering. Do not redesign, redraw, translate, recolor or alter shapes or spacing. Clean crisp edges without white/checkerboard halo. Keep complete logo centered with small transparent margins, suitable for travel-document headers.

Validation: targeted company-specific rendering/download regressions preserve other company brands and agency uploads. Four synthetic A4 outputs generated and visually inspected; Jahan logos retain color instead of the existing white filter. Contract notices and reservation footer omit Niyayesh contact details for Jahan. English localization preserves Jahan Bastan as a company name. No authenticated user submit, operational write or local runtime rollout.
