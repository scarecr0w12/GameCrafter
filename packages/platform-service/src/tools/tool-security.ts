export function requiresDestructiveSideEffects(toolName: string): boolean {
  return /execute[_-]?code|run[_-]?python|exec|eval|command[_-]?port/i.test(toolName);
}
