export class PhoneVerificationRequestGate {
  private revision = 0;
  private pendingRevision: number | undefined;

  get busy() {
    return this.pendingRevision !== undefined;
  }

  begin() {
    this.revision += 1;
    this.pendingRevision = this.revision;
    return this.revision;
  }

  invalidate() {
    this.revision += 1;
    this.pendingRevision = undefined;
  }

  isCurrent(requestRevision: number) {
    return this.revision === requestRevision;
  }

  settle(requestRevision: number) {
    if (!this.isCurrent(requestRevision)) return false;
    this.pendingRevision = undefined;
    return true;
  }
}
