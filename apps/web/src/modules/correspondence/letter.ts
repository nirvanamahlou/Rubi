export const companies = [
  { id: 'niayesh', title: 'نیایش سیر', color: '#163b75' },
  { id: 'jahan', title: 'جهان باستان', color: '#76512a' },
  { id: 'ghesti', title: 'قسطی روو', color: '#176b5a' },
] as const;
export const initialTemplate =
  'با سلام و احترام\n\n{{متن}}\n\nبا سپاس و احترام\n{{امضا}}\n{{شرکت}}';
export type Letter = {
  company: string;
  recipient: string;
  subject: string;
  date: string;
  number: string;
  signer: string;
  text: string;
  template: string;
};
export function wrapLetterParagraph(
  text: string,
  width: (text: string) => number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const character of text) {
    if (line && width(line + character) > maxWidth) {
      const boundary = line.lastIndexOf(' ');
      if (boundary > 0) {
        lines.push(line.slice(0, boundary));
        line = line.slice(boundary + 1);
      } else {
        lines.push(line);
        line = '';
      }
    }
    line += character;
  }
  lines.push(line);
  return lines;
}
export function composeLetter(letter: Letter): string {
  if (!letter.subject.trim() || !letter.recipient.trim() || !letter.text.trim())
    throw new Error('گیرنده، موضوع و متن نامه را تکمیل کنید.');
  const variables: Record<string, string> = {
    متن: letter.text,
    امضا: letter.signer,
    شرکت: letter.company,
    گیرنده: letter.recipient,
    موضوع: letter.subject,
    تاریخ: letter.date,
    شماره: letter.number,
  };
  if (!letter.template.includes('{{متن}}'))
    throw new Error('قالب باید متغیر {{متن}} را داشته باشد.');
  return letter.template.replace(/\{\{([^{}]+)\}\}/g, (_, name: string) => {
    if (!(name in variables))
      throw new Error(`متغیر ناشناخته در قالب: ${name}`);
    return variables[name]!;
  });
}
