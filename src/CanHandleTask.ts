/**
 * CanHandleTask and HasTaskHandlers
 *
 * PHPNomad's `CanHandleTask` and `HasTaskHandlers`. The loader reads
 * `getTaskHandlers()` from an initializer, resolves each handler class
 * from the container when its task runs, and calls `handle(task)`.
 *
 * A handler may run more than once for the same logical work, because a
 * durable strategy redelivers a task whose run failed, and a caller may
 * dispatch the same work twice. Work that must happen once keys its
 * idempotency on the task's own data and dedupes at the write, in one
 * atomic step, or the task implements `IsIdempotent` for a strategy that
 * honors it.
 *
 * Where this differs from PHPNomad: `handle` may return a promise, and an
 * entry of `getTaskHandlers()` is a `[TaskClass, Handler | Handler[]]`
 * pair, because a TypeScript object key cannot be a class. That is the
 * shape @tsnomad/loader reads.
 */

import type { Task, TaskClass } from './Task.js';

export interface CanHandleTask<T extends Task = Task> {
  handle(task: T): void | Promise<void>;
}

/** A class whose instances handle one kind of task. */
export type TaskHandlerClass<T extends Task = any> = abstract new (...args: any[]) => CanHandleTask<T>;

/** One entry of `getTaskHandlers()`: a task class and its handler class or classes. */
export type TaskHandlerDefinition = readonly [
  task: TaskClass<any>,
  handlers: TaskHandlerClass | readonly TaskHandlerClass[],
];

export interface HasTaskHandlers {
  getTaskHandlers(): readonly TaskHandlerDefinition[];
}
