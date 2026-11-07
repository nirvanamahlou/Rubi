export function shouldSendOnEnter(event: {
  key: string;
  shiftKey: boolean;
  repeat: boolean;
  isComposing: boolean;
  keyCode: number;
}) {
  return (
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.repeat &&
    !event.isComposing &&
    event.keyCode !== 229
  );
}
export function matchesConversationSearch(values: string[], search: string) {
  const normalize = (value: string) =>
    value
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/\u200c/g, ' ')
      .toLocaleLowerCase()
      .trim();
  return values.some((value) => normalize(value).includes(normalize(search)));
}
