import { existsSync } from 'node:fs';
import path from 'node:path';

export interface HandlerDescriptor {
  module: string;
  export?: string;
}

export class HandlerRegistry {
  private readonly handlers = new Map<string, HandlerDescriptor>();

  register(kind: string, handler: HandlerDescriptor): void {
    if (!kind) throw new TypeError('Task handler kind must not be empty');
    if (!path.isAbsolute(handler.module)) {
      throw new TypeError(`Task handler module must be an absolute path: ${handler.module}`);
    }
    if (this.handlers.has(kind)) throw new Error(`Task handler already registered: ${kind}`);
    this.handlers.set(kind, { ...handler });
  }

  get(kind: string): HandlerDescriptor | undefined {
    const handler = this.handlers.get(kind);
    return handler ? { ...handler } : undefined;
  }

  has(kind: string): boolean {
    return this.handlers.has(kind);
  }

  kinds(): string[] {
    return [...this.handlers.keys()].sort();
  }
}

export function registerBuiltinHandlers(
  registry: HandlerRegistry,
  module = resolveBuiltinHandlerModule(),
): void {
  for (const [kind, handlerExport] of Object.entries({
    'noop.echo': 'noopEcho',
    'noop.sleep': 'noopSleep',
    'noop.fail': 'noopFail',
    'noop.ask': 'noopAsk',
    'noop.checkpointed': 'noopCheckpointed',
  })) {
    registry.register(kind, { module, export: handlerExport });
  }
}

function resolveBuiltinHandlerModule(): string {
  const local = path.join(__dirname, 'builtin-handlers.js');
  return existsSync(local)
    ? local
    : path.resolve(__dirname, '..', '..', 'lib', 'workers', 'builtin-handlers.js');
}
