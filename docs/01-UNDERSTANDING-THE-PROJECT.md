# Understanding KTG Connect — A Guide for New Contributors

Welcome! This document will help you understand how this project works before you touch any code. Read it fully before making any changes. It will save you a lot of confusion.

---

## What Kind of Project Is This?

KTG Connect is a **Single-Page Application (SPA)** built with plain HTML, CSS, and JavaScript — no React, no Vue, no build tools, no `npm install`. You open the folder in a server and it runs.

However, it is **not** a standard multi-page website. The developer built a custom framework from scratch that works similarly to React or Vue. This means:

- There is **one HTML file** (`index.html`). Every page you see is JavaScript rendering HTML into it.
- The **URL changes without the browser reloading**. This is handled by the custom router.
- Every UI element is a **Component class** — a JavaScript class that renders HTML, manages its own events, and cleans up after itself.

Understanding these three things is the foundation of everything else.

---

## The Folder Structure

```
ronniiii-i-ktg-connect/
├── app.js                  ← App entry point (runs once on load)
├── index.html              ← The only HTML file. Never edit the <body>.
├── api/
│   └── client.js           ← ALL mock data and API calls live here
├── components/
│   ├── base/               ← Reusable UI components (Button, Input, Card, etc.)
│   └── layout/             ← Page shell components (Sidebar, Topbar, BaseLayout)
├── core/
│   ├── component.js        ← The base Component class (DO NOT EDIT)
│   ├── router.js           ← The custom router (DO NOT EDIT)
│   └── store.js            ← Global reactive state (DO NOT EDIT)
├── pages/
│   ├── web/                ← Citizen-facing pages (YOUR TERRITORY)
│   │   ├── auth/           ← Login, Signup, Landing, etc.
│   │   └── app/            ← Home, Trending, Reels, Chat, etc.
│   └── admin/              ← Admin dashboard pages (not your concern for now)
├── styles/
│   ├── tokens.css          ← Design tokens (colours, spacing, fonts) — READ THIS
│   ├── reset.css           ← CSS reset
│   └── utilities.css       ← Utility classes
└── utils/                  ← Helper functions (dates, validation, storage)
```

**Your work will almost entirely be inside `pages/web/` and their corresponding `.css` files.** You will also reference `components/base/` to use existing components.

---

## The Core Concept: Components

Every piece of UI is a `Component`. Think of it like a class that owns a chunk of the screen.

Here is what a typical page component looks like:

```js
import { Component } from '../../../core/component.js';

export default class ExamplePage extends Component {
  static styles = '/pages/web/app/Example.css'; // CSS file for this component

  constructor(props) {
    super(props);
    this.state = { count: 0 }; // local state
  }

  // render() returns an HTML string. This is what appears on screen.
  render() {
    return `
      <div class="example-page">
        <h1>Count: ${this.state.count}</h1>
        <button data-add>Add</button>
      </div>
    `;
  }

  // afterMount() runs once after render() puts HTML into the DOM.
  // Bind events here. NEVER bind events inside render().
  afterMount() {
    this.on(this.$('[data-add]'), 'click', () => {
      this.setState({ count: this.state.count + 1 });
      // setState() automatically re-renders the component
    });
  }
}
```

### The Rules You Must Follow

1. **`render()` returns an HTML string. Nothing else.** No DOM manipulation inside `render()`.
2. **All event listeners go in `afterMount()`**, using `this.on()` — never `addEventListener()` directly.
3. **Never use `style="..."` inline attributes.** This violates the project's security policy (CSP). Put styles in CSS files instead.
4. **To update the screen, call `this.setState({...})`**. It will re-render and re-bind events automatically.
5. **`this.$('selector')`** is a shorthand for `this.el.querySelector('selector')`. Use it instead of `document.querySelector`.

---

## Page Layout: WebLayout

Web app pages (the ones citizens see after logging in) don't extend `Component` directly. They extend `WebLayout`:

```js
import { WebLayout } from '../../../components/layout/BaseLayout.js';

export default class HomePage extends WebLayout {
  static styles = '/pages/web/app/Home.css';

  constructor(props) {
    super({ title: 'Home', ...props }); // title appears in the topbar
  }

  // getContent() is like render() for the page body.
  // The sidebar and topbar are added automatically by WebLayout.
  getContent() {
    return `<div id="home-inner">Loading...</div>`;
  }

  // onContentReady() is called after the sidebar, topbar, and CSS are all loaded.
  // Fetch data and render dynamic content here.
  async onContentReady() {
    const res = await api.news.getForLGA({ lgaId: 11 });
    document.getElementById('home-inner').innerHTML = `
      <h2>Latest News</h2>
      ${res.data.map(item => `<p>${item.title}</p>`).join('')}
    `;
  }
}
```

**Key methods for WebLayout pages:**

| Method | What it does |
|---|---|
| `getContent()` | Returns the initial HTML for the page body (shown immediately, before data loads) |
| `onContentReady()` | Called once everything is mounted. Fetch data and render here. |
| `this.setTitle('New Title')` | Updates the topbar title |
| `this.getContentEl()` | Returns the `<main>` DOM element |

---

## The Store (Global State)

The store is a global object that holds state shared across the app. You read and write it like a plain object:

```js
import { store } from '../../../core/store.js';

// Read
const user = store.currentUser;
const lga = store.currentLGA;
const route = store.currentRoute;

// Write (automatically notifies subscribers)
store.unreadNotificationCount = 5;
```

**Things you'll commonly use from the store:**

| Key | What it contains |
|---|---|
| `store.currentUser` | The logged-in user object `{ id, name, phone, lgaId, lgaName, ... }` |
| `store.currentLGA` | The user's selected LGA `{ id, name }` |
| `store.currentRoute` | The current URL path e.g. `'/home'` |
| `store.unreadNotificationCount` | Number for the notification badge |

---

## The API (Mock Data)

All data comes from `api/client.js`. It simulates a real backend with realistic fake data and a small delay.

```js
import { api } from '../../../api/client.js';

// Always await API calls
const res = await api.news.getForLGA({ lgaId: 11, perPage: 4 });
console.log(res.data);  // array of news items
console.log(res.meta);  // pagination info

const res2 = await api.reels.getForLGA({ lgaId: 11 });
const res3 = await api.trending.getForLGA({ lgaId: 11 });
const res4 = await api.notifications.getAll();
```

All responses follow the same shape: `{ data: [...], meta: { total, page, perPage } }`.

To change what data appears on a page, edit the mock data arrays near the top of `api/client.js`. Look for `MOCK.news`, `MOCK.reels`, `MOCK.trending`, etc.

---

## Navigation

To navigate to another page in code:

```js
import { router } from '../../../core/router.js';

router.push('/trending');       // adds to browser history (back button works)
router.replace('/login');       // replaces current history entry (no back)
```

Regular `<a href="/trending">` links also work — the router intercepts them automatically.

---

## Design Tokens

Before writing any CSS, read `styles/tokens.css`. All colours, spacing, font sizes, and border radii are defined as CSS variables there. **Always use tokens instead of hardcoded values.**

```css
/* ✗ Don't do this */
color: #068927;
padding: 16px;
font-size: 14px;

/* ✓ Do this */
color: var(--color-primary);
padding: var(--space-4);
font-size: var(--font-size-sm);
```

Common tokens you'll use constantly:

```
Colours:       --color-primary, --color-text, --color-text-muted, --color-bg, --color-surface, --color-border
Spacing:       --space-1 through --space-16 (4px increments: space-1=4px, space-4=16px, space-6=24px)
Font sizes:    --font-size-xs, --font-size-sm, --font-size-base, --font-size-lg, --font-size-xl
Border radius: --radius-sm, --radius-md, --radius-lg, --radius-full
```

---

## Reusable Components

These are ready-made components you can use on any page. Import them from `components/base/`:

```js
import { Button } from '../../../components/base/Button.js';
import { Input } from '../../../components/base/Input.js';
import { Badge } from '../../../components/base/Badge.js';
import { NewsCard, ReelCard } from '../../../components/base/Card.js';
```

**How to mount a reusable component inside your page:**

```js
async onContentReady() {
  const inner = document.getElementById('my-page-inner');

  // 1. Create the component
  const btn = this.addChild(new Button({
    label: 'Click me',
    variant: 'primary',
    onClick: () => alert('clicked!'),
  }));

  // 2. Create a container for it
  const wrap = document.createElement('div');
  inner.appendChild(wrap);

  // 3. Mount it into the container
  await btn.mount(wrap);
}
```

**Important:** Always use `this.addChild(...)` when creating child components inside a page. This registers them so they get cleaned up automatically when the page changes.

---

## What You Should NOT Touch

These files are the framework core. Editing them incorrectly can break the entire app:

- `core/component.js`
- `core/router.js`
- `core/store.js`
- `utils/cssLoader.js`
- `app.js`
- `index.html`
- `components/layout/BaseLayout.js`
- `components/layout/Sidebar.js`
- `components/layout/Topbar.js`

If you think something in these files needs to change, talk to the project lead first.

---

## Summary: Your Typical Workflow

When modifying a web page to match the Figma design:

1. Open the page file in `pages/web/app/` (e.g. `Trending.js`)
2. Update `getContent()` to return the correct skeleton/structure HTML
3. Update `onContentReady()` to populate dynamic content from the API
4. Edit the corresponding `.css` file to match the Figma styles
5. Use CSS variables from `styles/tokens.css` — never hardcode colours or spacing
6. Never use `style="..."` inline — always use CSS classes
7. Test by navigating to the page in the browser

That's it. You've got this!
