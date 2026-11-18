/**
 * Compile-only checks, run by `npm run typecheck`. Each @ts-expect-error
 * line must stay an error. Nothing here runs.
 *
 * The first block pins what the loader's ports file asks of this package:
 * the tasks types stay assignable to the shapes @tsnomad/loader reads.
 */

import type {
  CanHandleTask as LoaderCanHandleTask,
  HasTaskHandlers as LoaderHasTaskHandlers,
  LoaderTaskStrategy,
  TaskClass as LoaderTaskClass,
  TaskHandlerDefinition as LoaderTaskHandlerDefinition,
} from '@tsnomad/loader';
import type { CanHandleTask, HasTaskHandlers, TaskClass, TaskHandlerDefinition, TaskStrategy, Task, TaskPayload } from '@tsnomad/tasks';
import { SyncProducts } from './fixtures.js';

declare const strategy: TaskStrategy;
declare const handlers: HasTaskHandlers;
declare const definition: TaskHandlerDefinition;
declare const handler: CanHandleTask<SyncProducts>;
declare const taskClass: TaskClass<SyncProducts>;

const asLoaderStrategy: LoaderTaskStrategy = strategy;
const asLoaderHandlers: LoaderHasTaskHandlers = handlers;
const asLoaderDefinition: LoaderTaskHandlerDefinition = definition;
const asLoaderHandler: LoaderCanHandleTask<SyncProducts> = handler;
const asLoaderClass: LoaderTaskClass = taskClass;

// A real task class fits TaskClass.
const fits: TaskClass<SyncProducts> = SyncProducts;

class NoFromPayload implements Task {
  static getId() {
    return 'no-from-payload';
  }
  toPayload(): TaskPayload {
    return {};
  }
}

// @ts-expect-error a task class needs a static fromPayload
const missingFromPayload: TaskClass = NoFromPayload;

// @ts-expect-error a task needs toPayload
const notATask: Task = { run() {} };

// @ts-expect-error dispatch takes a task instance, not its class
strategy.dispatch(SyncProducts);

// The handler's argument is the attached class's instance.
strategy.attach(SyncProducts, (task) => {
  const cursor: string = task.cursor;
  void cursor;
});

// @ts-expect-error the handler receives a SyncProducts, which has no `page`
strategy.attach(SyncProducts, (task) => task.page);

class Runs implements CanHandleTask<SyncProducts> {
  async handle(task: SyncProducts) {}
}
const pairs: TaskHandlerDefinition[] = [[SyncProducts, Runs], [SyncProducts, [Runs, Runs]]];

// @ts-expect-error a handler class needs handle()
const noHandle: TaskHandlerDefinition = [SyncProducts, class Nothing {}];

void [asLoaderStrategy, asLoaderHandlers, asLoaderDefinition, asLoaderHandler, asLoaderClass, fits, missingFromPayload, notATask, pairs, noHandle];
