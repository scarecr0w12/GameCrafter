import { createHash } from 'node:crypto';
import type { ChatRequest } from '@gamecrafter/contracts';

/** Provider names have a smaller alphabet than broker/MCP tool IDs. */
export function providerToolNames(request: ChatRequest): {
  request: ChatRequest;
  decode: (name: string) => string;
} {
  const originals = new Set<string>();
  for (const tool of request.tools ?? []) originals.add(tool.name);
  for (const message of request.messages) {
    if (message.name) originals.add(message.name);
    for (const call of message.toolCalls ?? []) originals.add(call.name);
  }
  const encoded = new Map<string, string>();
  const decoded = new Map<string, string>();
  const used = new Set(originals);
  for (const name of [...originals].sort()) {
    if (/^[a-zA-Z0-9_-]{1,64}$/.test(name)) {
      encoded.set(name, name);
      continue;
    }
    let nonce = 0;
    let alias: string;
    do {
      const digest = createHash('sha256').update(`${name}:${nonce++}`).digest('hex').slice(0, 20);
      alias = `gc_${name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 36)}_${digest}`;
    } while (used.has(alias));
    used.add(alias);
    encoded.set(name, alias);
    decoded.set(alias, name);
  }
  const encode = (name: string) => encoded.get(name) ?? name;
  return {
    request: {
      ...request,
      ...(request.tools
        ? {
            tools: request.tools.map((tool) => ({
              ...tool,
              name: encode(tool.name),
              description:
                encode(tool.name) === tool.name
                  ? tool.description
                  : `${tool.description} (Platform tool: ${tool.name})`,
            })),
          }
        : {}),
      messages: request.messages.map((message) => ({
        ...message,
        ...(message.name ? { name: encode(message.name) } : {}),
        ...(message.toolCalls
          ? { toolCalls: message.toolCalls.map((call) => ({ ...call, name: encode(call.name) })) }
          : {}),
      })),
    },
    decode: (name) => decoded.get(name) ?? name,
  };
}
