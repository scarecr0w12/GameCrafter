import { homedir } from 'node:os';
import path from 'node:path';
import type { SettingDefinition, SettingGroup } from '@gamecrafter/contracts';

export interface BuiltinSettings {
  groups: SettingGroup[];
  definitions: SettingDefinition[];
}

export function createBuiltinSettings(): BuiltinSettings {
  const groups: SettingGroup[] = [
    {
      id: 'general',
      title: 'General & background behaviour',
      description: 'General settings for the Control Room and background service.',
      order: 0,
    },
    {
      id: 'projects',
      title: 'Projects, genres & modules',
      description: 'Project creation and organization defaults.',
      order: 1,
    },
    {
      id: 'agents',
      title: 'Agents, swarms & skills',
      description: 'Agent delegation and skill behavior.',
      order: 2,
    },
    {
      id: 'models',
      title: 'Model providers & routing',
      description: 'Model selection and task budgets.',
      order: 3,
    },
    {
      id: 'connections',
      title: 'Engine, asset & tool connections',
      description: 'Connections to game engines, asset services, and tools.',
      order: 4,
    },
    {
      id: 'access',
      title: 'Access & security',
      description: 'Access controls and security policies.',
      order: 5,
    },
    {
      id: 'board',
      title: 'Discussion board',
      description: 'Board maintenance and discussion behavior.',
      order: 6,
    },
    {
      id: 'plugins',
      title: 'Plugins & updates',
      description: 'Platform plugin installation and update behavior.',
      order: 7,
    },
    {
      id: 'storage',
      title: 'Storage, search & backup',
      description: 'Search indexes, backup, and storage behavior.',
      order: 8,
    },
    {
      id: 'logs',
      title: 'Logs & audit',
      description: 'Logging and audit retention.',
      order: 9,
    },
  ];
  const definitions: SettingDefinition[] = [
    setting(
      'window.closeBehavior',
      'Window close behavior',
      'Choose whether closing the window leaves work running or stops after checkpointing.',
      'general',
      { type: 'string', enum: ['continue', 'stop-and-checkpoint'] },
      'continue',
      ['platform'],
    ),
    setting(
      'projects.defaultParentDirectory',
      'Default Project parent directory',
      'Default directory used when creating Projects.',
      'projects',
      { type: 'string' },
      path.join(homedir(), 'GameCrafterProjects'),
      ['platform'],
    ),
    setting(
      'agents.maxSpawnDepth',
      'Maximum agent spawn depth',
      'Maximum number of nested agent delegation levels.',
      'agents',
      { type: 'integer', minimum: 1, maximum: 16 },
      4,
      ['platform', 'project'],
    ),
    setting(
      'agents.maxConcurrentPerProject',
      'Maximum concurrent agents per Project',
      'Maximum number of agents that can work concurrently on one Project.',
      'agents',
      { type: 'integer', minimum: 1, maximum: 64 },
      8,
      ['platform', 'project'],
    ),
    setting(
      'access.mode',
      'Access mode',
      'Controls how tool operations are authorized.',
      'access',
      { type: 'string', enum: ['full', 'restricted', 'ask-always'] },
      'ask-always',
      ['platform', 'project', 'session'],
    ),
    setting(
      'models.autoRouting.quality',
      'Automatic routing quality policy',
      'Select the quality, balance, or cost priority for automatic model routing.',
      'models',
      { type: 'string', enum: ['quality-first', 'balanced', 'cost-first'] },
      'quality-first',
      ['platform', 'project', 'session'],
    ),
    setting(
      'models.budget.maxCostPerTaskUsd',
      'Maximum cost per task (USD)',
      'Maximum model spend allowed for a single task.',
      'models',
      { type: 'number', minimum: 0 },
      5,
      ['platform', 'project', 'session'],
    ),
    setting(
      'board.maintenance.auditIntervalMinutes',
      'Board audit interval (minutes)',
      'How often the discussion board is audited for consistency.',
      'board',
      { type: 'integer', minimum: 1 },
      60,
      ['platform', 'project'],
    ),
    setting(
      'board.maintenance.allowPermanentDeletion',
      'Allow permanent board deletion',
      'Allow permanently deleting board content instead of archiving it.',
      'board',
      { type: 'boolean' },
      false,
      ['platform', 'project'],
    ),
    setting(
      'search.vector.enabled',
      'Enable semantic vector search',
      'Enable the configured vector-store adapter for semantic retrieval.',
      'storage',
      { type: 'boolean' },
      false,
      ['platform', 'project'],
    ),
    setting(
      'backup.encryption.enabled',
      'Encrypt backups',
      'Encrypted by default; disabling is not recommended.',
      'storage',
      { type: 'boolean' },
      true,
      ['platform', 'project'],
    ),
    setting(
      'logs.retentionDays',
      'Log retention (days)',
      'Number of days to retain service logs.',
      'logs',
      { type: 'integer', minimum: 1 },
      30,
      ['platform'],
    ),
  ];

  return { groups, definitions };
}

function setting(
  key: string,
  title: string,
  description: string,
  group: string,
  schema: Record<string, unknown>,
  defaultValue: unknown,
  scopes: SettingDefinition['scopes'],
): SettingDefinition {
  return {
    key,
    title,
    description,
    group,
    schema,
    default: defaultValue,
    scopes,
    source: 'builtin',
  };
}
