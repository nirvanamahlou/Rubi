import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';
import { StringDecoder } from 'node:string_decoder';
import { QueueSnapshotCollector } from './queue-snapshot';
import type { MemberSnapshot } from './sticky-sales';

export type AmiMessage = Record<string, string>;

/** AMI frames can be fragmented or coalesced by TCP. No raw frame is logged. */
export class AmiParser {
  private buffer = '';
  private readonly decoder = new StringDecoder('utf8');
  push(data: Buffer): AmiMessage[] {
    this.buffer += this.decoder.write(data);
    const result: AmiMessage[] = [];
    let end: number;
    while ((end = this.buffer.indexOf('\r\n\r\n')) >= 0) {
      if (Buffer.byteLength(this.buffer.slice(0, end)) > 65536)
        throw Error('AMI_FRAME_LIMIT');
      const frame = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 4);
      const message: AmiMessage = {};
      for (const line of frame.split('\r\n')) {
        if (line.startsWith('Asterisk Call Manager/')) continue;
        const colon = line.indexOf(':');
        if (colon < 1) throw Error('AMI_INVALID_FRAME');
        const name = line.slice(0, colon).toLowerCase();
        if (!/^[a-z][a-z0-9_-]*$/.test(name)) throw Error('AMI_INVALID_HEADER');
        // Variable may repeat, but identity/event fields may never be ambiguous.
        if (Object.hasOwn(message, name) && name !== 'variable')
          throw Error('AMI_DUPLICATE_HEADER');
        message[name] = line.slice(colon + 1).trim();
      }
      if (Object.keys(message).length) result.push(message);
    }
    if (Buffer.byteLength(this.buffer) > 65536) throw Error('AMI_FRAME_LIMIT');
    return result;
  }
}

export interface AmiOptions {
  host: string;
  port: number;
  tls: boolean;
  ca?: string;
  username: string;
  secret: string;
}
export function encodeAction(
  action: string,
  id: string,
  fields: Record<string, string | string[]>,
) {
  const entries = [
    ['Action', action],
    ['ActionID', id],
    ...Object.entries(fields).flatMap(([key, value]) =>
      (Array.isArray(value) ? value : [value]).map((item) => [key, item]),
    ),
  ];
  for (const [name, value] of entries)
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name!) || /[\r\n\0]/.test(value!))
      throw Error('AMI_INVALID_ACTION');
  return (
    entries.map(([key, value]) => `${key}: ${value}\r\n`).join('') + '\r\n'
  );
}

/** One short-lived client per PBX transport generation; never replays actions. */
export class AmiClient extends EventEmitter {
  private socket?: net.Socket;
  private ready = false;
  private snapshotBusy = false;
  private parser = new AmiParser();
  private pending = new Map<
    string,
    {
      resolve: (value: AmiMessage) => void;
      reject: (reason: Error) => void;
      timer: ReturnType<typeof setTimeout>;
      login: boolean;
    }
  >();
  get connected() {
    return this.ready;
  }
  async connect(options: AmiOptions) {
    if (this.socket) throw Error('AMI_ALREADY_OPEN');
    const socket = options.tls
      ? tls.connect({
          host: options.host,
          port: options.port,
          servername: net.isIP(options.host) ? undefined : options.host,
          rejectUnauthorized: true,
          ...(options.ca ? { ca: options.ca } : {}),
        })
      : net.connect({ host: options.host, port: options.port });
    this.socket = socket;
    socket.setKeepAlive(true, 15000);
    socket.on('data', (data: Buffer) => {
      try {
        for (const message of this.parser.push(data)) {
          const pending =
            message.actionid && this.pending.get(message.actionid);
          if (message.response && pending) {
            clearTimeout(pending.timer);
            this.pending.delete(message.actionid!);
            if (message.response === 'Success') {
              // Login and the first event can arrive in the same TCP chunk.
              if (pending.login) this.ready = true;
              pending.resolve(message);
            } else pending.reject(Error('AMI_ACTION_REJECTED'));
          }
          if (this.ready && message.event) this.emit('event', message);
        }
      } catch {
        socket.destroy(Error('AMI_PROTOCOL_ERROR'));
      }
    });
    socket.on('error', () => {
      /* close performs sanitized failure handling */
    });
    socket.once('close', () => {
      this.ready = false;
      for (const item of this.pending.values()) {
        clearTimeout(item.timer);
        item.reject(Error('AMI_OUTCOME_UNKNOWN'));
      }
      this.pending.clear();
      this.emit('disconnected');
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => socket.destroy(Error('AMI_CONNECT_TIMEOUT')),
        5000,
      );
      socket.once(options.tls ? 'secureConnect' : 'connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once('close', () => {
        clearTimeout(timer);
        reject(Error('AMI_UNAVAILABLE'));
      });
    });
    try {
      await this.send('Login', {
        Username: options.username,
        Secret: options.secret,
        Events: 'on',
      });
      this.ready = true;
    } catch (error) {
      this.close();
      throw error;
    }
  }
  private send(
    action: string,
    fields: Record<string, string | string[]>,
    id: string = randomUUID(),
    timeoutMs = 5000,
    closeOnTimeout = true,
  ) {
    if (!this.socket || this.socket.destroyed || this.pending.size >= 32)
      return Promise.reject(Error('AMI_UNAVAILABLE'));
    const frame = encodeAction(action, id, fields);
    return new Promise<AmiMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Error('AMI_OUTCOME_UNKNOWN'));
        if (closeOnTimeout) this.socket?.destroy();
      }, timeoutMs);
      this.pending.set(id, {
        resolve,
        reject,
        timer,
        login: action === 'Login',
      });
      this.socket!.write(frame);
    });
  }
  ping() {
    return this.send('Ping', {});
  }
  /** Read-only, one in flight; a failed preview must not interrupt call capture. */
  async queueSnapshot(
    queue: string,
    wrapupSeconds: number,
  ): Promise<MemberSnapshot | null> {
    if (
      !this.ready ||
      this.snapshotBusy ||
      !Number.isInteger(wrapupSeconds) ||
      wrapupSeconds < 0 ||
      wrapupSeconds > 86400 ||
      !/^[a-zA-Z0-9_.:-]{1,100}$/.test(queue)
    )
      return null;
    this.snapshotBusy = true;
    const id = randomUUID();
    const collector = new QueueSnapshotCollector(queue, id, wrapupSeconds);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let finish: () => void = () => {};
    const completed = new Promise<void>((resolve) => {
      finish = resolve;
      timer = setTimeout(resolve, 750);
    });
    const receive = (message: AmiMessage) => {
      collector.accept(message);
      if (message.actionid === id && message.event === 'QueueStatusComplete')
        finish();
    };
    this.on('event', receive);
    this.once('disconnected', finish);
    try {
      await Promise.all([
        this.send('QueueStatus', { Queue: queue }, id, 750, false),
        completed,
      ]);
      return this.ready ? collector.snapshot() : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      this.off('event', receive);
      this.off('disconnected', finish);
      this.snapshotBusy = false;
    }
  }
  originate(
    id: string,
    extension: string,
    number: string,
    context: string,
    technology: 'SIP' | 'PJSIP',
  ) {
    if (
      !this.ready ||
      !/^\d{2,10}$/.test(extension) ||
      !/^\+?\d{7,15}$/.test(number) ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(context)
    )
      return Promise.reject(Error('AMI_INVALID_ORIGINATE'));
    return this.send(
      'Originate',
      {
        Channel: `${technology}/${extension}`,
        Context: context,
        Exten: number,
        Priority: '1',
        Timeout: '30000',
        Async: 'true',
        Variable: [
          `__NORA_COMMAND_ID=${id}`,
          `__NORA_EXTENSION=${extension}`,
          '__NORA_DIRECTION=OUT',
        ],
      },
      id,
    );
  }
  close() {
    this.ready = false;
    this.socket?.destroy();
  }
}
