export interface SubmissionLock {
  readonly locked: boolean;
  run(action: () => void | Promise<void>): Promise<boolean>;
}

export function createSubmissionLock(): SubmissionLock {
  let locked = false;
  return {
    get locked() {
      return locked;
    },
    async run(action) {
      if (locked) return false;
      locked = true;
      try {
        await action();
        return true;
      } finally {
        locked = false;
      }
    },
  };
}
