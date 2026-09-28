import { describe, expect, it } from 'vitest';
import { redact } from './redaction';

describe('redact', () => {
  it('deep-clones JSON and redacts sensitive keys and token-shaped values', () => {
    const input = {
      token: 'session-secret',
      nested: [{ password: 'hunter2', label: 'safe value' }],
      value: 'sk-abcdefghijklmnopqrstuvwxyz',
      private: 'a'.repeat(40),
      unchanged: ['one', 'two'],
    };

    const output = redact(input);

    expect(output).toEqual({
      token: '[REDACTED]',
      nested: [{ password: '[REDACTED]', label: 'safe value' }],
      value: '[REDACTED]',
      private: '[REDACTED]',
      unchanged: ['one', 'two'],
    });
    expect(output).not.toBe(input);
    expect(input.token).toBe('session-secret');
  });

  it('applies additional key patterns recursively', () => {
    expect(redact({ nested: { projectId: 'hidden' } }, [/projectId/i])).toEqual({
      nested: { projectId: '[REDACTED]' },
    });
  });
});
