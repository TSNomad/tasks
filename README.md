# @tsnomad/tasks

The background task contract: `Task` and `TaskClass`, `TaskStrategy`
with `dispatch` and `attach`, handler classes (`CanHandleTask`,
`HasTaskHandlers`), `IdempotencyStore`, `taskIdOf`, and the task
exceptions.

This is the TypeScript counterpart to PHPNomad's
[tasks](https://github.com/phpnomad/tasks) package.
`@tsnomad/node-integration` ships `InProcessTaskStrategy`.

## Install

```bash
npm install @tsnomad/tasks
```

The package ships compiled JavaScript with its type declarations, so
it needs no build step of its own. It needs Node 20.19 or later.
npm installs the TS Nomad package it depends on with it.

`scripts/consumer-check.sh [<commit>]` installs the package from git at
one commit into a scratch project and imports every export, from Node
and from TypeScript.

## Where it fits

The task contracts depend only on `@tsnomad/di-container`. The loader
attaches task handlers through `TaskStrategy`, and the platform
integrations implement it, `@tsnomad/node-integration` in the process
and `@tsnomad/medusa-integration` on Medusa's event bus.

## Use

```ts
import { TaskStrategy, type Task, type TaskPayload } from '@tsnomad/tasks';

class SyncProducts implements Task {
  static getId() { return 'products.sync'; }
  static fromPayload(payload: TaskPayload) { return new SyncProducts(String(payload.cursor)); }
  constructor(readonly cursor: string) {}
  toPayload() { return { cursor: this.cursor }; }
}

const tasks = await container.get(TaskStrategy);
tasks.attach(SyncProducts, async (task) => { /* task.cursor */ });
await tasks.dispatch(new SyncProducts('start'));
```

A task names itself with a static `getId()`, as an event does, and
travels as the plain object `toPayload()` answers. A strategy rebuilds
it with the class's static `fromPayload()`. `taskIdOf(taskOrClass)` reads
the id and throws a `TypeError` naming the class when it is missing,
empty or not a string.

The `TaskStrategy` token carries the name the loader resolves for task
handlers, so `HasTaskHandlers` initializers load through
`@tsnomad/loader`.

## Where this differs from PHPNomad

- `dispatch`, `handle` and the store's methods return promises.
- `Task` covers the instance side and `TaskClass` the static side, with
  `getId()` and `fromPayload()`. PHP declares both on one interface, and
  a TypeScript interface cannot declare static methods.
- An entry of `getTaskHandlers()` is a `[TaskClass, Handler | Handler[]]`
  pair, because a TypeScript object key cannot be a class. That is the
  shape `@tsnomad/loader` reads.
- `taskIdOf` is new. It reads the static id from a task or its class.
- `IsIdempotent` shares a file with `IdempotencyStore`.
- `IdempotencyStore`'s comment sets the order a strategy calls it in.
  It checks `isDone` again after `acquire`, releases the lock only after
  a failure, reports a handler's error ahead of a store error, and logs a
  `markDone` failure after every handler succeeded instead of throwing
  it. PHPNomad's Redis and WordPress workers check once, release the lock
  in `finally` after a success too, and let a store error propagate.
- `IdempotencyStore.acquire` answers an owner token, or null when another
  run holds the key, and `markDone` and `release` take that token. A call
  whose token no longer holds the lock changes nothing. PHPNomad's lock
  has no owner, so a run that outlived its lock there can release or
  mark a key another run has taken since. TypeScript does not force
  this difference. It closes that gap.

A durable `TaskStrategy` owns retries, dead letters, telling a permanent
failure from a passing one, and any hook that settles a task's state
after its last failure. This package leaves those to it, as PHPNomad's
does.

## Extracted 2026-11-17

This package moved into its own repository on 2026-11-17, at version
0.1.0, with its tests.

## License

Copyright (C) 2026 TSNomad.

This package is free software, released under the GNU General Public
License, version 3 or any later version (GPL-3.0-or-later). It comes
with no warranty. The full text is in [LICENSE](LICENSE).
