export const companies = [
  {
    id: 'niayesh',
    title: 'نیایش سیر',
    letterhead: '/correspondence/letterheads/niayesh-seir.png',
    metadataRight: 273,
    metadataY: [0.063, 0.094, 0.126],
    logo: [0.73, 0.018, 0.24, 0.145],
  },
  {
    id: 'jahan',
    title: 'جهان باستان',
    letterhead: '/correspondence/letterheads/jahan-bastan.png',
    metadataRight: 300,
    metadataY: [0.057, 0.096, 0.135],
    logo: [0.74, 0.018, 0.23, 0.158],
  },
  {
    id: 'ghesti',
    title: 'قسطی روو',
    letterhead: '/correspondence/letterheads/ghesti-roo.png',
    metadataRight: 290,
    metadataY: [0.057, 0.086, 0.116],
    logo: [0.6, 0.035, 0.37, 0.09],
  },
] as const;
const opening = 'با سلام خدمت {{مخاطب}}\n\n';
const closing = '\n\nبا سپاس و احترام\n{{فرستنده}}\n{{امضا}}\n{{شرکت}}';
export const letterTemplates = [
  {
    id: 'general',
    title: 'نامه اداری عمومی',
    body: opening + '{{متن}}' + closing,
  },
  {
    id: 'request',
    title: 'درخواست اقدام',
    body:
      opening +
      'احتراماً، درخواست زیر جهت بررسی و اقدام تقدیم می‌شود:\n\n{{متن}}\n\nخواهشمند است نتیجه بررسی و اقدام مقتضی را اعلام فرمایید.' +
      closing,
  },
  {
    id: 'followup',
    title: 'پیگیری مکاتبه',
    body:
      opening +
      'احتراماً، در پیگیری موضوع «{{موضوع}}»، موارد زیر به استحضار می‌رسد:\n\n{{متن}}\n\nخواهشمند است آخرین وضعیت و نتیجه اقدام را اعلام فرمایید.' +
      closing,
  },
  {
    id: 'cooperation',
    title: 'درخواست همکاری',
    body:
      opening +
      'احتراماً، در خصوص زمینه همکاری با {{شرکت}}، پیشنهاد زیر ارائه می‌شود:\n\n{{متن}}\n\nخواهشمند است در صورت موافقت، نظر خود را برای هماهنگی مراحل بعدی اعلام فرمایید.' +
      closing,
  },
  {
    id: 'notice',
    title: 'اطلاع‌رسانی اداری',
    body:
      opening +
      'احتراماً، در خصوص «{{موضوع}}» به استحضار می‌رساند:\n\n{{متن}}' +
      closing,
  },
] as const;
export const initialTemplate = letterTemplates[0].body;
export type Letter = {
  company: string;
  recipient: string;
  recipientTitle?: string;
  sender?: string;
  subject: string;
  date: string;
  number: string;
  attachment?: string;
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
    مخاطب: [letter.recipientTitle?.trim(), letter.recipient.trim()]
      .filter(Boolean)
      .join(' '),
    فرستنده: letter.sender || '',
    موضوع: letter.subject,
    تاریخ: letter.date,
    شماره: letter.number,
    پیوست: letter.attachment || 'ندارد',
  };
  if (!letter.template.includes('{{متن}}'))
    throw new Error('قالب باید متغیر {{متن}} را داشته باشد.');
  return letter.template.replace(/\{\{([^{}]+)\}\}/g, (_, name: string) => {
    if (!(name in variables))
      throw new Error(`متغیر ناشناخته در قالب: ${name}`);
    return variables[name]!;
  });
}
