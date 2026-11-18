/**
 * Task exceptions
 *
 * PHPNomad's `TaskException`, `TaskDispatchFailedException` and
 * `TaskCreateFailedException`. Each takes a message and an optional
 * `cause`, and its `name` is its class name.
 */

/** The base of every task error. */
export class TaskException extends Error {
  constructor(message: string, options: { cause?: unknown } = {}) {
    // Pass a cause only when the caller gave one, so `'cause' in error`
    // stays false otherwise, as for a plain Error.
    super(message, 'cause' in options ? { cause: options.cause } : {});
    this.name = new.target.name;
  }
}

/** A strategy could not accept a task. */
export class TaskDispatchFailedException extends TaskException {}

/** A task class could not build an instance from a payload. */
export class TaskCreateFailedException extends TaskException {}
