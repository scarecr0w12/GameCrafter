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
  return compileExternalSchemaWith<T>(validator, schema);
}

/** MCP v1 SDK servers can explicitly advertise draft-07; unspecified schemas use 2020-12. */
export function compileExternalJsonSchema<T>(schema: AnySchema): {
  check(value: unknown): value is T;
  assert(value: unknown): T;
} {
  const dialect = typeof schema === 'object' ? schema.$schema : undefined;
  if (
    dialect === 'http://json-schema.org/draft-07/schema#' ||
    dialect === 'https://json-schema.org/draft-07/schema#'
  ) {
    // A fresh instance keeps independently supplied $id/ref namespaces isolated.
    return compileExternalSchemaWith<T>(new Ajv({ allErrors: true, strict: false }), {
      ...(schema as object),
      $schema: 'http://json-schema.org/draft-07/schema#',
    });
  }
  return compileJsonSchema2020<T>(schema);
}

function compileExternalSchemaWith<T>(
  validator: Ajv | Ajv2020,
  schema: AnySchema,
): {
  check(value: unknown): value is T;
  assert(value: unknown): T;
} {
  addFormats(validator);
  const validate = validator.compile<T>(schema) as ValidateFunction<T>;

  return {
    check(value: unknown): value is T {
      return validate(value);
    },
    assert(value: unknown): T {
      if (!validate(value)) {
        throw new ValidationError(
          'Value does not match external JSON Schema',
          validate.errors ?? [],
        );
      }
      return value as T;
    },
  };
}
