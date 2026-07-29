# AI Context Prompt — KTG Connect

Copy everything below this line and paste it at the start of every new AI conversation before asking for help.

---

## COPY FROM HERE ↓

I'm working on a project called **KTG Connect** — a civic engagement app for Lagos LGA residents. It's a **vanilla JavaScript Single-Page Application** with a custom class-based component framework. There is no React, no Vue, no build tools, and no `npm install`. Everything is plain JS, HTML, and CSS.

---

### How the Framework Works

Every UI element is a class that extends `Component`. Here is the full lifecycle:

```js
class MyComponent extends Component {
  static styles = '/path/to/MyComponent.css'; // loaded automatically on mount

  constructor(props) {
    super(props);
    this.state = { loading: true }; // local state
  }

  // Returns an HTML string. This is all render() ever does.
  // No DOM manipulation here. No event binding here.
  render() {
    return `
      <div class="my-component">
        <p>${this.esc(this.props.title)}</p>
        ${this.state.loading ? '<span>Loading...</span>' : ''}
      </div>
    `;
  }

  // Called once after render() puts HTML into the DOM.
  // ALL event binding happens here. Never in render().
  afterMount() {
    this.on(this.$('[data-btn]'), 'click', () => {
      this.setState({ loading: false }); // triggers re-render automatically
    });
  }
}
```

**Non-negotiable rules:**
1. `render()` returns an HTML string only — never touches the DOM
2. All event listeners use `this.on(element, event, handler)` — never `addEventListener` directly
3. Never use `style="..."` inline attributes — always use CSS classes (CSP violation)
4. `this.setState({...})` merges state and re-renders — like React's setState
5. `this.$('selector')` = `this.el.querySelector('selector')` — always use this inside components, never `document.querySelector`
6. `this.esc(string)` escapes user data for safe HTML insertion — always use this on dynamic content
7. Child components must be registered with `this.addChild(new Child(...))` before mounting so they are cleaned up automatically

---

### Page Structure: WebLayout

Citizen-facing pages (after login) extend `WebLayout`, which automatically provides the sidebar and topbar. Pages only need to provide their own content:

```js
import { WebLayout } from '../../../components/layout/BaseLayout.js';
import { api } from '../../../api/client.js';
import { store } from '../../../core/store.js';

export default class TrendingPage extends WebLayout {
  static styles = '/pages/web/app/Trending.css';

  constructor(props) {
    super({ title: 'Trending', ...props }); // title shows in topbar
    this._data = [];
  }

  // Returns initial HTML shown immediately (before data loads).
  // Use this for skeletons or empty containers.
  getContent() {
    return `<div id="trending-inner"></div>`;
  }

  // Called after sidebar, topbar, and CSS are all fully loaded.
  // Fetch data and render dynamic content here.
  async onContentReady() {
    const res = await api.trending.getForLGA({ lgaId: store.currentLGA?.id || 11 });
    this._data = res.data || [];
    this._render();
  }

  _render() {
    const inner = document.getElementById('trending-inner');
    if (!inner) return;
    inner.innerHTML = `
      <h1>Trending</h1>
      ${this._data.map(item => `<p>${this.esc(item.title)}</p>`).join('')}
    `;
  }
}
```

**WebLayout methods available to page classes:**
- `this.getContentEl()` — returns the `<main>` DOM element
- `this.setTitle('New Title')` — updates topbar title
- `this.setContent(html)` — replaces the main content area's innerHTML

---

### The Store (Global State)

```js
import { store } from '../../../core/store.js';
import { showToast } from '../../../core/store.js';

// Read — just like a plain object
const user = store.currentUser;      // { id, name, phone, lgaId, lgaName, isVerified, ... }
const lga  = store.currentLGA;       // { id, name }
const route = store.currentRoute;    // e.g. '/trending'
const unread = store.unreadNotificationCount; // number

// Write — triggers any subscribers automatically
store.unreadNotificationCount = 3;

// Show a toast notification
showToast('Saved successfully!', 'success');  // types: success | error | warning | info
```

---

### The API (Mock Data)

All API calls return `{ data: [...], meta: { total, page, perPage } }`.

```js
import { api } from '../../../api/client.js';

// News
const res = await api.news.getForLGA({ lgaId: 11, page: 1, perPage: 10 });
// Each item: { id, title, summary, body, category, status, views, publishedAt, lgaId, lgaName }

// Trending
const res = await api.trending.getForLGA({ lgaId: 11, perPage: 5 });
// Each item: { id, title, category, views, createdAt, lgaId }

// Reels
const res = await api.reels.getForLGA({ lgaId: 11, perPage: 8 });
// Each item: { id, title, thumbnailUrl, duration, views, publishedAt, lgaName }

// Notifications
const res = await api.notifications.getAll({ page: 1, perPage: 20 });
// Each item: { id, category, title, body, isRead, createdAt }

const res = await api.notifications.getUnreadCount();
// res.data = { count: 3 }

// Chat
const res = await api.chat.getMessages({ lgaId: 11, page: 1 });
// Each item: { id, userId, userName, message, createdAt, reactions }

// User profile
const res = await api.users.getProfile();
// res.data = { id, name, phone, lgaId, lgaName, isVerified, ... }

const res = await api.users.updateProfile({ name: 'New Name' });

// LGAs
const res = await api.lgas.getAll();
// res.data = [{ id, name, state }, ...]
```

---

### Navigation

```js
import { router } from '../../../core/router.js';

router.push('/trending');      // navigate (adds to history — back button works)
router.replace('/login');      // navigate (replaces history — no back)
```

Regular `<a href="/path">` links are intercepted automatically. No `e.preventDefault()` needed.

---

### Available Reusable Components

Always use `this.addChild()` + `await component.mount(container)` when mounting inside a page.

#### Button
```js
import { Button } from '../../../components/base/Button.js';

const btn = this.addChild(new Button({
  label: 'Save changes',
  variant: 'primary',  // primary | secondary | ghost | danger
  size: 'md',          // sm | md | lg
  fullWidth: false,
  disabled: false,
  loading: false,
  onClick: () => this._handleSave(),
}));
await btn.mount(containerEl);

// Programmatic control
btn.setLabel('Saving...');
btn.setLoading(true);
btn.setDisabled(true);
```

#### Input
```js
import { Input } from '../../../components/base/Input.js';

const input = this.addChild(new Input({
  label: 'Full name',
  placeholder: 'e.g. Adaeze Okonkwo',
  type: 'text',        // text | password | email | phone | search | textarea
  name: 'name',
  required: true,
  hint: 'Helper text shown below the input',
  error: '',
  onChange: (value) => console.log(value),
  onEnter: () => this._handleSubmit(),
}));
await input.mount(containerEl);

input.getValue();        // get current value
input.setValue('text');  // set value programmatically
input.setError('Required'); // show error
input.clearError();
input.focus();
```

#### Dropdown
```js
import { Dropdown } from '../../../components/base/Forms.js';

const dropdown = this.addChild(new Dropdown({
  label: 'Select LGA',
  placeholder: 'Choose one...',
  options: [{ value: '11', label: 'Ikeja' }, { value: '2', label: 'Eti-Osa' }],
  searchable: true,
  onChange: (option) => console.log(option.value, option.label),
}));
await dropdown.mount(containerEl);

dropdown.getValue();  // returns selected option object or null
```

#### Badge (static — no mount needed)
```js
import { Badge } from '../../../components/base/Badge.js';

// Use directly in HTML strings
inner.innerHTML = `
  <div>
    ${Badge.html('Official', 'official', 'sm')}
    ${Badge.html('Published', 'success', 'md')}
    ${Badge.html('Pending', 'warning', 'sm')}
  </div>
`;
// Variants: official | success | warning | error | info | neutral
// Sizes: sm | md
```

#### NewsCard
```js
import { NewsCard } from '../../../components/base/Card.js';

const card = this.addChild(new NewsCard({
  id: item.id,
  title: item.title,
  summary: item.summary,
  category: item.category,
  publishedAt: item.publishedAt,
  views: item.views,
  lgaName: item.lgaName,
  layout: 'horizontal', // or 'vertical'
  onClick: () => router.push(`/trending/${item.id}`),
}));
const wrap = document.createElement('div');
gridEl.appendChild(wrap);
await card.mount(wrap);
```

#### ReelCard
```js
import { ReelCard } from '../../../components/base/Card.js';

const card = this.addChild(new ReelCard({
  id: reel.id,
  title: reel.title,
  thumbnailUrl: reel.thumbnailUrl,
  duration: reel.duration,  // seconds
  views: reel.views,
  publishedAt: reel.publishedAt,
  onClick: () => router.push(`/reels/${reel.id}`),
}));
const wrap = document.createElement('div');
gridEl.appendChild(wrap);
await card.mount(wrap);
```

#### Tabs
```js
import { Tabs } from '../../../components/base/UI.js';

const tabs = this.addChild(new Tabs({
  tabs: [
    { key: 'feed', label: 'Feed' },
    { key: 'saved', label: 'Saved' },
  ],
  activeKey: 'feed',
  onChange: (key) => this._renderTabContent(key),
}));
await tabs.mount(containerEl);
```

#### Toggle
```js
import { Toggle } from '../../../components/base/UI.js';

const toggle = this.addChild(new Toggle({
  label: 'Push notifications',
  description: 'Receive alerts for new content',
  checked: true,
  onChange: (checked) => console.log(checked),
}));
await toggle.mount(containerEl);
```

#### Modal
```js
import { Modal } from '../../../components/base/Modal.js';

const modal = this.addChild(new Modal({
  title: 'Confirm action',
  size: 'sm',  // sm | md | lg | xl
  content: `<p>Are you sure?</p>`,
  footer: `<div id="modal-btn-mount"></div>`,
  onClose: () => modal.hide(),
}));
await modal.mount(document.body, { append: true });
modal.show();
modal.hide();
```

---

### Design Tokens (always use these — never hardcode values)

```css
/* Colours */
--color-primary          /* #068927 — main green */
--color-primary-15       /* green at 15% opacity */
--color-primary-40       /* green at 40% opacity */
--color-text             /* main body text */
--color-text-secondary   /* slightly lighter text */
--color-text-muted       /* placeholder / caption text */
--color-bg               /* page background */
--color-surface          /* card / panel background */
--color-border           /* standard border */
--color-border-light     /* subtle border */
--color-success          /* green */
--color-warning          /* amber */
--color-error            /* red */

/* Spacing (4px base) */
--space-1   /* 4px */
--space-2   /* 8px */
--space-3   /* 12px */
--space-4   /* 16px */
--space-5   /* 20px */
--space-6   /* 24px */
--space-8   /* 32px */
--space-10  /* 40px */
--space-12  /* 48px */
--space-16  /* 64px */

/* Typography */
--font-size-xs      /* 11px */
--font-size-sm      /* 13px */
--font-size-base    /* 15px */
--font-size-lg      /* 17px */
--font-size-xl      /* 20px */
--font-size-2xl     /* 24px */
--font-weight-normal
--font-weight-medium
--font-weight-semibold
--font-weight-bold
--line-height-tight
--line-height-normal
--line-height-relaxed

/* Borders & Shadows */
--radius-sm   /* 6px */
--radius-md   /* 10px */
--radius-lg   /* 14px */
--radius-xl   /* 20px */
--radius-full /* 9999px */
--shadow-sm
--shadow-md
--shadow-lg
--shadow-xl

/* Transitions */
--transition-fast
--transition-base
--transition-slow

/* Z-index */
--z-sticky
--z-overlay
--z-modal
--z-toast
```

---

### Files I Work On (Web Pages Only)

```
pages/web/app/
  Home.js + Home.css
  Trending.js
  Reels.js
  Notifications.js
  Chat.js
  Settings.js
  Profile.js
  TrendingDetail.js
  ReelDetail.js
  AppPages.css, AppPages2.css, Detail.css

pages/web/auth/
  Landing.js + Landing.css
  Login.js
  Signup.js
  SelectLGA.js + SelectLGA.css
  Welcome.js + Welcome.css
  _AuthLayout.css
```

### Files I Must Never Edit

```
core/component.js
core/router.js
core/store.js
utils/cssLoader.js
app.js
index.html
components/layout/BaseLayout.js
components/layout/Sidebar.js
components/layout/Topbar.js
styles/tokens.css
```

---

### Common Patterns

**Looping through data to mount cards:**
```js
// Always use for...of with await — never forEach with async
for (const item of dataArray) {
  const card = this.addChild(new NewsCard({ ...item, onClick: () => router.push(`/trending/${item.id}`) }));
  const wrap = document.createElement('div');
  gridEl.appendChild(wrap);
  await card.mount(wrap);
}
```

**Subscribing to store changes:**
```js
// In afterMount() — auto-cleaned up on unmount
this.subscribe(store, 'unreadNotificationCount', (count) => {
  this.setState({ unread: count });
});
```

**Event delegation (for dynamically rendered lists):**
```js
// Attach one listener to the parent, handle all children
this.delegate('.list-item', 'click', (e, matchedEl) => {
  const id = matchedEl.dataset.id;
  router.push(`/trending/${id}`);
});
```

**Showing a toast:**
```js
import { showToast } from '../../../core/store.js';
showToast('Profile updated!', 'success');
showToast('Something went wrong.', 'error');
```

---

Now here is the file I need help with. Please follow all the framework rules above and never suggest React patterns, inline styles, or direct `addEventListener` calls:

[PASTE YOUR FILE HERE]
