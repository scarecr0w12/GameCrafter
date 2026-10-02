import net from 'node:net';
import { describe, expect, it } from 'vitest';
import { createDockerRuntime } from './docker-runtime';

async function unusedPort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as net.AddressInfo;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

describe('Docker HTTP startup', () => {
  it('stops its detached container when the HTTP readiness deadline expires', async () => {
    const commands: string[][] = [];
    await expect(
      createDockerRuntime({
        connectionId: 'owned-startup',
        connectionName: 'Startup failure',
        docker: {
          image: 'fixture/mcp',
          command: [],
          transport: 'streamable-http',
          mounts: [],
          env: {},
          network: 'bridge',
          pullPolicy: 'never',
          stopOnDisconnect: false,
          port: await unusedPort(),
        },
        env: {},
        connectTimeoutMs: 0,
        requestTimeoutMs: 100,
        execFileAsync: async (_command, args) => {
          commands.push(args);
          return { stdout: args[0] === 'run' ? 'owned-container-id\n' : '', stderr: '' };
        },
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining('did not listen') });
    expect(commands).toContainEqual(['stop', 'owned-container-id']);
    expect(commands.find((args) => args[0] === 'run')).toContain('-p');
  });
});
