import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile('app/manage/dialog-change-guard.ts', 'utf8');
const js = ts.transpileModule(source, {compilerOptions: { module: ts.ModuleKind.ES2022 }}).outputText;
const { shouldConfirmDialogClose } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('edited draft prompts for each user dismissal path', () => {
  for (const reason of ['close-press', 'outside-press', 'escape-key', 'focus-out', 'trigger-press']) {
    assert.equal(shouldConfirmDialogClose(true, false, reason), true, reason);
  }
});
test('untouched dialogs close without a false unsaved prompt', () => {
  for (const reason of ['close-press', 'outside-press', 'escape-key']) {
    assert.equal(shouldConfirmDialogClose(false, false, reason), false);
  }
});
test('successful programmatic save-close never asks to discard already saved work', () => {
  assert.equal(shouldConfirmDialogClose(true, false, 'imperative-action'), false);
  assert.equal(shouldConfirmDialogClose(true, false, 'none'), false);
});
test('opening a popup does not trigger a discard prompt', () => {
  assert.equal(shouldConfirmDialogClose(true, true, 'trigger-press'), false);
});

test('inline save clears only its own group, retaining other unsaved fields', async () => {
  const { updateDraftScopes } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
  let scopes = updateDraftScopes([], 'visitor-profile', false);
  scopes = updateDraftScopes(scopes, 'visitor-phone', false);
  scopes = updateDraftScopes(scopes, 'visitor-phone', true);
  assert.deepEqual(scopes, ['visitor-profile']);
  assert.equal(shouldConfirmDialogClose(scopes.length > 0, false, 'close-press'), true);
  scopes = updateDraftScopes(scopes, 'visitor-profile', true);
  assert.equal(shouldConfirmDialogClose(scopes.length > 0, false, 'close-press'), false);
});
