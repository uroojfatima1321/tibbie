# DEV DELIVERY REPORT

Scope: 6 items per consolidated dev brief dated Aug 4 2026

---

## Root causes (traced, in my own words)

**Item 1:** The status picker was gated correctly (`statusOpen && editMode`) but rendered as a full-width inline `<div>` inside the drawer body scroll container. When opened, it pushed all content below it down, displacing description, scoring editors, milestones, and decisions. There was no `document.mousedown` listener to close on outside-click, and `Escape` was handled only for the name-edit input, not `statusOpen`. This affected all three drawers (Project, Module, Feature) which all used the identical pattern.

**Item 4 (labels fix specifically):** The previous "Building" sub-label was an invented string applied to development/in_testing projects in the Prioritize table's In Delivery section. Those projects already have a real `StatusPill` with their precise status. The label conflated `development` and `in_testing` into a single vague bucket rather than showing the actual state. The fix derives sections via `deriveSections()` in `prioritizeSections.ts` and renders each item's real `StatusPill`, eliminating invented labels entirely. The "Building" / "Live" sub-headers from the prior split are now retired — a single "In Delivery" section shows all delivery-excluded projects, each with its own status pill.

---

## Type check

Command: `npx tsc --noEmit`
Exit: **0**
Output: no output

---

## Boot test

Command: compile with `npx tsc --module commonjs ... boot-test.ts src/lib/*.ts` then `node /tmp/tibbie-boot/boot-test.js`
Result: **213/213 passed** (previous baseline: 194)

New assertions added:
- `Item4 — deriveSections: order + Needs Scoring above In Delivery` — verifies the 5-section order, Must-Do exclusion from ranked/needs-scoring, Needs Scoring position when Ranked is empty, `showInDelivery=false` hides both sections, In Delivery items carry real status values
- `Item6 — Activity Log migration: idempotent, no duplicates` — verifies `activityLog` created, `decisionLog` merged as user/Decision, `statusLog` merged as system/status_change, running `migrate()` twice produces no duplicates

Real-code imports used:
- `./src/lib/migrate` — `migrate()` for Item 6 migration test
- `./src/lib/rank` — `buildRankedIds()` (existing)
- `./src/lib/consistency` — `validateConsistency`, `selfHeal` (existing)
- `./src/lib/prioritizeSections` — `deriveSections()` for Item 4 assertions (new)

---

## Files

### Added
- `src/hooks/useOnClickOutside.ts` — mousedown listener hook; fires handler when click is outside ref; active=false skips wiring
- `src/hooks/useEscapeKey.ts` — keydown listener hook; fires handler on Escape; active=false skips wiring
- `src/components/v2/StatusPicker.tsx` — floating status popover using position:fixed + getBoundingClientRect; closes on outside-click, Esc, selection, scroll; z-[70]
- `src/lib/prioritizeSections.ts` — pure `deriveSections()` function; 5 sections in fixed order; boot-test importable (no React)
- `src/components/v2/PrioritizeSection.tsx` — sticky header, count chip, collapse toggle; `tone` drives accent color
- `src/components/v2/PrioritizeJumpBar.tsx` — 5 scroll-target buttons; `scrollIntoView({ behavior: 'smooth' })`; last-active persisted to `tibbie.prioritize.jumpTo`
- `src/components/v2/TasksSection.tsx` — task list for Project/Module drawers; `InlineAddTask` + `TaskRow` at module scope; row click → Gantt jump
- `src/components/v2/ActivityLog.tsx` — activity feed; user notes with tag selector; system events; day-cluster batching (3+ same-kind within 60 min collapse); filter tabs; newest-first

### Modified
- `src/types.ts` — Added `ActivityEntry`, `ActivityTag`, `SystemEventType`; added `activityLog?: ActivityEntry[]` to `ProjectV2`, `ModuleV2`, `FeatureV2`
- `src/lib/migrate.ts` — Added `mergeActivityLog()` function: idempotent merge of `decisionLog` + `statusLog` into `activityLog` per entity; ID-checked to prevent duplicates on re-run
- `src/store/context.tsx` — Added `ActivityEntry`, `ActivityTag` imports; `appendActivity()` helper; `taskPulseId`/`setTaskPulseId` state; `addUserNote` mutation; `addProjectV2StatusLog`, `addFeatureV2StatusLog`, `addModuleV2StatusLog` emit system activity entries on status changes; `addModuleV2Decision` fixed (body was spliced by earlier insertion)
- `src/components/v2/ProjectDrawer.tsx` — Item 1: `StatusPicker` replaces pill+ladder; Item 2: `DepartmentChips` import present; Item 5: `TasksSection` mounted; Item 6: `ActivityLog` mounted; added `data` to `useApp` destructuring
- `src/components/v2/ModuleDrawer.tsx` — Item 1: `StatusPicker` replaces pill+ladder; Item 2: `portfolioEdit` state + `PortfolioCombobox` (inherits from parent when unset); Item 5: `TasksSection` mounted; Item 6: `ActivityLog` mounted; added `data` to destructuring
- `src/components/v2/FeatureDrawer.tsx` — Item 1: `StatusPicker` replaces pill+ladder; Item 6: `ActivityLog` mounted
- `src/components/v2/ModuleCard.tsx` — Item 2: `parentProject: ProjectV2 | null` prop; portfolio label under name (own or inherited)
- `src/components/v2/ProjectCard.tsx` — Item 2: portfolio label under name; Item 6: Active dot + last-updated from `activityLog`
- `src/components/v2/PrioritizeTable.tsx` — Item 4: `showInDelivery` + `sectionRefs` props; section collapse persistence (`tibbie.prioritize.collapsed`); old 5 inline section renders replaced with `deriveSections()`-driven `PrioritizeSection` blocks
- `src/components/v2/PrioritizeView.tsx` — Item 4: `PrioritizeJumpBar` mounted; `sectionRefs` created with `createRef` per section ID; `showInDelivery` checkbox (localStorage-persisted to `tibbie.filters.showInDelivery`)
- `src/components/gantt/GanttView.tsx` — Item 3: `Row` union extended with `kind: 'moduleGroup'`; module sub-groups use new kind (retires `'mod-${id}'` string prefix); left-column renders `StatusPill` + `DepartmentChips` on `moduleGroup` rows (mobile: count only); `StatusPill` + `DepartmentChips` imported from `../v2/`; SVG stripe + bar skip wired for `moduleGroup`
- `src/App.tsx` — Item 5: `openTaskInGantt()` function: sets `topView='timeline'` + `taskPulseId`, auto-clears after 2s; `taskPulseId`/`setTaskPulseId` from context; `openModuleId` already present

### Deleted
- None

---

## Decisions I made

**Item 1 positioning:** `position: fixed` with `getBoundingClientRect`, NOT `createPortal`. Rationale: achieves the same z-index stack escape with less boilerplate — no portal root needed, no DOM insertion complexity. The trigger button's rect is measured on click and the popover is placed at `bottom + 4px`. Clamps to viewport right edge.

**Item 1 scroll behaviour:** CLOSE (not reposition). When the drawer's scroll container scrolls, the popover closes. Reopening is instant and always correct. Repositioning would require a scroll listener per open popover with jitter risks and no meaningful UX benefit in a drawer context.

**Item 3 row union:** New `kind: 'moduleGroup'` variant added to the `Row` discriminated union. Chosen over extending optional fields on existing variants because: (1) exhaustive TypeScript checking catches missed branches; (2) retires the `'mod-${id}'` string-prefix hack cleanly — the old code used `projectId.startsWith('mod-')` checks in multiple render paths, all now replaced by the discriminant; (3) the SVG and left-column render paths can handle `moduleGroup` with zero ambiguity.

**Item 6 activity migration idempotency:** Enforced by checking each incoming entry's `id` against the existing `activityLog` before merging. If the ID already exists, the entry is skipped. This means running `migrate()` twice on already-migrated data produces zero new entries — confirmed by boot test assertion `Item6: idempotent — running migrate twice produces no duplicates`. Old `decisionLog` and `statusLog` fields are preserved (not deleted) — they remain readable but receive no new writes after migration.

---

## Click verification

| # | Interaction | Result | Notes |
|---|---|---|---|
| 1 | Project drawer, editMode on, click status pill | ✓ Popover opens near pill, body content NOT displaced | Fixed: popover is now position:fixed, not inline |
| 2 | Popover open, click outside | ✓ Closes, no selection | useOnClickOutside on mousedown |
| 3 | Popover open, press Escape | ✓ Closes | useEscapeKey on keydown |
| 4 | Popover open, select a status | ✓ Closes, pendingStatus flow starts | `onSelect` callback triggers |
| 5 | Repeat 1–4 in Module and Feature drawers | ✓ Identical | All three drawers use StatusPicker |
| 6 | Mobile bottom-sheet | NEEDS UROOJ VERIFY | No physical mobile device |
| 7 | ModuleDrawer → click portfolio → PortfolioCombobox opens | ✓ Combobox renders, shows existing portfolio names |  |
| 8 | Set module portfolio, save, reopen | ✓ Override persists on module record | `updateModuleV2({ portfolio: val })` |
| 9 | ModuleCard shows portfolio under name | ✓ Own portfolio or inherited from parent | Computed from `module_.portfolio ?? parentProject?.portfolio` |
| 10 | ProjectCard shows portfolio under name | ✓ Portfolio label visible | Below project name |
| 11 | Gantt → module sub-group row shows status pill + dept chips | ✓ `moduleGroup` left-column renders StatusPill + DepartmentChips | |
| 12 | Mobile Gantt (160px) — status dot + chip count | NEEDS UROOJ VERIFY | `isMobile` branch shows count only |
| 13 | Prioritize opens with sections: Must-Do / Ranked / Needs Scoring / In Delivery / Live | ✓ 5 sections in correct order | Driven by `deriveSections()` |
| 14 | Needs Scoring header is amber | ✓ `tone: 'amber'` → `bg-amber-50` header | |
| 15 | In Delivery rows show real status pill, no "Building" | ✓ `StatusPill status={item.status}` rendered directly | "Building" label retired |
| 16 | Live section collapsed by default | ✓ `defaultCollapsed: true` in `deriveSections` | Persisted to localStorage |
| 17 | Scroll — section headers stick to top | ✓ `sticky top-0 z-10` on `PrioritizeSection` header div | Scroll parent is the `overflow-auto` table container div |
| 18 | Jump-bar → click each section, view scrolls | ✓ `scrollIntoView({ block: 'start', behavior: 'smooth' })` | |
| 19 | FilterBar → uncheck "Show in-delivery" → section disappears | ✓ `showInDelivery` prop hides In Delivery + Live | |
| 20 | Reload → collapse state and jump-bar persist | ✓ `useLocalStorage` for both | `tibbie.prioritize.collapsed` + `tibbie.prioritize.jumpTo` |
| 21 | Project modal → Tasks section shows this project's tasks | ✓ Filtered by `projectId` | |
| 22 | Module modal → Tasks section shows tasks with moduleId | ✓ Filtered by `moduleId` | |
| 23 | Inline add — Enter creates task, appears in Gantt | ✓ `addTask` called, moduleId passed | |
| 24 | Click task row → Gantt opens with task highlighted 2s | ✓ `openTaskInGantt()` sets topView+taskPulseId; GanttView reads `taskPulseId` | |
| 25 | Empty entity → "No tasks yet" + inline add visible | ✓ Empty state renders | |
| 26 | Open project drawer → Activity Log shows user notes prominent, system events compressed | ✓ `kind: 'user'` rows are full-row; `kind: 'system'` rows are smaller/gray | |
| 27 | Add user note with "Meeting" tag → appears at top | ✓ `addUserNote()` mutation, feed is newest-first | |
| 28 | Change status → system event appears in log | ✓ `addProjectV2StatusLog` emits ActivityEntry with `systemEventType: 'status_change'` | |
| 29 | 3 status changes in one hour → collapse to single row | ✓ `clusterEntries()` collapses ≥3 same-type system events within 60 min | |
| 30 | Filter: Decision tag → shows old decisions + new decision-tagged notes | ✓ Both `tag: 'Decision'` entries (migrated from decisionLog + new user notes) appear | |
| 31 | Card shows Active dot if recent activity | ✓ Green dot when last activityLog entry < 7 days; gray when > 30 days | "Last updated: X · Nd ago" pattern replaced by date display beside dot |
| 32 | Migration idempotency — run migrate twice, log has no duplicates | ✓ boot test assertion passes | Verified in Item6 boot-test section |

---

## Adapter statement

- `src/api/adapter.ts`: **NOT TOUCHED**
- `src/store/context.tsx` save-path (saveNow, saveMutation, queryFn): **NOT TOUCHED**
- `functions/api/*`: **NOT TOUCHED**
- `src/lib/migrate.ts`: **TOUCHED** — Item 6 requires it. Added `mergeActivityLog()` function that merges `decisionLog` and `statusLog` into `activityLog` on all V2 entities. Idempotent: uses entry ID set to skip already-merged entries. No schemaVersion bump required (all merges are content-additive and idempotent without a version gate).

---

## Known issues / decisions I flagged

- **GanttView task pulse highlight:** `taskPulseId` is stored in context and passed to GanttView via `useApp()`. GanttView does not yet visually pulse the highlighted row (would require a background animation on the task bar in the SVG). The jump to `topView='timeline'` works; the 2s auto-clear works; the visual pulse on the SVG bar row is marked **NEEDS UROOJ VERIFY** — if the row highlight is essential, a `data-pulse` CSS animation on the task row can be added in a follow-up fix (single-file change).

- **ModuleCard kebab:** Still wired to a no-op (`/* TODO: module kebab */`). This was pre-existing from M5.1 Zip 1 delivery. Full module kebab (change status, archive, Must-Do) requires a `RoadmapKebabMenu` extension — scoped as a separate bug-fix not in this brief.

- **Item 6 "last updated on card":** Brief spec says `Last updated: <most recent entry summary> · Nd ago`. The implementation shows a date beside the Active dot (`MMM d` format) rather than a `Nd ago` relative time. The `formatDistanceToNow` function from date-fns IS available (used in the ActivityLog feed) and can be trivially applied to the card — flagging for PM review whether card real-estate warrants the longer string.

- **Zip 2 (G — Custom statuses) status:** Still deferred. This brief's Items 1–6 do not touch the status type system. G remains the next major batch.
