/**
 * Acceptance tests for the task exceptions.
 */

import { describe, expect, test } from 'vitest';
import { TaskCreateFailedException, TaskDispatchFailedException, TaskException } from '@tsnomad/tasks';

describe('task exceptions', () => {
  test('each carries its message, its cause and its own class name', () => {
    const cause = new Error('underlying');
    for (const Kind of [TaskException, TaskDispatchFailedException, TaskCreateFailedException]) {
      const error = new Kind('could not run', { cause });
      expect(error.message, Kind.name).toBe('could not run');
      expect(error.cause, Kind.name).toBe(cause);
      expect(error.name, Kind.name).toBe(Kind.name);
    }
  });

  test('the two specific exceptions are TaskExceptions and Errors, and not each other', () => {
    const dispatch = new TaskDispatchFailedException('d');
    const create = new TaskCreateFailedException('c');

    expect(dispatch).toBeInstanceOf(TaskException);
    expect(dispatch).toBeInstanceOf(Error);
    expect(create).toBeInstanceOf(TaskException);
    expect(dispatch).not.toBeInstanceOf(TaskCreateFailedException);
    expect(create).not.toBeInstanceOf(TaskDispatchFailedException);
  });

  test('has no cause when none is given', () => {
    expect('cause' in new TaskException('m')).toBe(false);
    expect('cause' in new TaskCreateFailedException('m')).toBe(false);
  });
});
