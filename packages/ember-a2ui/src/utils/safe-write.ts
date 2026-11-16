/**
 * Runs `write`; if Ember rejects it as a backtracking write (the tracked slot
 * was already read in the current render), retries in a microtask once
 * rendering is over.
 */
export function writeOutsideRender(write: () => void): void {
  try {
    write();
  } catch {
    queueMicrotask(write);
  }
}
