/**
 * Compile-only checks for `IdempotencyStore`'s owner token, run by `npm
 * run typecheck`. Each @ts-expect-error line must stay an error. Nothing
 * here runs.
 */

import type { IdempotencyStore, IsIdempotent } from '@tsnomad/tasks';

declare const store: IdempotencyStore;
declare const task: IsIdempotent;

async function run(): Promise<void> {
  // acquire answers the run's owner token, or null when another run holds the key.
  const token: string | null = await store.acquire(task, 600);
  if (token === null) return;
  await store.markDone(task, token, 3600);
  await store.release(task, token);

  // @ts-expect-error markDone needs the owner token
  await store.markDone(task, 3600);

  // @ts-expect-error release needs the owner token
  await store.release(task);
}

void run;
