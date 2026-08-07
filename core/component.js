/**
 * Lagos Konect — Base Component Class
 * ============================================================
 * Every UI element in the application extends this class.
 *
 * Lifecycle:
 *   new Component(props)  → constructor, sets up state & props
 *   component.mount(el)   → renders into DOM, binds events
 *   component.update(p)   → merges new props, re-renders if needed
 *   component.unmount()   → removes from DOM, cleans up everything
 *
 * Rules:
 *   - render() must return an HTML string
 *   - Never manipulate the DOM directly outside of mount/update
 *   - Always call super.unmount() when overriding unmount()
 *   - Use this.on() instead of addEventListener — auto-cleaned up
 *   - Use this.subscribe() instead of store.subscribe() — auto-cleaned up
 */

import { loadCSS } from '../utils/cssLoader.js?v=20260806d';

export class Component {
  /**
   * @param {Object} props - Initial properties passed to the component
   */
  constructor(props = {}) {
    this.props = { ...props };
    this.state = {};

    /** @type {HTMLElement|null} The root DOM node this component owns */
    this.el = null;

    /** @type {boolean} Whether this component is currently mounted */
    this._mounted = false;

    /**
     * Internal registry of event listeners added via this.on()
     * Each entry: { target, type, handler, options }
     */
    this._listeners = [];

    /**
     * Internal registry of store subscriptions added via this.subscribe()
     * Each entry: { key, handler } — unsubscribed on unmount
     */
    this._subscriptions = [];

    /**
     * Child component instances managed by this component.
     * Stored so they can be unmounted when parent unmounts.
     * @type {Component[]}
     */
    this._children = [];

    /**
     * Unique instance ID — useful for keying DOM elements
     * and debugging.
     */
    this._id = `c_${Math.random().toString(36).slice(2, 9)}`;
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  /**
   * Returns the HTML string for this component.
   * Must be overridden by every subclass.
   * @returns {string}
   */
  render() {
    throw new Error(`${this.constructor.name}.render() is not implemented.`);
  }

  static styles = null;

  // ─── Mounting ─────────────────────────────────────────────────────────────

  /**
   * Mounts the component into the given container element.
   * Calls afterMount() once the DOM is ready.
   *
   * @param {HTMLElement} container - The parent element to mount into
   * @param {Object} [options]
   * @param {boolean} [options.append=false] - Append instead of replacing container contents
   * @returns {this}
   */
  async mount(container, options = {}) {
    if (!container || !(container instanceof HTMLElement)) {
      throw new Error(
        `${this.constructor.name}.mount() requires a valid HTMLElement container.`
      );
    }

    // if (this.constructor.styles) {
    //   await loadCSS(this.constructor.styles);
    // }

    const styleSheetStack = [];
    let currentProto = this.constructor;

    while (currentProto) {
      if (Object.prototype.hasOwnProperty.call(currentProto, 'styles') && currentProto.styles) {
        styleSheetStack.unshift(currentProto.styles);
      }
      if (Object.prototype.hasOwnProperty.call(currentProto, 'dependencies') && currentProto.dependencies) {
        currentProto.dependencies.forEach(dep => styleSheetStack.unshift(dep));
      }
      currentProto = Object.getPrototypeOf(currentProto);
    }

    // if (styleSheetStack.length > 0) {
    //   await Promise.all(styleSheetStack.map(path => loadCSS(path)));
    // }

    if (styleSheetStack.length > 0) {
      await Promise.all(
        styleSheetStack.map(path =>
          Promise.race([
            loadCSS(path),
            new Promise(resolve => setTimeout(resolve, 2000))
          ])
        )
      );
    }

    if (this._mounted) {
      console.warn(`${this.constructor.name} is already mounted. Call unmount() first.`);
      return this;
    }

    const html = this.render();

    if (options.append) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      this.el = wrapper.firstElementChild;
      container.appendChild(this.el);
    } else {
      container.innerHTML = html;
      this.el = container.firstElementChild;
    }

    this._mounted = true;
    this.afterMount();
    return this;
  }

  /**
   * Called immediately after the component's HTML is in the DOM.
   * Override to bind events, initialise child components, etc.
   * Always safe to query this.el here.
   */
  afterMount() {}

  // ─── Updating ─────────────────────────────────────────────────────────────

  /**
   * Merges new props and triggers a re-render.
   * Calls beforeUpdate() before and afterUpdate() after.
   *
   * @param {Object} newProps - Props to merge
   * @returns {this}
   */
  update(newProps = {}) {
    this.beforeUpdate(newProps);
    this.props = { ...this.props, ...newProps };

    // mount() is async — it awaits stylesheets before the first render — so an
    // update can legitimately land before _mounted flips. Keep the merged props
    // and let the pending render pick them up; re-rendering here would throw
    // because this.el does not exist yet.
    if (!this._mounted) {
      return this;
    }

    this._rerender();
    this.afterUpdate();
    return this;
  }

  /**
   * Called before props are merged and DOM is updated.
   * Override to cancel updates or transform incoming props.
   * @param {Object} newProps
   */
  beforeUpdate(newProps) {} // eslint-disable-line no-unused-vars

  /**
   * Called after the DOM has been re-rendered with new props.
   * Override to re-bind events that were lost in the re-render.
   */
  afterUpdate() {}

  /**
   * Updates internal state and triggers a re-render.
   * Similar to React's setState — merges, then re-renders.
   *
   * @param {Object|Function} updater - Object to merge, or function(prevState) => patch
   * @returns {this}
   */
  setState(updater) {
    const patch =
      typeof updater === 'function' ? updater(this.state) : updater;
    this.state = { ...this.state, ...patch };

    if (this._mounted) {
      this._rerender();
    }
    return this;
  }

  /**
   * Internal: tears down old event listeners, replaces the DOM,
   * and calls afterMount() so subclasses can re-bind.
   */
  _rerender() {
    // 1. Remove all DOM-level event listeners from the old tree
    this._teardownListeners();

    // 2. Remove store subscriptions — afterMount() will re-register them.
    this._teardownSubscriptions();

    // 3. Unmount children so they clean themselves up
    this._unmountChildren();

    // 3. Replace the inner DOM
    const parent = this.el?.parentElement;
    if (!parent) return;

    const html = this.render();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const newEl = wrapper.firstElementChild;

    parent.replaceChild(newEl, this.el);
    this.el = newEl;

    // 4. Re-bind
    this.afterMount();
  }

  // ─── Unmounting ───────────────────────────────────────────────────────────

  /**
   * Removes the component from the DOM and cleans up all resources.
   * Always call super.unmount() when overriding.
   */
  unmount() {
    if (!this._mounted) return;

    this.beforeUnmount();

    // Clean up children first (deepest first)
    this._unmountChildren();

    // Clean up event listeners
    this._teardownListeners();

    // Clean up store subscriptions
    this._teardownSubscriptions();

    // Remove from DOM
    this.el?.remove();
    this.el = null;
    this._mounted = false;

    this.afterUnmount();
  }

  /**
   * Called before the component is removed from the DOM.
   * Override for any pre-unmount logic (e.g. save draft state).
   */
  beforeUnmount() {}

  /**
   * Called after unmount is complete.
   * Override for any post-cleanup logic.
   */
  afterUnmount() {}

  // ─── Event Management ─────────────────────────────────────────────────────

  /**
   * Registers an event listener and tracks it for automatic cleanup.
   * Always use this instead of addEventListener directly.
   *
   * @param {EventTarget} target - The DOM element or EventTarget
   * @param {string} type - Event type (e.g. 'click', 'input')
   * @param {Function} handler - The handler function
   * @param {Object|boolean} [options] - addEventListener options
   * @returns {this}
   */
  on(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this._listeners.push({ target, type, handler, options });
    return this;
  }

  /**
   * Removes a specific tracked event listener.
   *
   * @param {EventTarget} target
   * @param {string} type
   * @param {Function} handler
   */
  off(target, type, handler) {
    target.removeEventListener(type, handler);
    this._listeners = this._listeners.filter(
      (l) => !(l.target === target && l.type === type && l.handler === handler)
    );
  }

  /**
   * Registers a delegated event listener on this.el.
   * Handler is only called when the event target matches the selector.
   *
   * @param {string} selector - CSS selector to match against event target
   * @param {string} type - Event type
   * @param {Function} handler - Called with (event, matchedElement)
   * @returns {this}
   */
  delegate(selector, type, handler) {
    const delegated = (e) => {
      const match = e.target.closest(selector);
      if (match && this.el.contains(match)) {
        handler(e, match);
      }
    };
    this.on(this.el, type, delegated);
    return this;
  }

  /** Removes all tracked event listeners */
  _teardownListeners() {
    this._listeners.forEach(({ target, type, handler, options }) => {
      target.removeEventListener(type, handler, options);
    });
    this._listeners = [];
  }

  // ─── Store Subscriptions ──────────────────────────────────────────────────

  /**
   * Subscribes to a store key and auto-unsubscribes on unmount.
   * Import and pass the store from the calling context.
   *
   * @param {Object} store - The global store instance
   * @param {string} key - The store key to watch
   * @param {Function} handler - Called with (newValue, oldValue)
   * @returns {this}
   */
  subscribe(store, key, handler) {
    store.subscribe(key, handler);
    this._subscriptions.push({ store, key, handler });
    return this;
  }

  /** Removes all store subscriptions */
  _teardownSubscriptions() {
    this._subscriptions.forEach(({ store, key, handler }) => {
      store.unsubscribe(key, handler);
    });
    this._subscriptions = [];
  }

  // ─── Child Component Management ───────────────────────────────────────────

  /**
   * Registers a child component so it gets unmounted with this parent.
   * Returns the child for chaining.
   *
   * @param {Component} child
   * @returns {Component}
   */
  addChild(child) {
    this._children.push(child);
    return child;
  }

  /** Unmounts and removes all registered children */
  _unmountChildren() {
    this._children.forEach((child) => child.unmount());
    this._children = [];
  }

  // ─── DOM Query Helpers ────────────────────────────────────────────────────

  /**
   * Queries a single element within this component's root.
   * @param {string} selector
   * @returns {HTMLElement|null}
   */
  $(selector) {
    return this.el?.querySelector(selector) ?? null;
  }

  /**
   * Queries all matching elements within this component's root.
   * @param {string} selector
   * @returns {NodeList}
   */
  $$(selector) {
    return this.el?.querySelectorAll(selector) ?? [];
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  /**
   * Emits a custom DOM event that bubbles up from this component's root.
   * Useful for communicating with parent components.
   *
   * @param {string} eventName
   * @param {*} detail - Data to attach to the event
   */
  emit(eventName, detail = null) {
    const event = new CustomEvent(`afx:${eventName}`, {
      bubbles: true,
      composed: true,
      detail,
    });
    this.el?.dispatchEvent(event);
  }

  /**
   * Escapes a string for safe insertion into HTML.
   * Use this on all user-provided data in render() strings.
   *
   * @param {string} str
   * @returns {string}
   */
  static escape(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  }

  /**
   * Shorthand escape on the instance (delegates to static).
   * @param {string} str
   * @returns {string}
   */
  esc(str) {
    return Component.escape(str);
  }

  toString() {
    return `[${this.constructor.name} id=${this._id}]`;
  }
}