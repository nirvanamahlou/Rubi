import { describe, expect, it } from 'vitest';
import {
  composeLetter,
  initialTemplate,
  companies,
  wrapLetterParagraph,
  letterTemplates,
  type Letter,
} from './letter';
const letter: Letter = {
  company: 'نیایش سیر',
  recipient: 'مدیریت محترم',
  subject: 'درخواست همکاری',
  date: '۱۴۰۵/۰۷/۱۸',
  number: '001',
  signer: 'واحد اداری',
  text: 'متن اصلی با عبارت {{شرکت}} و <script> که باید عیناً حفظ شود.',
  template: initialTemplate,
};
describe('letter composition', () => {
  it('places the supplied recipient title and sender in every administrative template without inventing titles', () => {
    for (const template of letterTemplates) {
      const result = composeLetter({
        ...letter,
        recipient: 'اکبر',
        recipientTitle: 'دکتر',
        sender: 'واحد فروش',
        template: template.body,
      });
      expect(result).toContain('با سلام خدمت دکتر اکبر');
      expect(result).toContain('واحد فروش');
    }
    expect(composeLetter({ ...letter, recipient: 'اکبر' })).toContain(
      'با سلام خدمت اکبر',
    );
    expect(composeLetter({ ...letter, recipient: 'اکبر' })).not.toContain(
      'دکتر',
    );
  });
  it('wraps at word boundaries so Persian words remain intact', () => {
    const text = 'هماهنگی لازم جهت برگزاری جلسه';
    const lines = wrapLetterParagraph(text, (value) => value.length, 16);
    expect(lines.join(' ')).toBe(text);
    expect(lines.some((line) => line.includes('جهت'))).toBe(true);
    expect(lines.every((line) => line.length <= 16)).toBe(true);
  });
  it('replaces template tokens once and preserves literal user content', () => {
    const result = composeLetter(letter);
    expect(result).toContain(letter.text);
    expect(result).toContain('واحد اداری\nنیایش سیر');
  });
  it('uses each chosen company without mixing brands', () => {
    for (const company of companies)
      expect(
        composeLetter({
          ...letter,
          company: company.title,
          text: 'درخواست',
          template: '{{متن}}\n{{شرکت}}',
        }),
      ).toBe(`درخواست\n${company.title}`);
  });
  it('rejects missing content and unsupported template tokens', () => {
    expect(() => composeLetter({ ...letter, text: '  ' })).toThrow();
    expect(() =>
      composeLetter({ ...letter, template: '{{متن}} {{ناشناخته}}' }),
    ).toThrow('ناشناخته');
    expect(() => composeLetter({ ...letter, template: 'بدون متن' })).toThrow(
      'متغیر',
    );
  });
});
