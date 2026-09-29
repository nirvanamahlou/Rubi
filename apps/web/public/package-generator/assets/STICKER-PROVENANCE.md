# Calendar stickers — 2026-09-12

Two date-only sticker templates, generated locally by canvas with a real transparent PNG alpha channel. Original references are copied unchanged to assets/sticker-jahan-reference.png and assets/sticker-niayesh-reference.png. Static logos and brand lettering are drawn directly from those references; no newly generated logo is substituted.

- niayesh: original `C:/Users/admin/AppData/Local/Temp/codex-clipboard-508610b9-8d64-4fe6-90d8-72af269ebba6.png`; clean backing plate `assets/sticker-niayesh-clean.png`.

Prompt used with built-in image_gen.imagegen:

> Use case: precise-object-edit and background-extraction. Edit target: attached square calendar sticker. Prepare a clean blank-date backing plate at the EXACT same 1254x1254 size and registered geometry. Remove ONLY the large yellow Persian weekday in the center, the large white Persian day/month in the middle, and the yellow Gregorian date digits beneath. Keep the entire Niayesh Seir bird logo, English name, all turquoise curved Persian agency lettering and curved website EXACTLY unchanged. Keep the silver circular rim and electric blue glossy disk, reflections, white inner circle. Reconstruct the original navy/blue background seamlessly ONLY under deleted date lettering. No replacement text, no new elements, no redesigned logo. Outside the sticker shape make genuinely transparent alpha, NOT a checkerboard drawing, NOT a black or white background. Preserve the existing sticker artwork and edge antialiasing. Do not crop, move, resize, or rotate the sticker.

- jahan: original `C:/Users/admin/AppData/Local/Temp/codex-clipboard-ce8768ac-082f-4eb3-aeb6-2e84dab70886.png`; clean backing plate `assets/sticker-jahan-clean.png`.

Prompt used with built-in image_gen.imagegen:

> Use case: precise-object-edit and background-extraction. Edit target: attached square calendar sticker. Prepare a clean blank-date backing plate at the EXACT same 1254x1254 size and registered geometry. Remove ONLY the top English weekday/date line, large pink Persian weekday, and large white Persian date/year in the middle. Keep the pink Jahan Bastan logo, both white Persian agency lines at the bottom, pink horizontal separators, navy gradients, white perimeter and folded silver top right corner EXACTLY unchanged. Reconstruct the original navy/blue background seamlessly ONLY under deleted date lettering. No replacement text, no new elements, no redesigned logo. Outside the sticker shape make genuinely transparent alpha, NOT a checkerboard drawing, NOT a black or white background. Preserve the existing sticker artwork and edge antialiasing. Do not crop, move, resize, or rotate the sticker.

Generated originals retained at:
- Jahan: C:/Users/admin/.codex/generated_images/01a07ad5-c92b-7ff2-87b7-c92106d8bd90/exec-df1216d8-0fc9-4bb3-b9b9-e7617cee8583.png
- Niayesh: C:/Users/admin/.codex/generated_images/01a07ad5-c92b-7ff2-87b7-c92106d8bd90/exec-b5a0c0fd-22ac-4f79-9e4b-4594ebee9d1c.png

The generated backing plates contain RGB pixels rather than alpha, despite the transparent-background request. They are used only inside feathered date masks. The application's canvas outline clips the reference and backing layers to the sticker shape on an initially transparent canvas. The checkerboard/black surroundings are not painted into the PNG output. Original static artwork is preserved; reconstructed date backgrounds and newly typeset dates are not asserted pixel-identical to unavailable layered sources.

Font bytes embedded from this machine's existing C:/Windows/Fonts/TITRB.TTF and C:/Windows/Fonts/ARIALN.TTF are used only for the editable date lettering; no external font requests. They retain their respective font rights. No runtime API, network access, or image generation is used. Calendar conversion uses the browser Intl Persian calendar and a UTC date search with validation, not an estimated year offset.

