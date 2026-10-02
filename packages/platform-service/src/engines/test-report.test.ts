import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readTestReport } from './test-report';
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function report(content: string) {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-report-'));
  roots.push(root);
  const file = path.join(root, 'report');
  writeFileSync(file, content);
  return file;
}
describe('engine test acceptance', () => {
  it('requires completed Unity assertions and rejects missing, zero, failed and truncated reports', () => {
    const xml =
      '<test-run result="Passed" total="1" passed="1" failed="0"><test-case result="Passed" /></test-run>';
    expect(readTestReport(report(xml), 'unity').passed).toBe(true);
    for (const invalid of [
      '',
      '<test-run result="Passed" total="0" passed="0" failed="0"></test-run>',
      xml.replace('result="Passed"', 'result="Failed"'),
      xml.replace('</test-run>', ''),
      xml.replace('total="1"', 'total="2"'),
      xml.replace('result="Passed" />', 'result="Failed" />'),
    ])
      expect(readTestReport(report(invalid), 'unity').passed).toBe(false);
    expect(readTestReport(path.join(roots[0]!, 'missing'), 'unity').passed).toBe(false);
  });
  it('requires nonempty completed Unreal tests and consistent summary counts', () => {
    const json = {
      succeeded: 1,
      succeededWithWarnings: 0,
      failed: 0,
      notRun: 0,
      inProcess: 0,
      tests: [{ state: 'Success' }],
    };
    expect(readTestReport(report(JSON.stringify(json)), 'unreal').passed).toBe(true);
    for (const change of [
      { tests: [] },
      { failed: 1 },
      { notRun: 1 },
      { inProcess: 1 },
      { succeeded: 0 },
      { tests: [{ state: 'Fail' }] },
      { succeeded: -1 },
      { failed: undefined },
    ])
      expect(readTestReport(report(JSON.stringify({ ...json, ...change })), 'unreal').passed).toBe(
        false,
      );
    expect(readTestReport(report('{'), 'unreal').passed).toBe(false);
  });
});
