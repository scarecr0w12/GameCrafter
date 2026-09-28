import { describe, expect, it } from 'vitest';
import { RpcMethods } from './protocol';
import { compile } from '../validation';

describe('RPC contracts', () => {
  it('compiles every method parameter and result schema', () => {
    for (const method of Object.values(RpcMethods)) {
      expect(() => compile(method.params)).not.toThrow();
      expect(() => compile(method.result)).not.toThrow();
    }
  });
});
