import type { DccOperation } from '@gamecrafter/contracts';

export function validateDccExecutable(value: string): string | undefined {
  if (!value.trim()) return 'Enter an absolute executable path.';
  const path = value.trim();
  if (!path.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(path) && !path.startsWith('\\\\')) {
    return 'The executable path must be absolute.';
  }
  return undefined;
}

export function validateProjectRelativePath(value: string): string | undefined {
  const path = value.trim().replaceAll('\\', '/');
  if (!path) return 'Enter a Project-relative path.';
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path))
    return 'Use a Project-relative path, not an absolute path.';
  if (path.split('/').includes('..') || path.includes('\0'))
    return 'The path cannot escape the Project.';
  return undefined;
}

export function dccOperationFormFields(operation: DccOperation): string[] {
  switch (operation) {
    case 'discover':
      return [];
    case 'inspect':
    case 'validate':
    case 'render-preview':
      return ['file'];
    case 'import':
      return ['file', 'format'];
    case 'export':
      return ['file', 'format', 'output'];
    case 'convert':
      return ['input', 'format', 'output'];
    case 'run-script':
      return ['script'];
  }
}

export function buildDccParams(
  operation: DccOperation,
  values: Record<string, string>,
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const field of dccOperationFormFields(operation)) {
    const value = values[field] ?? '';
    if (value.length > 0) params[field] = value;
  }
  return params;
}
