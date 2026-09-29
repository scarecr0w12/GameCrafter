import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const input = createInterface({ input: process.stdin });
input.on('line', (line) => {
  try {
    const message = JSON.parse(line) as { id?: string | number; method?: string };
    if (process.env.MCP_FIXTURE_REQUESTS) {
      appendFileSync(process.env.MCP_FIXTURE_REQUESTS, `${message.method ?? ''}\n`);
    }
    if (message.id === undefined) return;
    const response =
      message.method === 'server/discover'
        ? { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } }
        : {
            jsonrpc: '2.0',
            id: message.id,
            result: {
              protocolVersion: '2099-01-01',
              serverInfo: { name: 'unsupported-fixture', version: '1.0.0' },
              capabilities: {},
            },
          };
    process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    process.stderr.write(
      `fixture parse error: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }
});
