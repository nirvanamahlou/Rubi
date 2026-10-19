const names = new Set([
  'دفتر مرکزی',
  'نیایش سیر سحر',
  'جهان باستان',
  'قسطی رو',
  'قسطی روو',
  'جهان آکادمی',
  'جهان اکادمی',
  'جهان آکادمیا',
]);
const normalize = (name: string) =>
  name
    .replace(/^شرکت\s+/, '')
    .replaceAll('ي', 'ی')
    .replaceAll('ك', 'ک')
    .trim();

/** Default only new-user drafts; editing an existing account retains its persisted scopes. */
export function defaultNewUserBranches(
  branches: readonly { id: string; name: string }[],
): string[] {
  return [
    ...new Set(
      branches
        .filter((branch) => names.has(normalize(branch.name)))
        .map((branch) => branch.id),
    ),
  ];
}
