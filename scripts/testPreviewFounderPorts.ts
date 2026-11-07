import assert from 'node:assert/strict';
import net from 'node:net';
import { assertLoopbackPortAvailable, chooseLoopbackPort } from './previewFounderPorts.js';

const listeners: net.Server[] = [];

async function listen(port = 0): Promise<{ server: net.Server; port: number }> {
  const server = net.createServer();
  listeners.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert(address && typeof address !== 'string', 'Expected a TCP port.');
  return { server, port: address.port };
}

async function main(): Promise<void> {
  try {
    const attempted: number[] = [];
    const alternative = await chooseLoopbackPort(
      [19099, 9099],
      async (port) => { attempted.push(port); return false; },
      async () => 50569,
    );
    assert.deepEqual(attempted, [19099, 9099], 'Both configured Auth defaults should be checked in order.');
    assert.equal(alternative, 50569, 'An occupied preferred port must select the OS-assigned alternative.');
    console.log('PASS occupied default Auth ports select an alternative.');

    const selected = await chooseLoopbackPort([]);
    await listen(selected);
    await assert.rejects(
      assertLoopbackPortAvailable(selected, 'Firebase Auth Emulator'),
      new RegExp(`Selected Firebase Auth Emulator port ${selected} is no longer available; existing listeners were left untouched\\.`),
    );
    console.log('PASS a claimed selected port causes safe startup failure.');
  } finally {
    await Promise.all(listeners.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
