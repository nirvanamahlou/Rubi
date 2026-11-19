/** New definitions must not silently select the first of several authorized branches. */
export function ticketCreationBranch(
  branches: readonly { id: string }[],
  selected: string,
): string {
  if (selected && branches.some((branch) => branch.id === selected))
    return selected;
  if (!selected && branches.length === 1) return branches[0]!.id;
  throw new Error('شعبه ثبت بلیت را انتخاب کنید.');
}
