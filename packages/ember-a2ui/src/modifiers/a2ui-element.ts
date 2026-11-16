import { modifier, type FunctionBasedModifier } from 'ember-modifier';
import type { ComponentNode } from '@a2ui/web_core';
import {
  registerUniversalElement,
  isWebComponentImplementation,
  type A2uiWebComponentElement,
} from '@a2ui/web_core/universal';

/**
 * Renders `node` as its universal custom element inside the host element.
 *
 * - Pending, unknown-type, cyclic and disposed nodes render nothing.
 * - A node of the same element type reuses the existing element (only `.node`
 *   changes); a different type replaces it.
 * - No cleanup function: removing the host (Ember teardown) disconnects the
 *   element, and the element disposes its own controller in
 *   `disconnectedCallback`. Re-running on a new node must keep the element so
 *   its state (focus, caret) survives.
 */
interface A2uiElementSignature {
  Element: HTMLElement;
  Args: {
    Named: Record<string, never>;
    Positional: [node: ComponentNode | undefined];
  };
}

const a2uiElement: FunctionBasedModifier<A2uiElementSignature> =
  modifier<A2uiElementSignature>((host, [node]) => {
    host.style.display = 'contents';

    if (!node || node.isPlaceholder || node.disposed || !node.impl) {
      host.replaceChildren();
      return;
    }

    const impl = node.impl;
    if (!isWebComponentImplementation(impl)) {
      host.replaceChildren();
      return;
    }

    registerUniversalElement(impl);

    let el = host.firstElementChild as A2uiWebComponentElement | null;
    if (!el || el.localName !== impl.tagName) {
      el = document.createElement(impl.tagName);
      host.replaceChildren(el);
    }
    // node first, then context (mirrors Lit's renderA2uiNode)
    el.node = node;
    el.context = node.context;
  });

export default a2uiElement;
