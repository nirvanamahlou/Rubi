export const messageEmojis = [
  ['😀', 'لبخند'],
  ['😊', 'خوشحال'],
  ['😂', 'خنده'],
  ['😍', 'عاشق'],
  ['😎', 'عینک آفتابی'],
  ['🤔', 'فکر'],
  ['😔', 'ناراحت'],
  ['😮', 'تعجب'],
  ['👍', 'تأیید'],
  ['👎', 'مخالفت'],
  ['👏', 'تشویق'],
  ['🙏', 'تشکر'],
  ['🤝', 'همکاری'],
  ['👋', 'سلام'],
  ['💪', 'قدرت'],
  ['👌', 'عالی'],
  ['❤️', 'قلب'],
  ['💙', 'قلب آبی'],
  ['🌹', 'گل'],
  ['🎉', 'جشن'],
  ['✅', 'انجام شد'],
  ['⭐', 'ستاره'],
  ['📌', 'سنجاق'],
  ['✈️', 'هواپیما'],
] as const;
export const MESSAGE_DRAFT_LIMIT = 4000;
export function insertMessageEmoji(
  text: string,
  emoji: string,
  start: number,
  end: number,
) {
  const from = Math.max(0, Math.min(text.length, start));
  const to = Math.max(from, Math.min(text.length, end));
  const next = text.slice(0, from) + emoji + text.slice(to);
  if (next.length > MESSAGE_DRAFT_LIMIT) return null;
  return { text: next, caret: from + emoji.length };
}
