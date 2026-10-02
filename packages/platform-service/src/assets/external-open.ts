import path from 'node:path';
import spawn from 'cross-spawn';
import { RpcError, RpcErrorCode } from '@gamecrafter/contracts';
import { requireExistingProjectPath } from './path-utils';

export async function openInAuthoringTool(
  projectPath: string,
  relativePath: string,
  configuredCommand: string,
): Promise<{ launched: boolean; command: string }> {
  const absolutePath = requireExistingProjectPath(projectPath, relativePath);
  const parsed = configuredCommand.trim() ? parseCommand(configuredCommand) : defaultCommand();
  if (!parsed.executable) {
    throw new RpcError('The configured authoring command is empty.', RpcErrorCode.InvalidParams);
  }
  const args = [...parsed.args, absolutePath];
  const displayCommand = `${path.basename(parsed.executable)} (${args.length} args)`;
  return new Promise((resolve) => {
    let spawned = false;
    let child;
    try {
      const options = {
        detached: true,
        stdio: 'ignore' as const,
        shell: false,
        windowsHide: true,
      };
      child = spawn(parsed.executable, args, options);
    } catch {
      resolve({ launched: false, command: displayCommand });
      return;
    }
    child.once('error', () => {
      if (!spawned) resolve({ launched: false, command: displayCommand });
    });
    child.once('spawn', () => {
      spawned = true;
      child.unref();
      resolve({ launched: true, command: displayCommand });
    });
  });
}

function defaultCommand(): { executable: string; args: string[] } {
  if (process.platform === 'win32') return { executable: 'cmd', args: ['/c', 'start', ''] };
  return { executable: process.platform === 'darwin' ? 'open' : 'xdg-open', args: [] };
}

function parseCommand(command: string): { executable: string; args: string[] } {
  const tokens = command.match(/(?:"([^"]*)"|'([^']*)'|([^\s]+))/g) ?? [];
  const values = tokens.map((token) => token.replace(/^(?:"|')|(?:"|')$/g, ''));
  return { executable: values[0] ?? '', args: values.slice(1) };
}
