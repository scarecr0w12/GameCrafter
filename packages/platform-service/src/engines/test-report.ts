import { readFileSync, statSync } from 'node:fs';

export interface TestReportResult {
  passed: boolean;
  detail: string;
}

/** Accept completed engine results, never a process exit alone. */
export function readTestReport(file: string, format: 'unity' | 'unreal'): TestReportResult {
  try {
    if (statSync(file).size > 8 * 1024 * 1024) throw new Error('Report exceeds 8 MiB.');
    const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    if (format === 'unity') {
      const root = text.match(/<test-run\b([^>]*)>/);
      if (!root || !text.includes('</test-run>'))
        throw new Error('Missing completed NUnit test-run.');
      const attributes = Object.fromEntries(
        [...root[1]!.matchAll(/([\w-]+)="([^"]*)"/g)].map((entry) => [entry[1], entry[2]]),
      );
      const passed = count(attributes.passed);
      const failed = count(attributes.failed);
      const total = count(attributes.total);
      const cases = [...text.matchAll(/<test-case\b[^>]*\bresult="([^"]+)"/g)];
      const accepted =
        attributes.result === 'Passed' &&
        passed > 0 &&
        failed === 0 &&
        cases.length === total &&
        cases.filter((entry) => entry[1] === 'Passed').length === passed &&
        cases.every((entry) => ['Passed', 'Skipped', 'Inconclusive'].includes(entry[1]!));
      return {
        passed: accepted,
        detail: `Unity results: ${passed} passed, ${failed} failed, ${total} total; result ${attributes.result}.`,
      };
    }
    const report = JSON.parse(text) as Record<string, unknown>;
    const succeeded = count(report.succeeded) + count(report.succeededWithWarnings);
    const failed = count(report.failed);
    const pending = count(report.notRun) + count(report.inProcess);
    const tests = report.tests;
    const accepted =
      succeeded > 0 &&
      failed === 0 &&
      pending === 0 &&
      Array.isArray(tests) &&
      tests.length === succeeded &&
      tests.every(
        (test: unknown) =>
          typeof test === 'object' &&
          test !== null &&
          (test as Record<string, unknown>).state === 'Success',
      );
    return {
      passed: accepted,
      detail: `Unreal results: ${succeeded} succeeded, ${failed} failed, ${pending} incomplete.`,
    };
  } catch (error) {
    return {
      passed: false,
      detail: `Test report unavailable or invalid: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function count(value: unknown): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '')
    throw new Error('Missing result count.');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('Invalid result count.');
  return number;
}
