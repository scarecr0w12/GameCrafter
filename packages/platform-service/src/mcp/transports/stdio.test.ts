import { describe, expect, it } from 'vitest';
import { JsonRpcChannel } from '../../ipc/jsonrpc-channel';
import { StdioTransport } from './stdio';

const echoServer = `
  const readline = require('node:readline');
  const input = readline.createInterface({ input: process.stdin });
  process.stderr.write('fixture diagnostic\\n');
  input.on('line', (line) => {
    const message = JSON.parse(line);
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: message.params }) + '\\n');
  });
`;

describe('MCP stdio transport', () => {
  it('frames JSON-RPC messages over newline-delimited stdio and captures stderr', async () => {
    const logs: string[] = [];
    const channel = new JsonRpcChannel(
      new StdioTransport({
        command: process.execPath,
        args: ['-e', echoServer],
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
