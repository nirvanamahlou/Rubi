/** Prevent a response started before an acknowledgement from restoring unread items. */
export function createNotificationFeedGuard() {
  let version = 0;
  let writes = 0;
  return {
    beginRead() {
      return writes ? null : ++version;
    },
    canApply(token: number) {
      return !writes && token === version;
    },
    writing() {
      return writes > 0;
    },
    beginWrite() {
      version++;
      writes++;
      let settled = false;
      return () => {
        if (!settled) {
          settled = true;
          writes--;
        }
      };
    },
  };
}
