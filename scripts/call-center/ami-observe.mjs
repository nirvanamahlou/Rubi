// Company-network acceptance tool. Uses the existing AMI transport, never ERP services.
import { createHmac, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

// Reuse API's existing TS loader: the transport now has extensionless TS imports
// and parameter properties that Node's native type stripping cannot execute.
const apiRequire = createRequire(
  new URL('../../apps/api/package.json', import.meta.url),
);
const { require: requireTypeScript } = apiRequire('tsx/cjs/api');
const { AmiClient } = requireTypeScript(
  '../../apps/api/src/integrations/issabel/ami.ts',
  import.meta.url,
);

const events = new Set([
  'Newchannel',
  'Newstate',
  'DialBegin',
  'DialEnd',
  'AgentCalled',
  'AgentConnect',
  'AgentComplete',
  'AgentRingNoAnswer',
  'Hangup',
  'BlindTransfer',
  'AttendedTransfer',
  'BridgeEnter',
  'BridgeLeave',
  'QueueCallerJoin',
  'QueueCallerLeave',
  'MixMonitorStart',
  'MixMonitorStop',
  'UserEvent',
]);
const states = new Set(['Down', 'Ring', 'Ringing', 'Up', 'Busy', 'Dialing']);

export function options(env) {
  const host = env.AMI_OBSERVE_HOST ?? '';
  const octets = host.split('.').map(Number);
  const ipv4 =
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) &&
    octets.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
  const privateHost =
    ipv4 &&
    (octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));
  const port = Number(env.AMI_OBSERVE_PORT ?? '5038');
  const seconds = Number(env.AMI_OBSERVE_SECONDS ?? '120');
  const tls = env.AMI_OBSERVE_TLS === 'true';
  if (
    !privateHost ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !Number.isInteger(seconds) ||
    seconds < 1 ||
    seconds > 600 ||
    (!tls && env.AMI_OBSERVE_COMPANY_NETWORK !== 'true') ||
    !env.AMI_OBSERVE_USERNAME ||
    !env.AMI_OBSERVE_SECRET ||
    /[\r\n\0]/.test(env.AMI_OBSERVE_USERNAME + env.AMI_OBSERVE_SECRET)
  ) {
    throw Error('INVALID_PRIVATE_OBSERVER_CONFIG');
  }
  return {
    host,
    port,
    tls,
    username: env.AMI_OBSERVE_USERNAME,
    secret: env.AMI_OBSERVE_SECRET,
    seconds,
    ...(env.AMI_OBSERVE_CA_PEM ? { ca: env.AMI_OBSERVE_CA_PEM } : {}),
  };
}

export function redact(message, key) {
  if (!events.has(message.event)) return null;
  const alias = (value) =>
    value
      ? createHmac('sha256', key).update(value).digest('hex').slice(0, 16)
      : null;
  return {
    event: message.event,
    receivedAt: new Date().toISOString(),
    channel: alias(message.uniqueid),
    linked: alias(message.linkedid),
    destination: alias(message.destuniqueid),
    hasCaller: !!message.calleridnum,
    hasDestination: !!(
      message.destchannel ||
      message.interface ||
      message.destexten
    ),
    hasQueue: !!message.queue,
    hasSourceTimestamp: !!message.timestamp,
    state: states.has(message.channelstatedesc)
      ? message.channelstatedesc
      : null,
    canonicalHook:
      message.event === 'UserEvent' && message.userevent === 'NoraCall',
  };
}

export async function observe(config, emit = console.log, signal) {
  const key = randomBytes(32);
  const counts = {};
  let received = 0,
    accepted = 0,
    connections = 0,
    gaps = 0,
    attempts = 0;
  let stopped = false,
    current,
    lastError = null;
  const log = (data) => emit(JSON.stringify(data));
  const stop = () => {
    stopped = true;
    current?.close();
  };
  const timer = setTimeout(stop, config.seconds * 1000);
  signal?.addEventListener('abort', stop, { once: true });
  if (signal?.aborted) stop();
  log({
    mode: 'OBSERVE_ONLY',
    erpDelivery: false,
    popupDelivery: false,
    encryptedTransport: config.tls,
    durationSeconds: config.seconds,
  });
  try {
    while (!stopped && attempts < 3) {
      attempts++;
      current = new AmiClient();
      let finish;
      const closed = new Promise((r) => {
        finish = r;
      });
      current.once('disconnected', finish);
      current.on('event', (message) => {
        received++;
        if (received > 10000) {
          lastError = 'EVENT_LIMIT';
          stop();
          return;
        }
        const safe = redact(message, key);
        if (!safe) return;
        accepted++;
        counts[safe.event] = (counts[safe.event] ?? 0) + 1;
        // Bound console volume independently from event counters.
        if (accepted <= 100) log(safe);
      });
      try {
        await current.connect(config);
        connections++;
        log({ state: 'AUTHENTICATED', attempt: attempts });
        await closed;
        if (!stopped) {
          gaps++;
          log({ state: 'GAP', recovery: 'NO_REPLAY' });
        }
      } catch {
        lastError = 'CONNECTION_OR_AUTH_FAILED';
        log({ state: lastError, attempt: attempts });
      } finally {
        current.close();
      }
      if (!stopped && attempts < 3) {
        await new Promise((r) =>
          setTimeout(r, 500 * attempts + Math.random() * 250),
        );
      }
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
    current?.close();
  }
  const summary = {
    mode: 'OBSERVE_ONLY',
    connections,
    attempts,
    gaps,
    received,
    callEvents: accepted,
    counts,
    lastError,
    popupDelivery: false,
    liveCallAcceptance: 'REQUIRES_CONTROLLED_CALL_REVIEW',
  };
  log({ summary });
  return {
    summary,
    exitCode: !connections ? 1 : !accepted || gaps || lastError ? 2 : 0,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const config = options(process.env);
    if (process.argv[2] !== '--connect') {
      console.log(
        JSON.stringify({
          configuration: 'VALID',
          connected: false,
          mode: 'OBSERVE_ONLY',
          popupDelivery: false,
        }),
      );
    } else {
      const abort = new AbortController();
      process.once('SIGINT', () => abort.abort());
      process.once('SIGTERM', () => abort.abort());
      process.exitCode = (
        await observe(config, console.log, abort.signal)
      ).exitCode;
    }
  } catch {
    console.error(
      'AMI observer configuration/runtime failed; no private details logged.',
    );
    process.exitCode = 1;
  }
}
