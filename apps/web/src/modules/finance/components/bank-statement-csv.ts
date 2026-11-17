/** Bank signed movement: credit to the bank account is positive. Preserve reference text. */
export function parseBankCsv(raw: string) {
  if (raw.length > 100000) throw new Error('فایل صورتحساب بیش از حد مجاز است.');
  const lines = raw.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  if (
    lines.shift()?.trim().toLowerCase() !==
    'date,credit,debit,reference,description'
  )
    throw new Error('سرستون صورتحساب معتبر نیست.');
  return lines
    .filter((x) => x.trim())
    .map((line, i) => {
      const fields: string[] = [];
      let value = '',
        quoted = false,
        closed = false;
      const fail = (): never => {
        throw new Error('ردیف نامعتبر در صورتحساب: ' + String(i + 2));
      };
      for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (ch === '"') {
          if (quoted && line[j + 1] === '"') {
            value += '"';
            j++;
          } else if (quoted) {
            quoted = false;
            closed = true;
          } else if (value === '' && !closed) {
            quoted = true;
          } else fail();
        } else if (ch === ',' && !quoted) {
          fields.push(value.trim());
          value = '';
          closed = false;
        } else {
          if (closed) fail();
          value += ch;
        }
      }
      if (quoted) fail();
      fields.push(value.trim());
      const [date, credit, debit, reference, description] = fields;
      if (
        i >= 500 ||
        fields.length !== 5 ||
        !date ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
      )
        return fail();
      const num = (n: string | undefined) => {
        if (n && !/^\d+(\.\d{1,18})?$/.test(n)) fail();
        return n && /[1-9]/.test(n) ? n : null;
      };
      const inc = num(credit),
        out = num(debit);
      if (!!inc === !!out) return fail();
      return {
        date,
        amount: inc ?? '-' + out,
        reference: reference ?? '',
        description: description ?? '',
      };
    });
}
