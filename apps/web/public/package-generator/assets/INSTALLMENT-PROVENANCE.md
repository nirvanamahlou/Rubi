# Installment banner layer provenance

The eleven `installment-*-reference.png` files are byte-for-byte local copies of the images supplied by the user for the installment-banner category. Each file is 941 × 1672 pixels.

The corresponding `installment-*-clean.png` files were generated with OpenAI's built-in `image_gen` tool in image-edit mode, using the matching reference image as the sole edit target. No web images or external assets were used.

Final prompt used for every cleanup plate (the plate number was appended for bookkeeping):

> Use case: precise image-layer cleanup for a production editable template. Edit the supplied 941x1672 Persian travel advertisement in place. Remove every readable text character, number, price, title, caption, brand/company logo, and logo placeholder. Reconstruct the surfaces behind removed content seamlessly. Preserve all photographs, scenery, hotel/destination thumbnails, icons, pictograms, cards, panels, brush strokes, borders, dividers, gradients, shadows, decorative shapes, and the exact overall layout. Empty text-bearing cards and labels while retaining their designed backgrounds. Do not introduce any new text, letters, numbers, symbols, objects, or logos. Do not crop, resize, rotate, shift, redesign, or change the color palette. Return the same portrait composition and exact 941x1672 dimensions.

The application keeps the untouched reference as the initial preview. The clean plate is only revealed underneath regions that the user edits, and is used as the base for additional pages. Both reference and clean plates are embedded as local data URLs in `installment-assets.js` so offline PNG/PDF export remains origin-clean under the browser's `file:` protocol.
