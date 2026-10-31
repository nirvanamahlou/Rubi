import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { options, redact, observe } from './ami-observe.mjs';

const env = {
  AMI_OBSERVE_HOST: '127.0.0.1',
  AMI_OBSERVE_USERNAME: 'fixture',
  AMI_OBSERVE_SECRET: 'fixture-secret',
  AMI_OBSERVE_COMPANY_NETWORK: 'true',
  AMI_OBSERVE_SECONDS: '1',
};
async function server(run, body) {
  const sockets = new Set();
  const listener = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
    let input = '';
    socket.on('data', (data) => {
      input += data.toString();
      let end;
      while ((end = input.indexOf('\r\n\r\n')) >= 0) {
        const frame = input.slice(0, end);
        input = input.slice(end + 4);
        run(socket, frame);
      }
    });
  });
  await new Promise((r) => listener.listen(0, '127.0.0.1', r));
  try {
    await body({ ...options(env), port: listener.address().port });
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise((r) => listener.close(r));
  }
}
function login(socket, frame, success = true) {
  const id = frame.match(/ActionID: ([^\r]+)/)[1];
  socket.write(
    `Asterisk Call Manager/5.0\r\nResponse: ${success ? 'Success' : 'Error'}\r\nActionID: ${id}\r\n\r\n`,
  );
}

test('requires explicit private transport and valid bounded configuration', () => {
  assert.equal(options(env).port, 5038);
  for (const changed of [
    { AMI_OBSERVE_HOST: '8.8.8.8' },
    { AMI_OBSERVE_HOST: '192.168.999.1' },
    { AMI_OBSERVE_COMPANY_NETWORK: 'false' },
    { AMI_OBSERVE_SECONDS: '601' },
    { AMI_OBSERVE_USERNAME: 'admin\r\nAction: Originate' },
    { AMI_OBSERVE_SECRET: '' },
  ])
    assert.throws(() => options({ ...env, ...changed }));
});

test('redaction correlates channels without caller, extension, raw ID or arbitrary fields', () => {
  const message = {
    event: 'AgentCalled',
    calleridnum: '+12025550123',
    destchannel: 'PJSIP/101-private',
    uniqueid: 'private-id',
    linkedid: 'private-id',
    secret: 'private-token',
    channelstatedesc: 'Ringing',
    queue: '600',
  };
  const value = redact(message, Buffer.alloc(32, 1));
  assert.equal(value.channel, value.linked);
  assert.equal(value.hasDestination, true);
  assert.equal(value.state, 'Ringing');
  const text = JSON.stringify(value);
  for (const privateValue of [
    '+12025550123',
    'PJSIP/101',
    'private-id',
    'private-token',
  ])
    assert.equal(text.includes(privateValue), false);
  assert.notEqual(value.channel, redact(message, Buffer.alloc(32, 2)).channel);
  assert.equal(
    redact({ event: 'PrivateInjectedName' }, Buffer.alloc(32)),
    null,
  );
});

test('real loopback AMI receives fragmented call events and sends Login only', async () => {
  const actions = [];
  await server(
    (socket, frame) => {
      actions.push(frame.match(/Action: ([^\r]+)/)[1]);
      login(socket, frame);
      setTimeout(() => {
        socket.write('Event: Agent');
        socket.write(
          'Called\r\nCallerIDNum: +12025550123\r\nUniqueid: private-id\r\nDestChannel: PJSIP/101\r\n\r\n',
        );
      }, 20);
    },
    async (config) => {
      const output = [];
      const result = await observe(config, (line) => output.push(line));
      assert.equal(result.exitCode, 0);
      assert.equal(result.summary.counts.AgentCalled, 1);
      assert.equal(result.summary.popupDelivery, false);
      assert.deepEqual(actions, ['Login']);
      assert.equal(output.join('').includes('+12025550123'), false);
      assert.equal(output.join('').includes('fixture-secret'), false);
    },
  );
});

test('successful authentication without call events is explicitly inconclusive', async () => {
  await server(login, async (config) => {
    const result = await observe(config, () => {});
    assert.equal(result.summary.connections, 1);
    assert.equal(result.summary.callEvents, 0);
    assert.equal(result.exitCode, 2);
  });
});

test('does not lose a call event coalesced with successful Login', async () => {
  await server(
    (socket, frame) => {
      const id = frame.match(/ActionID: ([^\r]+)/)[1];
      socket.write(
        `Response: Success\r\nActionID: ${id}\r\n\r\nEvent: DialBegin\r\nUniqueid: fixture-call\r\n\r\n`,
      );
    },
    async (config) => {
      const result = await observe(config, () => {});
      assert.equal(result.summary.counts.DialBegin, 1);
      assert.equal(result.exitCode, 0);
    },
  );
});

test('authentication rejection is sanitized and bounded', async () => {
  let attempts = 0;
  await server(
    (socket, frame) => {
      attempts++;
      login(socket, frame, false);
    },
    async (config) => {
      const output = [];
      const result = await observe(config, (line) => output.push(line));
      assert.equal(result.exitCode, 1);
      assert.ok(attempts <= 3);
      assert.equal(result.summary.connections, 0);
      assert.equal(output.join('').includes('fixture-secret'), false);
    },
  );
});

test('connection loss records a gap without pretending to replay or deliver to ERP', async () => {
  await server(
    (socket, frame) => {
      login(socket, frame);
      setTimeout(() => socket.destroy(), 20);
    },
    async (config) => {
      const result = await observe(config, () => {});
      assert.ok(result.summary.gaps > 0);
      assert.equal(result.summary.popupDelivery, false);
      assert.equal(result.exitCode, 2);
    },
  );
});
