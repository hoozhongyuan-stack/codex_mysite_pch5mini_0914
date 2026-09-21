/** Changes alone do not cause prompts: only a user dismissal can discard a draft. */
export function shouldConfirmDialogClose(dirty: boolean, nextOpen: boolean, reason: string): boolean {
  return dirty && !nextOpen && ['close-press', 'outside-press', 'escape-key', 'focus-out', 'trigger-press'].includes(reason);
}

/** Inline save may persist only one group; never clear another group's pending edits. */
export function updateDraftScopes(scopes: string[], scope: string, saved: boolean): string[] {
  if (saved) return scopes.filter(value => value !== scope);
  return scopes.includes(scope) ? scopes : [...scopes, scope];
}
