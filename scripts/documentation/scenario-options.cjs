const scenarioNames = [
  'overview',
  'settings',
  'decisions',
  'knowledge',
  'agent',
  'backup',
  'plugin',
  'connections',
  'assets',
];
function selectScenarios(argv) {
  const index = argv.indexOf('--scenario');
  if (argv.some((arg) => arg.startsWith('--') && !['--scenario', '--help'].includes(arg)))
    throw new Error('Unknown documentation option');
  if (index >= 0 && (!argv[index + 1] || argv[index + 1].startsWith('--')))
    throw new Error('--scenario requires a comma-separated selection or all');
  const selected = index < 0 ? ['overview'] : argv[index + 1].split(',');
  if (selected.length === 1 && selected[0] === 'all') return [...scenarioNames];
  for (const name of selected)
    if (!scenarioNames.includes(name)) throw new Error(`Unknown documentation scenario: ${name}`);
  return [...new Set(selected)];
}
module.exports = { scenarioNames, selectScenarios };
