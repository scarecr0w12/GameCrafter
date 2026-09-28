export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function log(level: LogLevel, msg: string, fields: Record<string, unknown> = {}): void {
  process.stderr.write(
    `${JSON.stringify({ level, time: new Date().toISOString(), msg, ...fields })}\n`,
  );
}
