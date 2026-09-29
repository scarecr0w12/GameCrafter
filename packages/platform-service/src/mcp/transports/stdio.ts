import { StdioTransport as GenericStdioTransport } from '../../ipc/stdio-transport';
import type { McpTransport } from '../types';

export type { StdioTransportOptions } from '../../ipc/stdio-transport';

export class StdioTransport extends GenericStdioTransport implements McpTransport {
  readonly kind = 'stdio';
  readonly legacy = false;
}
