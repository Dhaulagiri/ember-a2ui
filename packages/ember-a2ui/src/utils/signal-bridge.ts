import { tracked } from '@glimmer/tracking';
import { registerDestructor } from '@ember/destroyable';
import { effect, getValue, peekValue, type Signal } from '@a2ui/web_core';

/**
 * Bridges a `@a2ui/web_core` signal (preact signals) into Glimmer
 * autotracking.
 *
 * The cell is seeded with `peekValue(signal)` and then follows the signal: an
 * effect re-reads the signal on every change and writes the value into a
 * `@tracked` slot, so templates and getters that read `cell.value` re-render.
 *
 * The effect is disposed when `owner` is destroyed.
 *
 * Backtracking safety: signal effects fire synchronously inside whatever code
 * wrote the signal (`processMessages`, `binding.set`). When that happens during
 * a render that already consumed the cell, Ember would assert. Such a write is
 * deferred to a microtask instead; the newest value always wins.
 */
export class SignalCell<T> {
  @tracked private _value: T;

  #stop: (() => void) | undefined;
  #pending = false;
  #latest: T;

  constructor(owner: object, signal: Signal<T>) {
    this._value = this.#latest = peekValue(signal);

    let first = true;
    this.#stop = effect(() => {
      const next = getValue(signal);
      if (first) {
        // Initial run only subscribes; the cell is already seeded.
        first = false;
        return;
      }
      this.#latest = next;
      this.#write();
    });

    registerDestructor(owner, () => this.dispose());
  }

  /** The current signal value; autotracked. */
  get value(): T {
    return this._value;
  }

  /** Stops following the signal. Idempotent. */
  dispose(): void {
    this.#stop?.();
    this.#stop = undefined;
  }

  #write(): void {
    try {
      this._value = this.#latest;
    } catch {
      // Backtracking assertion (write after read in the same render):
      // retry once rendering is over.
      if (this.#pending) return;
      this.#pending = true;
      queueMicrotask(() => {
        this.#pending = false;
        if (this.#stop) this._value = this.#latest;
      });
    }
  }
}
