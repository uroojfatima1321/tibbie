# tibbie.

A free, browser-based project management app with a mobile-responsive Gantt timeline. Read access is open; edit access is behind a PIN. Deployed on Cloudflare Pages with KV storage.

## What's in the box

- **Timeline view** — SVG Gantt with day/week/month zoom, sticky-left task column, dependency arrows, critical path highlighting, milestones, and a "today" indicator.
- **Workload heatmap** — per-member, per-week activity view.
- **CRUD** — projects, tasks, members, dependencies. All edits gated by a PIN.
- **Filters & grouping** — by project, status, member, date range; group rows by project, assignee, or flat list.
- **Global search** — Cmd/Ctrl+K palette with type filtering and inline highlighting.
- **Export** — current view as PNG or single-page landscape PDF.
- **Alerts** — overdue and due-soon flags roll up to a dashboard banner.
- **Mobile-responsive** — bottom sheets, slide-out filter drawer, touch-friendly targets, responsive default zoom.

## Stack

- React 18 + Vite + TypeScript + Tailwind CSS
- Cloudflare Pages (hosting) + Cloudflare Pages Functions (serverless)
- Cloudflare KV for storage
- TanStack Query for data caching and optimistic updates

## Deploying to Cloudflare Pages

You need a Cloudflare account (free — no credit card required) and Node.js 20+.

### Step 1 — Install dependencies

```bash
unzip tibbie.zip && cd tibbie
npm install
```

### Step 2 — Install Wrangler and log in

```bash
npm install -g wrangler
wrangler login   # opens a browser to authorize
```

### Step 3 — Create the KV namespace

Cloudflare KV needs namespaces for both production and local dev:

```bash
# Production namespace
wrangler kv namespace create TIBBIE_KV

# Preview namespace (used by wrangler pages dev)
wrangler kv namespace create TIBBIE_KV --preview
```

Each command prints an `id` (and `preview_id`). Save both — you'll paste them in Step 5.

Example output:
```
🌀 Creating namespace with title "tibbie-TIBBIE_KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "TIBBIE_KV", id = "abc123def456..." }
```

### Step 4 — Create the Pages project

```bash
wrangler pages project create tibbie --production-branch=main
```

This just registers the project name. No code deployed yet.

### Step 5 — Update `wrangler.toml` with your real IDs

Open `wrangler.toml` and replace the placeholder `id`:

```toml
name = "tibbie"
compatibility_date = "2024-11-01"
pages_build_output_dir = "./dist"

[[kv_namespaces]]
binding = "TIBBIE_KV"
id = "YOUR_PRODUCTION_ID_HERE"
preview_id = "YOUR_PREVIEW_ID_HERE"
```

### Step 6 — Build and deploy

```bash
npm run deploy
```

This runs the build and uploads to Cloudflare. First deploy takes ~2 minutes. You'll get a URL like `tibbie.pages.dev`.

### Step 7 — Bind KV in the Cloudflare dashboard

This is the step most people miss. Even though `wrangler.toml` declares the KV binding, the Pages production deploy needs it bound explicitly in the dashboard:

1. Go to https://dash.cloudflare.com → **Workers & Pages** → **tibbie**
2. **Settings** → **Bindings**
3. Click **Add** → **KV Namespace**
4. Variable name: `TIBBIE_KV` (must match exactly)
5. KV namespace: select the one you created in Step 3
6. Save
7. Trigger a redeploy: **Deployments** → click the latest one → **Retry deployment**

Without this step, the functions will return errors when they try to access `env.TIBBIE_KV`.

### Step 8 — First-run setup

Open the deployed URL. Click the **lock icon** top-right to create your edit PIN, then **Load sample data** for a demo or **Start empty**.

---

## Continuous deployment with GitHub (optional)

If you want pushes to auto-deploy, connect the repo:

1. Push the code to a GitHub repo
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. Pick the repo, set:
   - Build command: `npm run build`
   - Build output: `dist`
   - Root directory: `/`
4. In **Settings** → **Environment variables**, add `NODE_VERSION` = `20`
5. Re-do Step 7 to bind KV (dashboard binding persists across deploys)

---

## Testing locally

Local dev needs the preview KV namespace you created in Step 3. Running:

```bash
npm run dev:cf
```

Starts Wrangler on `http://localhost:8788` with both the Vite dev server and the KV-backed functions. All the PIN and edit flows work end-to-end locally.

For frontend-only work (no functions), `npm run dev` runs Vite alone on `:5173`. Reads and writes will fail in this mode.

---

## Access model

- **Anyone with the URL can view everything** — projects, tasks, the timeline
- **Only someone with the PIN can create, edit, or delete** — the PIN is hashed (SHA-256 via Web Crypto) and stored in KV
- **Session unlock** — once unlocked, the PIN lives in `sessionStorage` until tab close or manual lock

Because reads are open and the app is client-heavy, view-only users can inspect the data structure. Don't put anything confidential here.

---

## Data model

All data stored in a single KV key (`TIBBIE_KV:root`) as JSON:

```
{
  projects: [{ id, name, description, startDate, endDate, color, ... }],
  members:  [{ id, name, email?, color, ... }],
  tasks:    [{ id, projectId, name, notes, startDate, endDate, status,
               percentComplete, isMilestone, assigneeIds[], recurring, ... }],
  dependencies: [{ predecessorId, successorId }],
  version: 1,
}
```

Single-key storage is fine for <1K tasks. Writes are atomic; last-write-wins.

## Swapping the data source (US-17)

The `src/api/adapter.ts` module exposes a `DataAdapter` interface. Change that one file to migrate to a different backend — the components don't know or care.

---

## Project structure

```
functions/                 Cloudflare Pages Functions
  _shared.ts               KV helpers, PIN hashing, HTTP
  api/
    data.ts                GET/PUT dataset
    pin.ts                 PIN setup/verify/rotate

src/
  api/                     Client ↔ Functions, adapter interface
  components/
    shell/                 Nav, Logo, PIN gate, status banner
    gantt/                 SVG Gantt view
    tasks/                 Task detail panel + form
    projects/              Project form
    members/               Members panel + avatars
    search/                Search palette
    filters/               Filter bar + drawer
    views/                 Heatmap view
    ui/                    Modal, Sheet, Toast, Confirm, Badge
  hooks/                   useMediaQuery, useDebounce
  lib/                     Dates, CPM, search, export, seed, utils
  store/context.tsx        App-wide state + mutations
  types.ts
  App.tsx
  main.tsx

public/
  _redirects               SPA fallback (all non-API routes → index.html)
  _routes.json             Which paths are Functions vs static
  favicon.svg

wrangler.toml              Pages + KV config
```

---

## Free-tier limits

Cloudflare Pages + KV free tier:
- **Unlimited static requests** (no bandwidth cap)
- **500 builds/month**
- **KV: 100K reads/day, 1K writes/day, 1GB storage**
- **Functions: 100K invocations/day**

The KV write limit is the one to be aware of — if your team makes more than 1000 edits per day the writes will start rejecting until the next UTC day. For a PM tool this is comfortably in the clear.

---

## Troubleshooting

**`env.TIBBIE_KV is undefined`** — KV binding missing in dashboard. Redo Step 7.

**`wrangler pages dev` has no KV** — you didn't create the `--preview` namespace. Rerun Step 3 with `--preview`.

**Build fails on TypeScript** — `npm run typecheck` locally first. The Cloudflare Workers types are stricter about some globals.

**Forgot the PIN** — in the Cloudflare dashboard: **Workers & Pages** → **KV** → your namespace → delete the `pin_hash` key. Data in `root` stays intact. App will treat it as first-run.

**PIN won't set** — check function logs at dashboard → **tibbie** → **Functions** → **Real-time logs**.

**Redeploy after config change** — dashboard → **Deployments** → **Retry deployment** on the latest.

---

## Known limitations

- **Recurring tasks (US-23)** — data model and UI present; next-occurrence auto-generation not implemented
- **Multi-user concurrent edits** — last-write-wins, no conflict resolution
- **Offline mode** — requires a live connection
- **Keyboard shortcuts** — only Cmd+K for search

---

## Commands

```bash
npm run dev         # Vite only, port 5173 (reads/writes fail)
npm run dev:cf      # Wrangler + Vite, port 8788 (full stack)
npm run build       # typecheck + production build
npm run deploy      # build + upload to Cloudflare Pages
npm run typecheck   # tsc --noEmit
```
