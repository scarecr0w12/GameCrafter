import type { EngineFamily } from '@gamecrafter/contracts';

export const engineChoices: ReadonlyArray<{ label: string; family: EngineFamily }> = [
  { label: 'Unity', family: 'unity' },
  { label: 'Unreal Engine', family: 'unreal' },
  { label: 'Godot', family: 'godot' },
];

export function parseGenres(text: string): string[] {
  return [
    ...new Set(
      text
        .split(',')
        .map((genre) => genre.trim())
        .filter(Boolean),
    ),
  ];
}
