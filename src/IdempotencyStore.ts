/**
 * IsIdempotent and IdempotencyStore
 *
 * PHPNomad's `IsIdempotent` and `IdempotencyStore`. A task that
 * implements `IsIdempotent` names the logical work it does, and a strategy
 * that has an `IdempotencyStore` runs that work once per key: it skips a
 * key already done, takes a short lock so two workers cannot run one key
 * at once, marks the key done after every handler succeeded, and releases
 * the lock after a failure so a retry can run.
 *
 * A strategy calls the store in this order for each run:
 *
 * 1. `isDone`, and skips the task when it answers true.
 * 2. `acquire`, and skips the task when it answers null, since another
 *    worker holds the key. Otherwise it keeps the owner token `acquire`
 *    answered for this run.
 * 3. `isDone` again, because the key may have finished between the first
 *    check and the lock.
 * 4. The handlers.
 * 5. `markDone` when every handler succeeded, or `release` when one
 *    failed, each with the run's owner token.
 *
 * A skip in step 1 or 2 is an expected state, so the strategy logs it at
 * debug level at most.
 *
 * The strategy picks the lock TTL, and it must be longer than the longest
 * run. PHPNomad's Redis worker uses 600 seconds. Each lock has an owner
 * token, so only the run that took a lock can let it go. A run that
 * outlives its lock, while another worker has since taken the key, still
 * marks the key done when it succeeds, since its work is finished, but
 * leaves the other worker's lock in place, and its `release` changes
 * nothing. A store failure is never swallowed:
 *
 * - When `isDone` or `acquire` throws, no handler runs, and the strategy
 *   treats the run as failed, so a durable queue redelivers it.
 * - When a store call throws after a handler failed, the handler's error
 *   is the one the strategy reports, the store's error is logged beside
 *   it, and the key is not marked done.
 * - When `markDone` throws after every handler succeeded, the strategy
 *   logs it at error level and does not run the handlers again. The key
 *   stays undone, so a later duplicate can run.
 *
 * Handlers stay safe to run twice anyway, since a store outage or an
 * expired lock can still let a key through.
 *
 * Where this differs from PHPNomad: every store method returns a promise,
 * since a store reads a shared cache or database, and a lock has an owner
 * token, where PHPNomad's lock has none.
 */

import { createToken } from '@tsnomad/di-container';

export interface IsIdempotent {
  /**
   * A stable key for the same logical work, the same across retries and
   * duplicates. Build it from the task's own data, never from the time or
   * a random value.
   */
  idempotencyKey(): string;

  /** How long, in seconds, a finished key suppresses a replay. */
  idempotencyTtlSeconds(): number;
}

export interface IdempotencyStore {
  /**
   * Takes a short lock on the task's key. Answers a new owner token when
   * this caller got the lock, unique to this acquire, or null when another
   * caller holds it. A lock past its TTL counts as free.
   *
   * @throws TaskException, through the returned promise, when the store fails
   */
  acquire(task: IsIdempotent, lockTtlSeconds: number): Promise<string | null>;

  /**
   * Marks the key done, so replays are skipped for `doneTtlSeconds`, and
   * releases the lock when `ownerToken` still holds it. A lock another
   * caller holds stays in place.
   *
   * @throws TaskException, through the returned promise, when the store fails
   */
  markDone(task: IsIdempotent, ownerToken: string, doneTtlSeconds: number): Promise<void>;

  /**
   * True when the key is marked done.
   *
   * @throws TaskException, through the returned promise, when the store fails
   */
  isDone(task: IsIdempotent): Promise<boolean>;

  /**
   * Releases the lock after a failed run, when `ownerToken` still holds
   * it. A lock another caller holds stays in place, and the call changes
   * nothing.
   *
   * @throws TaskException, through the returned promise, when the store fails
   */
  release(task: IsIdempotent, ownerToken: string): Promise<void>;
}

export const IdempotencyStore = createToken<IdempotencyStore>('IdempotencyStore');
