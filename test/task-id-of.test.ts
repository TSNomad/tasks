/**
 * Acceptance tests for taskIdOf.
 */

import { describe, expect, test } from 'vitest';
import { taskIdOf } from '@tsnomad/tasks';
import { SyncProducts } from './fixtures.js';

describe('taskIdOf', () => {
  test("reads the class's static id", () => {
    expect(taskIdOf(SyncProducts)).toBe('catalog.sync-products');
  });

  test("reads an instance's id through its constructor", () => {
    expect(taskIdOf(new SyncProducts('c1'))).toBe('catalog.sync-products');
  });

  test('reads an id a subclass inherits or overrides', () => {
    class Inherits extends SyncProducts {}
    class Overrides extends SyncProducts {
      static getId(): string {
        return 'catalog.sync-variants';
      }
    }
    expect(taskIdOf(Inherits)).toBe('catalog.sync-products');
    expect(taskIdOf(new Overrides('c'))).toBe('catalog.sync-variants');
  });

  test('throws a TypeError naming the class when it has no static getId', () => {
    class NoId {
      toPayload() {
        return {};
      }
    }
    expect(() => taskIdOf(NoId as never)).toThrow(TypeError);
    expect(() => taskIdOf(NoId as never)).toThrow(/NoId/);
    expect(() => taskIdOf(new NoId() as never)).toThrow(/NoId/);
  });

  test('throws a TypeError naming the class when the id is empty or not a string', () => {
    class EmptyId {
      static getId() {
        return '';
      }
    }
    class NumberId {
      static getId() {
        return 7;
      }
    }
    class FieldId {
      static getId = 'not a function';
    }
    for (const bad of [EmptyId, NumberId, FieldId]) {
      expect(() => taskIdOf(bad as never), bad.name).toThrow(TypeError);
      expect(() => taskIdOf(bad as never), bad.name).toThrow(new RegExp(bad.name));
    }
  });

  test('throws a TypeError for a value that is neither a class nor an object', () => {
    for (const bad of [null, undefined, 'catalog.sync-products', 3]) {
      expect(() => taskIdOf(bad as never), String(bad)).toThrow(TypeError);
    }
  });
});
