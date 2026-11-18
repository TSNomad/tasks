/**
 * Task
 *
 * PHPNomad's `PHPNomad\Tasks\Interfaces\Task`: a unit of work that a task
 * strategy can store and rebuild. Its id is static, so every task of one
 * class shares it, and `fromPayload` rebuilds an instance from what
 * `toPayload` answered, after a trip through JSON.
 *
 * ```ts
 * class SyncProducts implements Task {
 *   static getId(): string { return 'catalog.sync-products'; }
 *   static fromPayload(payload: Record<string, unknown>): SyncProducts {
 *     if (typeof payload.cursor !== 'string') throw new TaskCreateFailedException('cursor must be a string');
 *     return new SyncProducts(payload.cursor);
 *   }
 *   constructor(readonly cursor: string) {}
 *   toPayload() { return { cursor: this.cursor }; }
 * }
 * ```
 *
 * Where this differs from PHPNomad: a TypeScript interface cannot declare
 * a static member, so `Task` holds the instance side and `TaskClass`
 * holds the static side, as `Event` and `EventClass` do in @tsnomad/event.
 */

export type TaskPayload = Record<string, unknown>;

export interface Task {
  /**
   * A plain object that survives `JSON.stringify` and `JSON.parse`
   * unchanged, so a strategy can store it and rebuild the task with
   * `fromPayload`.
   */
  toPayload(): TaskPayload;
}

/**
 * The static side of a task class, PHP's `Task::class`.
 *
 * `getId()` names the task. `fromPayload` rebuilds an instance, and throws
 * `TaskCreateFailedException` when the payload cannot make one.
 */
export type TaskClass<T extends Task = Task> = (abstract new (...args: any[]) => T) & {
  getId(): string;
  fromPayload(payload: TaskPayload): T;
};
