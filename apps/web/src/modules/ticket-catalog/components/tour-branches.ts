/** Keep successful branches visible and remove only those from the retry selection. */
export async function createTourBranches<T>(
  branches: readonly string[],
  create: (branch: string) => Promise<T>,
  completed: (branch: string, result: T) => void,
) {
  for (const branch of [...new Set(branches)]) {
    const result = await create(branch);
    completed(branch, result);
  }
}
