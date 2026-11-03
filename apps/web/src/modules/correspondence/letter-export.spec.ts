import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderLetterPages } from './letter-export';
import { companies, initialTemplate } from './letter';
afterEach(() => vi.unstubAllGlobals());
describe('letter export typography', () => {
  it('loads the bundled Nazanin font before measuring and drawing every page', async () => {
    const events: string[] = [];
    const drawnFonts: string[] = [];
    const context = {
      font: '',
      fillStyle: '',
      direction: '',
      textAlign: '',
      textBaseline: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      measureText(text: string) {
        events.push('measure');
        expect(this.font).toContain('CorrespondenceNazanin');
        return { width: text.length * 10 };
      },
      fillText() {
        drawnFonts.push(this.font);
      },
    };
    const add = vi.fn(() => events.push('font-added'));
    vi.stubGlobal('document', {
      fonts: { ready: Promise.resolve(), add },
      createElement: () => ({ width: 0, height: 0, getContext: () => context }),
    });
    const load = vi.fn().mockImplementation(async () => {
      events.push('font-loaded');
      return {};
    });
    vi.stubGlobal(
      'FontFace',
      class {
        constructor(family: string, source: string) {
          expect(family).toBe('CorrespondenceNazanin');
          expect(source).toBe('url(/fonts/b-nazanin.ttf)');
        }
        load = load;
      },
    );
    vi.stubGlobal(
      'Image',
      class {
        width = 1240;
        height = 1754;
        decode = async () => {};
      },
    );
    const pages = await renderLetterPages(
      {
        company: companies[0].title,
        recipient: 'Recipient',
        subject: 'Subject',
        date: '2026-11-03',
        number: '1',
        signer: 'Sender',
        text: 'Body',
        template: initialTemplate,
      },
      'Body\n'.repeat(25),
    );
    expect(pages).toHaveLength(2);
    expect(events.slice(0, 2)).toEqual(['font-loaded', 'font-added']);
    expect(drawnFonts.length).toBeGreaterThan(25);
    expect(
      drawnFonts.every((font) => font.includes('CorrespondenceNazanin')),
    ).toBe(true);
  });
});
