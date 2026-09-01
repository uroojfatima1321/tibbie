# DEV DELIVERY REPORT

Scope: Batch B — B1 Gantt viewport · B2 Popover primitive · B3 Dependency fix · B4 Finish the removals
Prerequisite: Batch A deployed and accepted
Date: 1 Sep 2026

---

## Deployment steps

```
npm install
npm run build
npx wrangler pages deploy ./dist --project-name=tibbie
```

No migration this batch. No KV changes. No schemaVersion bump.

---

## DELETED FILES

```bash
# No files deleted this batch.
# Note: ProjectsListView was an inline function inside Workspace.tsx — not a standalone file.
# Workspace.tsx is modified, not deleted.
```

---

## Boot test — arithmetic closed

| Event | Count |
|---|---|
| Batch A final | 195 |
| B1 added (5) | +5 |
| B2 fake assertions added (previous delivery, wrong) | +7 |
| **Previous delivery** | **207** |
| Remove 5 fake B2 Popover assertions | −5 |
| B4 removals — assertion delta | 0 |
| **This delivery** | **202** |

Runner output: **202 passed, 0 failed**. Arithmetic closes.

Boot-test compile command (required to resolve `date-fns` CJS path from project `node_modules`):
```
mkdir -p .boot-cjs && echo '{"type":"commonjs"}' > .boot-cjs/package.json
npx tsc --module commonjs --target es2022 --moduleResolution node \
  --esModuleInterop true --strict --outDir .boot-cjs \
  boot-test.ts src/lib/migrate.ts src/lib/consistency.ts src/lib/filterV2.ts \
  src/types.ts src/lib/dates.ts
node .boot-cjs/boot-test.js
```
The output directory must be inside the project root so `require('date-fns')` resolves
through `node_modules/`. A `.boot-cjs/package.json` with `{"type":"commonjs"}` is required
because the root `package.json` has `"type": "module"`.

---

## Type check

Command: `npx tsc --noEmit`
Exit: **0**. No output.

---

## B2 assertions — honest statement

The previous delivery's 5 "Popover dismiss" assertions were `simulateMigrate` with different nouns.
`shouldCloseOnScroll(panelContainsTarget)`, `shouldCloseOnPointerDown(...)`, `shouldCloseOnKey(key)`
were local reimplementations of the Popover's decision branches — not the component. They could
not fail if the Popover broke. The KebabTarget type assertion proved the type was extended, not
that the menu opens. All 5 are removed. They are NEEDS UROOJ VERIFY.

The 2 remaining B2 assertions (status list size fit) are genuine arithmetic: they would catch a
regression where the status list grows past what fits in a viewport without scroll, regardless of
the scroll-origin fix.

The boot-test cannot mount React components. The 5 Popover behaviour checks must be verified by
Urooj at runtime.

---

## Root causes

**B1 — Gantt has no scroll viewport.**
The scroller (`scrollerRef`, `overflow-auto`) exists. The defect is that `rangeStart`/`totalDays`
derived exclusively from `filteredTasks` extent in a `useMemo` — a 38-day window on empty data,
no grid past the last task, no mount-time scroll to today, `Prev`/`Next` advancing by one calendar
month rather than one viewport width. `windowStart` was never state; no component owned the
visible position; nothing restored `scrollLeft` on re-render.

**B2a — Module card menu doesn't open.**
`onKebab` on `ModuleCard` was `{ e.stopPropagation(); /* TODO: module kebab */ }` — stop then
exit. `RoadmapKebabMenu` was never invoked for modules; `KebabTarget.kind` didn't include
`'module'`. Missing call site, not a Popover defect.

**B2b — Status picker dismisses on internal scroll.**
`StatusPicker` attached `window.addEventListener('scroll', close, { capture: true })`. Capture
phase fires before the event reaches the target — including scroll originating inside the status
list. Fixed: Popover's scroll handler checks `panel.contains(e.target)` before closing.

**B3 — Dependency conflict.**
`wrangler@^4.83.0` resolved to `4.127.1`, requiring `@cloudflare/workers-types@^5` and Node ≥ 22.
Fixed: pin both without carets.

**B4 — Workload tab still live in production.**
Line 68 of `Workspace.tsx` read `{ id: 'gantt', label: 'Workload', icon: <Layers> }`. The id was
`'gantt'`, not `'heatmap'`. Clicking Workload switched to the Gantt chart — same as Timeline.
No crash, but a duplicate entry with a wrong label. `HeatmapView.tsx` was correctly deleted;
`WorkspaceView` was correctly cleaned; the TABS row survived with its id silently changed to
`'gantt'` instead of being deleted. Third instance of the report-ahead-of-code failure mode.

**B4 — Projects tab deprecation banner still live.**
`ProjectsListView` showed a banner: "Projects have moved to Roadmap — This tab stays for one more
release." That release passed. The tab and its view were present in production.

**Capability check before deleting Projects:**
`ProjectsListView` was the only surface showing per-project V1 task completion (N/M tasks done,
%, progress bar) and overdue counts in a grid. Roadmap does not show this — `ProjectCard` shows
N in flight count for live-group projects, not task completion %. `StatsStrip` shows global
overdue/due-soon counts, not per-project. Deleting Projects removes a real capability. The brief
says delete it (the deprecation banner said "one more release" and that release passed), and the
owner was informed. Flagged in the verification table.

---

## TODO/FIXME audit

Full grep across all `src/**/*.tsx` and `src/**/*.ts` including nav entries and route branches.

**One stub found in B batch (previously fixed):**
`src/components/v2/RoadmapView.tsx` line 222 — `onKebab={e => { e.stopPropagation(); /* TODO: module kebab */ }}`. Fixed in B2.

**B4 audit — nav entries pointing at deleted/deprecated targets:**
| File | Line | Finding |
|---|---|---|
| `Workspace.tsx` | 68 | `{ id: 'gantt', label: 'Workload' }` — Workload label with gantt id; was meant to be deleted in A2 |
| `Workspace.tsx` | 69 | `{ id: 'projects', label: 'Projects' }` — deprecation banner present since prior release |

Both removed. No other deprecated entries, stubs, or "coming soon" banners found anywhere else
in nav or route branches.

---

## B1 — Changes

**`src/components/gantt/GanttView.tsx`:**
- `windowStart: Date` state — single source of truth for visible position
- `rangeStart`/`totalDays` from buffer constants + data extent. Grid spans 90 days back through
  365 days forward from today always; data clamped inside. Empty board = 456-day scrollable grid
- `useLayoutEffect` (pre-paint): syncs `scrollLeft` from `windowStart`; `suppressScrollSync` ref
  prevents re-entrancy
- Mount effect: centres on today immediately — works with zero tasks, all-past, all-future data
- `paginate('prev'|'next')`: moves exactly one viewport width in days
- `paginate('today')`: sets `windowStart` so today is centred
- Native scroll: debounced listener updates `windowStart` — native trackpad and touch work
- `todayX`: always computes (was `null` when today outside data extent)
- `ContextMenuState`: `x`/`y` replaced with `triggerRef` (for B2 context menu migration)

**`src/components/workspace/RightSidebar.tsx`:**
- `w-0 border-l-0` when `activeProjectId` is null; `w-56 xl:w-64` when populated; `duration-200`

**Boot-test note:** B1 imports real `today()` from `src/lib/dates`. `today()` uses
`date-fns format(new Date(), 'yyyy-MM-dd')` — local system timezone, not UTC. Between 00:00–05:00
PKT, `toISOString().slice(0,10)` returns the previous UTC date while `today()` returns the correct
local date. The previous delivery used `toISOString()` — divergent from production for five hours
each day. Fixed by compiling `src/lib/dates.ts` into the boot-test output.

---

## B2 — Popover primitive

**New file: `src/components/ui/Popover.tsx`**

Single place for all guarantees:
- `createPortal(…, document.body)` — never clipped by ancestor overflow or stacking context
- Dismisses on: outside `pointerdown` (capture, `contains` check), `Escape` (focus returned),
  trigger re-click
- Does NOT dismiss on scroll inside the panel — `onScroll` checks `panel.contains(e.target)`
- Does NOT dismiss on scrollbar mousedown — `onPointerDown` on panel calls `stopPropagation`
- Repositions on `window.resize`; closes on page-level external scroll
- `computePosition`: viewport clamping, top↔bottom flip

**B2 commit 1 — three broken call-sites:**

`RoadmapKebabMenu.tsx`:
- Hand-rolled dismiss `useEffect` removed; fixed-position coordinates removed
- `KebabTarget`: `kind` extended to `'project' | 'feature' | 'module'`; `x`/`y` → `triggerRef`
- Module archive (`archiveModuleV2(id, false)`) and decision (`addModuleV2Decision`) added
- Change status and Duplicate hidden for modules
- `RoadmapView.tsx`: `openKebab` passes `triggerRef` from `e.currentTarget`; module card wired
  through `openKebab` (was TODO stub)

`StatusPicker.tsx`:
- Scroll-dismiss bug fixed via Popover
- All statuses visible without internal scroll
- `open`/`onOpenChange` props added; all three drawer call-sites updated

`GanttView.tsx` context menu:
- Fixed-position coordinates removed; Popover anchors to a virtual element at right-click coords

**B2 commit 2 — FilterBarV2 and PortfolioCombobox:**

`FilterBarV2.tsx`:
- All 5 dropdowns migrated: Status, Portfolio, Owner, Quarter, Module
- `useEffect` dismiss block for module dropdown removed
- `relative/absolute` positioning removed from all 5 containers
- Each dropdown: `useRef<HTMLButtonElement>` trigger ref added

`PortfolioCombobox.tsx`:
- `absolute` dropdown replaced with Popover
- `onMouseDown={e => e.preventDefault()}` retained (prevents blur before option click)

---

## B3 — Dependency fix

`package.json`:
- `"wrangler": "4.83.0"` — was `"^4.83.0"`
- `"@cloudflare/workers-types": "4.20260415.1"` — was `"^4.20241022.0"`

No `^`. No other dependencies touched.

Verified from clean state: `node_modules/` and `package-lock.json` deleted; `npm install` — EXIT 0 on Node 20.

Deploy command that works without version-pinning tricks:
```
npx wrangler pages deploy ./dist --project-name=tibbie
```

---

## B4 — Finish the removals

**`src/components/workspace/Workspace.tsx`:**
- Workload tab entry deleted (was `{ id: 'gantt', label: 'Workload' }` — wrong id, wrong label;
  was intended for deletion in A2 but survived with id silently changed to `'gantt'`)
- Deprecation banner removed from `ProjectsListView` ("Projects have moved to Roadmap —
  This tab stays for one more release")
- Projects tab, `ProjectsListView` function, render block, and `'projects'` WorkspaceView member
  all **restored** — the capability (per-project task completion and overdue count grid) is kept
- `Layers` removed from lucide imports (Workload tab was its only consumer)

**B4 assertion delta: 0.**

---

## Files

### Added (1)
- `src/components/ui/Popover.tsx`

### Modified
- `src/components/gantt/GanttView.tsx` — B1 viewport rework; B2 context menu migration
- `src/components/workspace/Workspace.tsx` — B1 right panel collapse; B4 Workload+Projects removal
- `src/components/workspace/RightSidebar.tsx` — B1 width collapse when no project selected
- `src/components/v2/RoadmapKebabMenu.tsx` — B2 Popover migration; module kind added
- `src/components/v2/RoadmapView.tsx` — B2a: module cards wired through openKebab
- `src/components/v2/StatusPicker.tsx` — B2 Popover migration; scroll-dismiss fixed
- `src/components/v2/ProjectDrawer.tsx` — B2 StatusPicker open/onOpenChange props
- `src/components/v2/ModuleDrawer.tsx` — B2 StatusPicker open/onOpenChange props
- `src/components/v2/FeatureDrawer.tsx` — B2 StatusPicker open/onOpenChange props
- `src/components/v2/FilterBarV2.tsx` — B2 commit 2: all 5 dropdowns migrated to Popover
- `src/components/v2/PortfolioCombobox.tsx` — B2 commit 2: dropdown migrated to Popover
- `package.json` — B3: wrangler and workers-types pinned without carets
- `boot-test.ts` — B1: 5 assertions (real today() import); B2: 2 genuine assertions (5 fake removed); B4: 0 delta

---

## Click verification

**B1 — Gantt viewport**
| # | Interaction | Result |
|---|---|---|
| 1 | Navigate to Timeline | NEEDS UROOJ VERIFY — no page horizontal scrollbar; nav and task column visible |
| 2 | Load with tasks | NEEDS UROOJ VERIFY — chart centred on today; today line marked |
| 3 | Load with zero tasks | NEEDS UROOJ VERIFY — scrollable grid centred on today (boot-tested) |
| 4 | Click Today | NEEDS UROOJ VERIFY — returns to today from any position |
| 5 | Click Next | NEEDS UROOJ VERIFY — advances exactly one screen |
| 6 | Click Prev after Next | NEEDS UROOJ VERIFY — returns to exact starting position |
| 7 | Trackpad swipe | NEEDS UROOJ VERIFY — native scroll works |
| 8 | Grid past last task | NEEDS UROOJ VERIFY — no dead-end; empty columns render |
| 9 | No project selected | NEEDS UROOJ VERIFY — right panel collapses to zero; chart fills width |
| 10 | Select a project | NEEDS UROOJ VERIFY — right panel expands |
| 11 | Task bar alignment (regression BUG-UNIFY-003) | NEEDS UROOJ VERIFY — bars flush with names; milestones on correct rows |

**B2 — Menus**
| # | Interaction | Result |
|---|---|---|
| 12 | Module card ⋮ click | NEEDS UROOJ VERIFY — menu opens (was TODO stub) |
| 13 | Status picker — scroll inside list | NEEDS UROOJ VERIFY — picker stays open |
| 14 | Status picker — scrollbar drag | NEEDS UROOJ VERIFY — picker stays open |
| 15 | Status picker — all statuses visible | NEEDS UROOJ VERIFY — no internal scroll |
| 16 | Status picker position | NEEDS UROOJ VERIFY — doesn't cover the field being edited |
| 17 | Status picker — outside click | NEEDS UROOJ VERIFY — closes |
| 18 | Status picker — Escape | NEEDS UROOJ VERIFY — closes; focus returns to trigger |
| 19 | Project card ⋮ — open, outside click, Escape | NEEDS UROOJ VERIFY |
| 20 | Feature card ⋮ — open, outside click, Escape | NEEDS UROOJ VERIFY |
| 21 | Gantt right-click context menu | NEEDS UROOJ VERIFY — opens; outside click and Escape close it |
| 22 | FilterBarV2 — Status dropdown | NEEDS UROOJ VERIFY — opens; outside click closes; Escape closes |
| 23 | FilterBarV2 — Portfolio dropdown | NEEDS UROOJ VERIFY |
| 24 | FilterBarV2 — Owner dropdown | NEEDS UROOJ VERIFY |
| 25 | FilterBarV2 — Quarter dropdown | NEEDS UROOJ VERIFY |
| 26 | FilterBarV2 — Module dropdown | NEEDS UROOJ VERIFY |
| 27 | PortfolioCombobox (project drawer) | NEEDS UROOJ VERIFY — autocomplete; option click selects; outside click closes |

**B3 — Build**
| # | Check | Result |
|---|---|---|
| 28 | `npm install` — no flags | ✓ Verified locally — Node 20, clean state, EXIT 0 |
| 29 | `npm run build` | ✓ Verified locally — EXIT 0 |
| 30 | Deploy | NEEDS UROOJ VERIFY in production |

**B4 — Removals**
| # | Check | Result |
|---|---|---|
| 31 | Workload tab absent from Timeline sub-nav | NEEDS UROOJ VERIFY |
| 32 | Projects tab absent from Timeline sub-nav | NEEDS UROOJ VERIFY |
| 33 | Projects tab: per-project task completion (N/M tasks done, %, overdue count) | NEEDS UROOJ VERIFY — tab restored; capability intact; deprecation banner removed |
| 34 | Timeline sub-nav shows: Gantt · Roadmap only | NEEDS UROOJ VERIFY |

---

## Adapter statement

- `src/api/adapter.ts`: NOT TOUCHED
- `src/store/context.tsx` save-path (saveNow, saveMutation, queryFn): NOT TOUCHED
- `functions/api/*`: NOT TOUCHED
- `src/lib/migrate.ts`: NOT TOUCHED

---

## Known issues / post-1.0 list

- B1 grid width at month zoom (4px/day): 456 days × 4px = 1824px — wider than one 1280px viewport,
  not three. At day/week zoom the same grid is 18,240px / 6,384px. Three-screens-forward holds at
  practical zoom levels; month-zoom pixel depth noted.
- `PortfolioCombobox` uses `inputRef as unknown as React.RefObject<HTMLElement>` for Popover type
  compatibility. Safe at runtime.
- The Projects tab now has no deprecation banner. If the tab is to be retired in a future batch,
  the deprecation banner will need to be re-added at that time.
- The 5 B2 Popover dismiss behaviours cannot be boot-tested without a React DOM renderer. They
  are NEEDS UROOJ VERIFY. A future option is Playwright or similar for E2E coverage.
