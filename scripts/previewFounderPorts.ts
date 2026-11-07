import net from 'node:net';

function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolvePort) => {
    const server = net.createServer();
    server.once('error', () => resolvePort(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolvePort(true)));
  });
}

function freeLoopbackPort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('Could not allocate a local preview port.'));
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

/** Prefer familiar preview ports, then let the OS select an available loopback port. */
export async function chooseLoopbackPort(
  preferredPorts: number[],
  checkPort: (port: number) => Promise<boolean> = portIsFree,
  allocatePort: () => Promise<number> = freeLoopbackPort,
): Promise<number> {
  for (const port of preferredPorts) if (await checkPort(port)) return port;
  return allocatePort();
}

/** Fail before launching a service if another process claimed its selected port. */
export async function assertLoopbackPortAvailable(port: number, serviceName: string): Promise<void> {
  if (!(await portIsFree(port))) {
    throw new Error(`Selected ${serviceName} port ${port} is no longer available; existing listeners were left untouched.`);
  }
}
