const test = require('node:test');
const assert = require('node:assert/strict');
const { selectScenarios, scenarioNames } = require('./scenario-options.cjs');
const { fixtureCompletion } = require('./fixture-completion.cjs');
const { compile, CompletionClaimSchema } = require('@gamecrafter/contracts');
test('rejects unavailable scenarios before launching a Project or service', () => {
  assert.throws(
    () => selectScenarios(['--scenario', 'unavailable']),
    /Unknown documentation scenario/,
  );
  assert.throws(() => selectScenarios(['--scenario']), /requires/);
  assert.throws(() => selectScenarios(['--unknown']), /Unknown documentation option/);
  assert.deepEqual(selectScenarios(['--scenario', 'all']), scenarioNames);
});
test('scripted coordinator completes with contract-required generated evidence', () => {
  const response = fixtureCompletion({
    messages: [
      { role: 'user', content: 'Lantern scripted request' },
      ...Array.from({ length: 3 }, () => ({ role: 'assistant', tool_calls: [{}] })),
    ],
    tools: [
      { function: { name: 'encoded_complete', description: '(Platform tool: tasks/complete)' } },
    ],
  });
  const completion = compile(CompletionClaimSchema).assert(
    JSON.parse(response.tool_calls[0].function.arguments),
  );
  assert(completion.claims.some((claim) => claim.kind === 'generated'));
  assert.equal(response.tool_calls[0].function.name, 'encoded_complete');
});
