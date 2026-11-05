import { expect, it, vi } from 'vitest';
import {
  chromePdfPageCount,
  renderPdfWithSmallOverflowFit,
} from './pdf-overflow-fit';

const html = '<style>@page{size:A4}</style><p>Keep every line</p>';
const pdf = (pages: number) =>
  Buffer.from('%PDF-1.4\n/Type /Pages\n' + '/Type /Page\n'.repeat(pages));

it('keeps a single page at its original size without retries', async () => {
  const original = pdf(1);
  const render = vi.fn().mockResolvedValue(original);
  expect(await renderPdfWithSmallOverflowFit(html, render)).toBe(original);
  expect(render).toHaveBeenCalledTimes(1);
  expect(chromePdfPageCount(original)).toBe(1);
});

it('does not shrink intentionally separate voucher hotel or appendix pages', async () => {
  const original = pdf(4);
  const render = vi.fn().mockResolvedValue(original);
  expect(await renderPdfWithSmallOverflowFit(html, render, 4)).toBe(original);
  expect(render).toHaveBeenCalledTimes(1);
});

it('uses the gentlest fit that removes the extra page, retaining all HTML and footer markup', async () => {
  const original = pdf(2),
    compact = pdf(1),
    gentle = pdf(1);
  const render = vi
    .fn()
    .mockResolvedValueOnce(original)
    .mockResolvedValueOnce(compact)
    .mockResolvedValueOnce(gentle);
  expect(await renderPdfWithSmallOverflowFit(html, render)).toBe(gentle);
  expect(render.mock.calls[1]?.[0]).toContain('zoom:0.95');
  expect(render.mock.calls[2]?.[0]).toContain('zoom:0.98');
  for (const [candidate] of render.mock.calls)
    expect(candidate).toContain('<p>Keep every line</p>');
});

it('uses at most five percent reduction and keeps the full-size version when no page is saved', async () => {
  const original = pdf(3);
  const render = vi
    .fn()
    .mockResolvedValueOnce(original)
    .mockResolvedValueOnce(pdf(3));
  expect(await renderPdfWithSmallOverflowFit(html, render)).toBe(original);
  expect(render).toHaveBeenCalledTimes(2);
});

it('keeps five percent only when two percent would leave the overflow', async () => {
  const compact = pdf(1);
  const render = vi
    .fn()
    .mockResolvedValueOnce(pdf(2))
    .mockResolvedValueOnce(compact)
    .mockResolvedValueOnce(pdf(2));
  expect(await renderPdfWithSmallOverflowFit(html, render)).toBe(compact);
});

it('does not break a valid download when a retry fails', async () => {
  const original = pdf(2);
  const render = vi
    .fn()
    .mockResolvedValueOnce(original)
    .mockRejectedValueOnce(new Error('busy'));
  expect(await renderPdfWithSmallOverflowFit(html, render)).toBe(original);
});

it('preserves the compact result if the gentler retry fails', async () => {
  const compact = pdf(1);
  const render = vi
    .fn()
    .mockResolvedValueOnce(pdf(2))
    .mockResolvedValueOnce(compact)
    .mockRejectedValueOnce(new Error('busy'));
  expect(await renderPdfWithSmallOverflowFit(html, render)).toBe(compact);
});

it('does not guess page counts for unsupported PDF representations', async () => {
  const original = Buffer.from('%PDF-1.4 unknown');
  const render = vi.fn().mockResolvedValue(original);
  expect(await renderPdfWithSmallOverflowFit(html, render)).toBe(original);
  expect(render).toHaveBeenCalledTimes(1);
});
