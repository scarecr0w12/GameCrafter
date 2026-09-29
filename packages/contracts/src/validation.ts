import Ajv, { type AnySchema, type ErrorObject, type ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export class ValidationError extends Error {
  readonly errors: string[];

  constructor(message: string, errors: ErrorObject[] = []) {
    const details = errors.map((error) => {
      const path = error.instancePath || '/';
      return `${path} ${error.message ?? 'is invalid'}`;
    });
    super(details.length > 0 ? `${message}: ${details.join('; ')}` : message);
    this.name = 'ValidationError';
    this.errors = details;
  }
}

export function compile<T>(schema: AnySchema): {
  check(value: unknown): value is T;
  assert(value: unknown): T;
} {
  const validate = ajv.compile<T>(schema) as ValidateFunction<T>;

  return {
    check(value: unknown): value is T {
      return validate(value);
    },
    assert(value: unknown): T {
      if (!validate(value)) {
        throw new ValidationError('Value does not match schema', validate.errors ?? []);
      }
      return value as T;
    },
  };
}

export function compileJsonSchema2020<T>(schema: AnySchema): {
  check(value: unknown): value is T;
  assert(value: unknown): T;
} {
  const validator = new Ajv2020({ allErrors: true, strict: false });
  addFormats(validator);
  const validate = validator.compile<T>(schema) as ValidateFunction<T>;

  return {
    check(value: unknown): value is T {
      return validate(value);
    },
    assert(value: unknown): T {
      if (!validate(value)) {
        throw new ValidationError(
          'Value does not match JSON Schema 2020-12',
          validate.errors ?? [],
        );
      }
      return value as T;
    },
  };
}
