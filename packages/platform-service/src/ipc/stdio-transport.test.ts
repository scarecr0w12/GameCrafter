import { describe, expect, it } from 'vitest';
import { JsonRpcChannel } from './jsonrpc-channel';
import { StdioTransport } from './stdio-transport';

const echoServer = `
  const readline = require('node:readline');
  const input = readline.createInterface({ input: process.stdin });
  process.stderr.write('fixture diagnostic\\n');
  input.on('line', (line) => {
    const message = JSON.parse(line);
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: message.params }) + '\\n');
  });
`;

describe('generic JSON-RPC stdio transport', () => {
  it('frames messages and captures stderr without inheriting the host environment', async () => {
    const logs: string[] = [];
    const channel = new JsonRpcChannel(
      new StdioTransport({
        command: process.execPath,
        args: ['-e', echoServer],
        env: {},
        inheritEnv: false,
        onStderr: (line) => logs.push(line),
      }),
      2_000,
    );
    await channel.start();
    expect(await channel.request('echo', { message: 'local only' })).toEqual({
      message: 'local only',
    });
    expect(logs).toContain('fixture diagnostic');
    await channel.close();
  });
});
