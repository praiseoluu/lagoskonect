# Using AI on This Project

AI tools like Claude are genuinely useful for this project — but only if you use them correctly. Because this project uses a **custom framework** (not React, not Vue), AI will sometimes give you advice that works for standard projects but breaks this one. This guide tells you how to get good results.

---

## The Golden Rule

**Always give the AI context about this project's framework before asking for help.**

If you just paste a component and say "how do I add a button?", the AI might tell you to use React syntax, or `document.addEventListener`, or `innerHTML` in ways that bypass the component system. That will cause bugs.

Instead, start every AI conversation with this:

---

**Copy and paste this at the start of every AI session:**

> I'm working on a project called KTG Connect. It's a vanilla JavaScript SPA with a custom class-based component framework (no React, no Vue, no build tools).
>
> The key rules are:
> - Every UI element extends a `Component` base class
> - `render()` returns an HTML string
> - `afterMount()` is where you bind events using `this.on()` — never `addEventListener` directly
> - Never use `style="..."` inline attributes — always use CSS classes
> - To update state, call `this.setState({...})` which triggers a re-render
> - `this.$('selector')` is shorthand for querying within the component
> - Child components must be registered with `this.addChild(new ChildComponent(...))` before mounting
> - Web app pages extend `WebLayout`, use `getContent()` for initial HTML, and `onContentReady()` for async data loading
> - Never use `document.querySelector` — use `this.$()` or target specific element IDs
>
> Here is the file I need help with: [paste your file here]

---

## What AI Is Good For on This Project

### ✅ Writing HTML strings for `render()` or `getContent()`
AI is great at turning a Figma description into HTML. Just describe the layout and it'll write it.

Example prompt:
> "Write the HTML string for a trending news card that shows a title, category badge, time ago, and view count. It should use CSS classes and the project's BEM naming convention."

### ✅ Writing CSS to match a design
Give the AI the HTML structure and describe the Figma design. It'll write the CSS using `var(--token-name)` if you tell it to.

Example prompt:
> "Write CSS for this component. Use the project's CSS variables for colours (`--color-primary`, `--color-text`, `--color-surface`, etc.) and spacing (`--space-1` through `--space-16`, 4px steps). No hardcoded values."

### ✅ Explaining what existing code does
If you don't understand a piece of code, paste it and ask.

Example prompt:
> "Explain what this `afterMount()` method is doing and why it's structured this way."

### ✅ Fixing a specific bug you've identified
If you know something is broken, paste the file and describe the symptom.

---

## What AI Will Get Wrong (And How to Catch It)

### ❌ It might suggest `addEventListener` directly
**Wrong:**
```js
document.querySelector('.my-btn').addEventListener('click', handler);
```
**Right:**
```js
this.on(this.$('.my-btn'), 'click', handler);
```

### ❌ It might suggest `style="..."` inline styles
**Wrong:**
```html
<div style="max-width: 480px; margin-bottom: 16px;">
```
**Right:**
```html
<div class="search-wrap">
```
```css
.search-wrap { max-width: 480px; margin-bottom: var(--space-4); }
```

### ❌ It might suggest React/Vue patterns
If the AI uses `useState`, `useEffect`, `ref`, `v-model`, or JSX — stop. That's the wrong framework. Remind it this is vanilla JS with a custom class component system.

### ❌ It might suggest `document.querySelector` instead of `this.$()`
Using `document.querySelector` works but is risky — it could accidentally target elements from a different component. Always use `this.$()` inside a component.

### ❌ It might forget `this.addChild()`
If AI gives you code that mounts a child component but forgets `this.addChild(...)`, the child won't be cleaned up when the page changes, causing memory leaks and weird bugs.

Always:
```js
const card = this.addChild(new NewsCard({ ...item }));
await card.mount(wrap);
```

---

## Recommended AI Workflow for Changing a Page

1. **Open the Figma** and screenshot or describe the section you want to implement.
2. **Open the current page file** (e.g. `Trending.js`).
3. **Start a new AI conversation** with the framework context block above.
4. Paste the current file and say: *"I need to update this page to match this design: [describe or paste screenshot description]. Keep the same component structure, data fetching pattern, and CSS variable usage."*
5. **Review the AI's output** before pasting it in. Check for the red flags above.
6. **Test in the browser** before considering it done.

---

## Asking for Help From the Project Lead

If something the AI suggests breaks the project, or you're unsure whether to follow its advice — ask the project lead before applying changes. It's always faster to ask first than to fix a broken app later.

Especially avoid:
- Changing anything in `core/` or `components/layout/`
- Changing `app.js` or `index.html`
- Adding new npm packages or build tools (there are none — keep it that way)
