import spawn from 'cross-spawn';

export interface CommandOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  timeout?: number;
  maxBuffer?: number;
}

/** Execute native programs, shebang scripts, and Windows batch launchers with bounded output. */
export function execCommand(
  command: string,
  args: string[],
  options: CommandOptions = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: options.env,
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    let failure: Error | undefined;
    let killTimer: NodeJS.Timeout | undefined;
    const fail = (error: Error) => {
      if (failure) return;
      failure = error;
      child.kill();
      killTimer = setTimeout(() => child.kill('SIGKILL'), 250);
      killTimer.unref();
    };
    const timer = setTimeout(
      () => fail(new Error(`Command timed out: ${command}`)),
      options.timeout ?? 10_000,
    );
    timer.unref();
    const collect = (target: Buffer[], chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > (options.maxBuffer ?? 1024 * 1024)) {
        fail(new Error(`Command output exceeded limit: ${command}`));
      } else {
        target.push(chunk);
      }
    };
    child.stdout!.on('data', (chunk: Buffer) => collect(stdout, chunk));
    child.stderr!.on('data', (chunk: Buffer) => collect(stderr, chunk));
    child.once('error', (error) => {
      failure ??= error;
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      const result = {
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      };
      if (failure) reject(failure);
      else if (code !== 0)
        reject(
          Object.assign(new Error(`Command exited with code ${code}: ${command}`), result, {
            code,
          }),
        );
      else resolve(result);
    });
  });
}
