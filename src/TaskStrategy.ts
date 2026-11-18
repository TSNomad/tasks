/**
 * TaskStrategy
 *
 * PHPNomad's `PHPNomad\Tasks\Interfaces\TaskStrategy`: dispatch a task to
 * run now or later, and attach the handlers that run it. A strategy may
 * run a task in the same process, put it on a queue, or schedule it.
 *
 * Every strategy rebuilds the task with its class's `fromPayload` before
 * a handler sees it, so a handler gets the same thing whether the task
 * crossed a queue or not.
 *
 * Where this differs from PHPNomad: `dispatch` returns a promise and takes
 * a `Task`, where PHP takes any object and checks it at run time.
 * `attach` may return a promise, for a platform whose registration is
 * async, and the loader waits for it. Its token carries the name
 * 'TaskStrategy', which is the string @tsnomad/loader resolves, so the
 * two reach the same binding.
 */

import { createToken } from '@tsnomad/di-container';
import type { Task, TaskClass } from './Task.js';

export interface TaskStrategy {
  /**
   * Hands the task to the strategy. The promise settles when the strategy
   * has accepted the task, which for a queue means stored, not run.
   *
   * @throws TaskDispatchFailedException, through the returned promise,
   *   when the strategy cannot accept the task
   */
  dispatch(task: Task): Promise<void>;

  /**
   * Attaches a handler that runs each dispatched task of this class. A
   * rejected promise from the handler is a failed run.
   */
  attach<T extends Task>(taskClass: TaskClass<T>, handler: (task: T) => void | Promise<void>): void | Promise<void>;
}

export const TaskStrategy = createToken<TaskStrategy>('TaskStrategy');
