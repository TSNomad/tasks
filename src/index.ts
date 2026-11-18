/**
 * @tsnomad/tasks
 *
 * Public entry point. The task, task strategy, handler and idempotency
 * contracts, `taskIdOf`, and the task exceptions.
 */

export type { Task, TaskClass, TaskPayload } from './Task.js';
export { taskIdOf } from './taskIdOf.js';
export type { CanHandleTask, TaskHandlerClass, TaskHandlerDefinition, HasTaskHandlers } from './CanHandleTask.js';
export { TaskStrategy } from './TaskStrategy.js';
export type { IsIdempotent } from './IdempotencyStore.js';
export { IdempotencyStore } from './IdempotencyStore.js';
export { TaskException, TaskDispatchFailedException, TaskCreateFailedException } from './exceptions.js';
