/**
 * taskIdOf
 *
 * The one place that reads a task's id, from a task class or from an
 * instance through its constructor, as `eventIdOf` does for events.
 */

import type { Task, TaskClass } from './Task.js';

/**
 * Answers the static `getId()` of the class, or of the instance's
 * constructor.
 *
 * @throws TypeError naming the class, or describing the value, when there
 *   is no static `getId` function, or it answers anything but a non-empty
 *   string
 */
export function taskIdOf(task: Task | TaskClass): string {
  const owner = ownerOf(task);
  if (owner === undefined) throw new TypeError(`taskIdOf: ${describe(task)} is not a task or a task class`);
  const name = owner.name || 'an anonymous class';
  if (typeof owner.getId !== 'function') throw new TypeError(`taskIdOf: ${name} has no static getId()`);
  const id: unknown = owner.getId();
  if (typeof id !== 'string' || id === '') {
    throw new TypeError(`taskIdOf: ${name}.getId() must answer a non-empty string`);
  }
  return id;
}

/** The class that should carry the static id. */
type IdOwner = { readonly name: string; readonly getId?: unknown };

/** The class itself, or an object's constructor, or undefined for anything else. */
function ownerOf(task: unknown): IdOwner | undefined {
  if (typeof task === 'function') return task as IdOwner;
  if (typeof task === 'object' && task !== null) {
    const ctor: unknown = (task as object).constructor;
    if (typeof ctor === 'function') return ctor as IdOwner;
  }
  return undefined;
}

/** A short description of a value that is not a task, without its contents. */
function describe(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'object') return 'an object with no constructor';
  return `a value of type ${typeof value}`;
}
