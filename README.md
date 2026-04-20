# tibbie.

A free, browser-based project management app with a mobile-responsive Gantt timeline. Read access is open; edit access is behind a PIN.

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
- Netlify Functions (Node) + Netlify Blobs for storage
- TanStack Query for data caching and optimistic updates
- `date-fns` for date math; `html2canvas` + `jspdf` for export

## Running locally

You need Node 20+ and the Netlify CLI (`npm i -g netlify-cli`).

```bash
npm install
netlify login
netlify init   # link to a Netlify site (create a new one if needed)
npm run dev    # runs `netlify dev` — serves functions + frontend together on :8888
```

Open http://localhost:8888.

On first run the app is empty. Click **Set edit PIN** (the lock icon in the top-right), create a PIN, then either load sample data or start adding your first project.

## Deploying

```bash
netlify deploy --prod
```

Or push to GitHub and connect the repo in the Netlify dashboard — the `netlify.toml` already has the build config.

Everything runs on free-tier Netlify:
- Hosting: Netlify's free tier
- Functions: 125K invocations/month free
- Blobs: included with the site, generous quota

## Access model

- **Anyone with the URL can view everything** — projects, tasks, the timeline.
- **Only someone with the PIN can create, edit, or delete.** The PIN is hashed (SHA-256) and stored in Netlify Blobs. Verification happens server-side in the `pin.ts` Function; writes to `data.ts` require a valid PIN in the `X-Tibbie-Pin` header.
- **Session unlock** — once unlocked, the PIN lives in `sessionStorage` until you close the tab or click **Lock**.

Caveat: because reads are open and the app is client-heavy, view-only users could in theory inspect your data structure. Don't put anything confidential here that you wouldn't be comfortable with anyone seeing.

## Data model

All data is stored in a single Netlify Blobs key (`tibbie-data/root`) as one JSON document:

```
{
  projects: [{ id, name, description, startDate, endDate, color, createdAt, updatedAt }],
  members:  [{ id, name, email?, color, createdAt }],
  tasks:    [{ id, projectId, name, notes, startDate, endDate, status,
               percentComplete, isMilestone, assigneeIds[], recurring, ... }],
  dependencies: [{ predecessorId, successorId }],
  version: 1,
}
```

Single-blob storage keeps writes atomic and is fine for <1K tasks. If it ever grows past that, shard to one blob per collection — see `netlify/functions/data.ts`.

## Swapping the data source (US-17)

The `src/api/adapter.ts` module exposes a `DataAdapter` interface. To switch from Netlify Blobs to, say, Google Sheets or Supabase, implement the interface and change the single line at the bottom of the file. Nothing else in the codebase needs to know.

## Project structure

```
netlify/functions/    Server-side CRUD + PIN handling
  _shared.ts          Blobs store, PIN hashing, HTTP helpers
  data.ts             GET / PUT dataset
  pin.ts              PIN setup, verify, rotate

src/
  api/                Client ↔ Functions, and the adapter interface
  components/
    shell/            Nav, Logo, PIN gate, status banner
    gantt/            The SVG Gantt view
    tasks/            Task detail panel + form
    projects/         Project form
    members/          Members panel + avatars
    search/           Search palette
    filters/          Filter bar + drawer
    views/            Heatmap view
    ui/               Modal, Sheet, Toast, Confirm, Badge primitives
  hooks/              useMediaQuery, useDebounce
  lib/                Dates, CPM, search, export, seed, utils
  store/context.tsx   App-wide state + all mutations
  types.ts
  App.tsx
  main.tsx
```

## Known limitations & deferred items

- **Recurring tasks (US-23)** — the `recurring` flag and interval are stored on the task, but next-occurrence auto-generation is not yet implemented. Recurring tasks render as single instances for now.
- **Keyboard shortcuts beyond Cmd+K** — only search has a keyboard shortcut; task edit, navigation arrows, etc. would be nice to add.
- **Offline mode** — the app requires a live connection; no service worker or optimistic-without-network fallback.
- **Multi-user concurrent edits** — last-write-wins. If two people are editing simultaneously, the later save silently overwrites.

## Commands

```bash
npm run dev        # netlify dev (functions + frontend, port 8888)
npm run dev:vite   # just Vite, no functions (port 5173, reads will fail)
npm run build      # typecheck + production build to dist/
npm run typecheck  # tsc --noEmit
```
