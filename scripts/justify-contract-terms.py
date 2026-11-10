"""Justify wrapped Persian terms lines without rewriting any legal text.

Requires the development-only pypdf tool. Supply the original PDF with --source;
the original is also retained in Git history. No runtime dependency is added.
"""
import argparse
import hashlib
import io
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream, FloatObject, NumberObject

SOURCE_SHA256 = "8ed0c34f4e94f9802a5ca4f9f0cf45de9ae49fcb92e1018b4ae30d56206767dc"


def raw_text(value):
    return value.get_original_bytes() if hasattr(value, "get_original_bytes") else bytes(value)


def glyphs(reader):
    return [
        [raw_text(args[0]) for args, op in ContentStream(page.get_contents(), reader).operations if op == b"Tj"]
        for page in reader.pages
    ]


def fonts(reader):
    result = []
    for page in reader.pages:
        signatures = {}
        for name, reference in page["/Resources"]["/Font"].items():
            font = reference.get_object()
            descriptor = font.get("/FontDescriptor")
            embedded = descriptor.get_object().get("/FontFile2") if descriptor else None
            signatures[name] = (
                str(font["/BaseFont"]),
                tuple(font.get("/Widths", [])),
                hashlib.sha256(embedded.get_object().get_data()).hexdigest() if embedded else None,
            )
        result.append(signatures)
    return result


def justify(source, output):
    original = source.read_bytes()
    if hashlib.sha256(original).hexdigest() != SOURCE_SHA256:
        raise ValueError("Expected the original, unchanged two-page terms PDF.")
    before = PdfReader(io.BytesIO(original))
    writer = PdfWriter(clone_from=before)
    changed = 0
    for page in writer.pages:
        stream = ContentStream(page.get_contents(), writer)
        lines = []
        matrix_index = None
        font_name = None
        font_size = 0
        for index, (args, op) in enumerate(stream.operations):
            if op == b"Tm":
                matrix_index = index
            elif op == b"Tf":
                font_name, font_size = args
            elif op == b"Tj" and float(font_size) == 10:
                matrix = stream.operations[matrix_index][0]
                if list(map(float, matrix[:4])) != [1, 0, 0, 1]:
                    raise ValueError("Unexpected text transformation.")
                font = page["/Resources"]["/Font"][font_name]
                if font["/Subtype"] != "/TrueType":
                    raise ValueError("Expected the original single-byte embedded TrueType font.")
                raw = raw_text(args[0])
                width = sum(float(font["/Widths"][code - int(font["/FirstChar"])]) for code in raw) * float(font_size) / 1000
                lines.append((index, matrix_index, float(matrix[4]), float(matrix[5]), width, raw.count(b" "), font_name))
        replacements = {}
        for line, following in zip(lines, lines[1:]):
            index, matrix_index, x, y, width, spaces, font = line
            # Original wrapped lines use 12.3pt leading; paragraph gaps are >=14.3pt.
            # Leave paragraph-final lines, headings, headers and footers right aligned.
            if abs(y - following[3] - 12.3) > 0.01 or font != following[6]:
                continue
            left = 37.0
            right = float(page.mediabox.width) - 37.0
            if not spaces or width < 400 or abs(x + width - right) > 0.01 or x < left - 0.01:
                raise ValueError("Unexpected wrapped-line geometry; inspect the source instead of reflowing it.")
            spacing = (right - left - width) / spaces
            matrix = list(stream.operations[matrix_index][0])
            matrix[4] = FloatObject(left)
            stream.operations[matrix_index] = (matrix, b"Tm")
            replacements[index] = spacing
            changed += 1
        operations = []
        for index, operation in enumerate(stream.operations):
            if index in replacements:
                operations.append(([FloatObject(replacements[index])], b"Tw"))
            operations.append(operation)
            if index in replacements:
                operations.append(([NumberObject(0)], b"Tw"))
        stream.operations = operations
        page.replace_contents(stream)
    if not changed:
        raise ValueError("No wrapped body lines found.")
    result = io.BytesIO()
    writer.write(result)
    after = PdfReader(io.BytesIO(result.getvalue()))
    if glyphs(before) != glyphs(after):
        raise ValueError("Original text glyphs changed.")
    if fonts(before) != fonts(after):
        raise ValueError("Original font data changed.")
    if [list(p.mediabox) for p in before.pages] != [list(p.mediabox) for p in after.pages]:
        raise ValueError("Page count or geometry changed.")
    if dict(before.metadata) != dict(after.metadata):
        raise ValueError("Document metadata changed.")
    output.write_bytes(result.getvalue())
    print(f"Justified {changed} wrapped lines; all text glyphs, metadata and both pages preserved.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=Path("apps/web/public/contracts/terms.pdf"))
    args = parser.parse_args()
    justify(args.source, args.output)
