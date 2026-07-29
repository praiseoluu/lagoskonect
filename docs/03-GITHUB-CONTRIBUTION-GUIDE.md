# How to Contribute — GitHub Workflow

This guide covers how to work with the project on GitHub so you and the project lead don't overwrite each other's work.

---

## First Time Setup

### 1. Clone the repository
```bash
git clone https://github.com/YOUR-ORG/ronniiii-i-ktg-connect.git
cd ronniiii-i-ktg-connect
```

### 2. Set up a local server
This project **cannot** be opened by double-clicking `index.html`. It must be served over HTTP because it uses ES modules and the `.htaccess` file for URL routing.

**Option A — VS Code (recommended):**
Install the **Live Server** extension, right-click `index.html`, and select "Open with Live Server".

**Option B — Python (if you have Python installed):**
```bash
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

**Option C — Node.js:**
```bash
npx serve .
```

---

## The Branch Workflow

Never commit directly to `main`. Always work on your own branch.

### Starting a new piece of work

```bash
# Make sure you have the latest code first
git checkout main
git pull origin main

# Create a new branch for your work
# Name it clearly — use the page name or feature you're working on
git checkout -b ui/home-page-redesign
git checkout -b ui/trending-page
git checkout -b ui/reels-page
git checkout -b fix/notification-badge
```

### Saving your work (committing)

```bash
# See what files you've changed
git status

# Stage the files you want to commit
git add pages/web/app/Home.js
git add pages/web/app/Home.css

# Or stage everything at once (use carefully)
git add .

# Commit with a clear message describing what you did
git commit -m "ui: update Home page layout to match Figma"
git commit -m "ui: add trending card hover states"
git commit -m "fix: remove inline styles from Settings page"
```

### Good commit message format
```
type: short description of what changed

Types:
  ui:    Visual/layout changes to match Figma
  fix:   Bug fixes
  data:  Changes to mock data in api/client.js
  css:   CSS-only changes
```

---

## Pushing Your Work & Opening a Pull Request

When you're happy with your changes and have tested them in the browser:

```bash
# Push your branch to GitHub
git push origin ui/home-page-redesign
```

Then go to the repository on GitHub. You'll see a prompt to **"Compare & pull request"** — click it.

**Fill in the PR description:**
- What pages did you change?
- What does it look like now vs before? (screenshots are very helpful)
- Anything the reviewer should know?

Then submit. The project lead will review and merge it.

---

## Keeping Your Branch Up to Date

If the project lead merges changes to `main` while you're working, you should pull them in to avoid conflicts:

```bash
git checkout main
git pull origin main
git checkout ui/your-branch-name
git merge main
```

If there are **merge conflicts** (Git tells you two people changed the same file), don't panic — message the project lead and sort it out together.

---

## What's Yours vs What's Theirs

To keep things clean, here's the agreed split:

| Area | Who works on it |
|---|---|
| `pages/web/` | You |
| `pages/web/auth/` | You |
| `pages/admin/` | Project lead |
| `components/layout/` | Project lead only |
| `core/` | Project lead only |
| `api/client.js` | Both (coordinate to avoid conflicts) |
| `styles/tokens.css` | Project lead only |

If you need a token added to `tokens.css` or a change to a shared component, ask the project lead to do it rather than editing it yourself.

---

## Quick Reference

```bash
# Start work
git checkout main && git pull origin main
git checkout -b ui/page-name

# Save progress
git add .
git commit -m "ui: describe what you did"

# Push and open PR
git push origin ui/page-name
# → then go to GitHub and open a pull request

# Get latest changes from main into your branch
git checkout main && git pull origin main
git checkout ui/page-name && git merge main
```

---

## If Something Goes Wrong

**"I accidentally committed to main"**
```bash
git checkout -b ui/save-my-work  # move your changes to a new branch
git checkout main
git reset --hard origin/main     # reset main back to what's on GitHub
```

**"I broke something and want to go back"**
```bash
git diff        # see what changed
git checkout -- pages/web/app/Home.js  # discard changes to one file
git checkout -- .  # discard ALL uncommitted changes (careful!)
```

**When in doubt — ask before force-pushing or doing anything destructive.**
