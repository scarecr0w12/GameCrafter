// Runnable stdio MCP fixture. stdout is reserved for protocol messages.
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const server = new McpServer({ name: 'lantern-documentation-fixture', version: '1.0.0' });
server.registerTool(
  'lantern_rule',
  {
    description: 'Read a fixed synthetic tutorial rule; no filesystem or engine access.',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false },
  },
  async () => ({
    content: [
      {
        type: 'text',
        text: 'Synthetic Lantern MCP fixture: R resets player position and collection.',
      },
    ],
  }),
);
server.connect(new StdioServerTransport()).catch((error) => {
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
});
