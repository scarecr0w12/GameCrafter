#!/usr/bin/env node
// Acceptance-only adapter for an explicitly selected Unreal fixture; not a bundled product connector.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const execute = promisify(execFile);
assert.equal(process.platform, 'win32', 'CodeFizz acceptance uses native Windows Node.');
const projectFile = fs.realpathSync(path.resolve(process.argv[2] || ''));
assert.equal(path.extname(projectFile).toLowerCase(), '.uproject');
const game = path.dirname(projectFile);
const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local');
const cli = process.env.GC_ACCEPTANCE_CFA || path.join(local, 'CodeFizz/bin/cfa.exe');
const env = {
  ...process.env,
  LOCALAPPDATA: local,
  USERPROFILE: os.homedir(),
  CFA_SESSION: 'gamecrafter-acceptance',
};
const normalize = (value) => path.resolve(value).toLowerCase();
async function command(args) {
  const { stdout } = await execute(cli, args, {
    cwd: game,
    env,
    windowsHide: true,
    timeout: 30000,
    maxBuffer: 2 * 1024 * 1024,
  });
  const response = JSON.parse(stdout);
  if (response.status !== 'success') throw new Error(response.error || 'CodeFizz command failed');
  return response.result;
}
async function identity() {
  const bridge = JSON.parse(
    fs.readFileSync(path.join(game, 'Saved/CodeFizzEditorAgent/bridge.json'), 'utf8'),
  );
  assert.ok(
    Number.isInteger(bridge.port) && bridge.port > 0 && bridge.port < 65536,
    'Invalid editor bridge port',
  );
  const health = await command([
    'health_check',
    '--port',
    String(bridge.port),
    '--project',
    path.basename(projectFile, '.uproject'),
  ]);
  assert.equal(health.editor?.connected, true, 'Selected editor is not connected');
  assert.equal(
    normalize(health.editor.project_path),
    normalize(projectFile),
    'Live editor belongs to another Project',
  );
  return { port: bridge.port, projectPath: game, engineVersion: health.editor.engine_version };
}
const server = new McpServer({ name: 'gamecrafter-codefizz-acceptance', version: '0.1.0' });
server.registerTool(
  'project_identity',
  {
    description: 'Read the selected running Unreal editor identity through CodeFizz CLI health.',
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    try {
      const { projectPath, engineVersion } = await identity();
      return { content: [{ type: 'text', text: JSON.stringify({ projectPath, engineVersion }) }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
  },
);
server.registerTool(
  'screenshot',
  {
    description: 'Capture the verified fixture viewport; writes a bounded PNG inside that fixture.',
    inputSchema: {},
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async () => {
    let destination;
    try {
      const selected = await identity();
      const directory = path.join(game, 'Saved/GameCrafterAcceptanceCaptures');
      fs.mkdirSync(directory, { recursive: true });
      // Reject a redirected capture directory before asking the editor to write.
      const relative = path.relative(fs.realpathSync(game), fs.realpathSync(directory));
      assert.ok(
        !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`),
      );
      destination = path.join(directory, `${require('node:crypto').randomUUID()}.png`);
      const capture = await command([
        'take_screenshot',
        '--port',
        String(selected.port),
        '--project',
        path.basename(projectFile, '.uproject'),
        '--mode',
        'viewport',
        '--file-path',
        destination,
      ]);
      assert.equal(capture?.success, true);
      const size = fs.statSync(destination).size;
      assert.ok(size >= 8 && size <= 8 * 1024 * 1024, 'Screenshot is empty or oversized');
      const image = fs.readFileSync(destination);
      assert.ok(
        image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
        'Invalid PNG',
      );
      return {
        content: [{ type: 'image', mimeType: 'image/png', data: image.toString('base64') }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    } finally {
      if (destination) fs.rmSync(destination, { force: true });
    }
  },
);
server.connect(new StdioServerTransport()).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
