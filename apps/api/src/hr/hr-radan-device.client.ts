import { ServiceUnavailableException } from '@nestjs/common';

export type RadanUser = {
  id: string | number;
  profile?: { personnel_id?: string | number };
  first_name?: string;
  last_name?: string;
};
export type RadanPunch = {
  id: string | number;
  user_id: string | number;
  datetime: string;
  entry_type: string;
  status: string;
  type_id?: number;
};
/** Server-configured origin only. Never accepts a URL from HTTP input; redirects disabled. */
export class RadanDeviceClient {
  private token = '';
  constructor(
    private readonly base: string,
    private readonly username: string,
    private readonly password: string,
  ) {
    const url = new URL(base);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error('Invalid attendance API origin');
  }
  private async request(
    path: string,
    login = false,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(this.base.replace(/\/$/, '') + path, {
      method: login ? 'POST' : 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(40000),
      headers: login
        ? { 'Content-Type': 'application/json' }
        : { Authorization: `Bearer ${this.token}` },
      ...(login
        ? {
            body: JSON.stringify({
              UserName: this.username,
              PassWord: this.password,
            }),
          }
        : {}),
    });
    if (response.status === 401 && !login) {
      await this.login();
      return this.requestOnce(path);
    }
    if (!response.ok)
      throw new ServiceUnavailableException(
        'Attendance provider request failed',
      );
    const text = await response.text();
    if (text.length > 16 * 1024 * 1024)
      throw new Error('Attendance response limit exceeded');
    return JSON.parse(text) as Record<string, unknown>;
  }
  private async requestOnce(path: string) {
    // A fresh client request cannot recurse on another 401.
    const response = await fetch(this.base.replace(/\/$/, '') + path, {
      headers: { Authorization: `Bearer ${this.token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(40000),
    });
    if (!response.ok)
      throw new ServiceUnavailableException(
        'Attendance provider request failed',
      );
    const text = await response.text();
    if (text.length > 16 * 1024 * 1024)
      throw new Error('Attendance response limit exceeded');
    return JSON.parse(text) as Record<string, unknown>;
  }
  async login() {
    const result = await this.request('/V1/Login', true);
    if (typeof result.access_token !== 'string' || !result.access_token)
      throw new Error('Attendance token missing');
    this.token = result.access_token;
  }
  async list<T>(path: string, key: string): Promise<T[]> {
    const rows: T[] = [];
    const seen = new Set<string>();
    let expected: number | undefined;
    for (let page = 0; page < 100; page++) {
      const response = await this.request(`${path}?page=${page}&limit=500`);
      const data = response.data as Record<string, unknown> | undefined;
      const batch = data?.[key];
      const total = (response.meta as { total?: unknown } | undefined)?.total;
      if (!Array.isArray(batch)) throw new Error('Invalid attendance page');
      if (total !== undefined) {
        const count = Number(total);
        if (
          !Number.isSafeInteger(count) ||
          count < 0 ||
          count > 50000 ||
          (expected !== undefined && expected !== count)
        )
          throw new Error('Unstable attendance pagination');
        expected = count;
      }
      for (const item of batch as { id?: unknown }[]) {
        if (item.id == null || seen.has(String(item.id)))
          throw new Error('Repeated attendance page');
        seen.add(String(item.id));
      }
      rows.push(...(batch as T[]));
      if (expected !== undefined && rows.length === expected) return rows;
      if (expected !== undefined && (rows.length > expected || !batch.length))
        throw new Error('Incomplete attendance pagination');
      if (expected === undefined && batch.length < 500) return rows;
    }
    throw new Error('Attendance page limit exceeded');
  }
}
