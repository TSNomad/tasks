/**
 * Task classes the tests share.
 */

import { TaskCreateFailedException } from '@tsnomad/tasks';
import type { Task, TaskPayload } from '@tsnomad/tasks';

export class SyncProducts implements Task {
  static getId(): string {
    return 'catalog.sync-products';
  }

  static fromPayload(payload: TaskPayload): SyncProducts {
    if (typeof payload.cursor !== 'string') throw new TaskCreateFailedException('cursor must be a string');
    return new SyncProducts(payload.cursor);
  }

  constructor(readonly cursor: string) {}

  toPayload(): TaskPayload {
    return { cursor: this.cursor };
  }
}
