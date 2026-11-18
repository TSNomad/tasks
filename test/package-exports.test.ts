/**
 * The public entry point, imported by package name. Runs now.
 */

import { expect, test } from 'vitest';
import * as tasks from '@tsnomad/tasks';

test('exports the tokens, taskIdOf and the exceptions', () => {
  expect(Object.keys(tasks).sort()).toEqual([
    'IdempotencyStore',
    'TaskCreateFailedException',
    'TaskDispatchFailedException',
    'TaskException',
    'TaskStrategy',
    'taskIdOf',
  ]);
  expect(tasks.TaskStrategy.name).toBe('TaskStrategy');
  expect(tasks.IdempotencyStore.name).toBe('IdempotencyStore');
});

test("the TaskStrategy token carries the name the loader resolves", async () => {
  const { TASK_STRATEGY_TOKEN } = await import('@tsnomad/loader');
  expect(tasks.TaskStrategy.name).toBe(TASK_STRATEGY_TOKEN);
});
