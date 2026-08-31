# DEV DELIVERY REPORT

Scope: Batch A — Remove prioritisation (final)
Baseline: tibbie-input-sweep.zip
Date: 30 Aug 2026

---

## Deployment steps

```bash
# 1. Before deploying — export a backup from production
#    Open Tibbie → Settings → Export backup → verify the JSON opens correctly

# 2. Extract this zip (do NOT extract over the existing folder — see DELETED FILES below)
unzip tibbie-batch-a-ship.zip
cd tibbie-b

# 3. Install and build
npm install
npm run build

# 4. Deploy
npm run deploy
# or: wrangler pages deploy dist --project-name=tibbie --commit-dirty=true

# 5. After deploy — verify
#    Open Tibbie in production
#    Click "Diagnostics ⓘ" in the nav (visible because getV4PruneCount() > 0)
#    Confirm: "Batch A migration ran this session — pruned N scoring field(s) from KV records"
#    Export a fresh backup and confirm no rice, wsjf, mustDo, valueRating, or effortEstimate
#    keys appear in any projectsV2 / featuresV2 / modulesV2 entry
```

---

## DELETED FILES — run before or instead of extracting over an existing folder

If you extract this zip over your existing project folder, these 14 files remain on disk unreferenced. Run these removals manually, or extract into a fresh folder.

```bash
rm src/components/v2/PrioritizeView.tsx
rm src/components/v2/PrioritizeTable.tsx
rm src/components/v2/PrioritizeSection.tsx
rm src/components/v2/PrioritizeJumpBar.tsx
rm src/components/v2/QuadrantView.tsx
rm src/components/v2/RiceEditor.tsx
rm src/components/v2/WsjfEditor.tsx
rm src/components/v2/MustDoModal.tsx
rm src/components/v2/BulkBar.tsx
rm src/components/v2/ValueDots.tsx
rm src/components/v2/SettingsPanel.tsx
rm src/lib/rank.ts
rm src/lib/prioritizeSections.ts
rm src/components/views/HeatmapView.tsx
```

---

## Boot test — arithmetic closed

| Event | Count |
|---|---|
| Baseline (tibbie-input-sweep.zip, runner output) | 213 |
| Removed — B1(5) B3(6) B4(3) C1(6) C2(4) C3(6) C4(3) C5(3) D3(6) Fix10.B(6) M5.1.F(9) Item4(12) | −69 |
| Added — A5 section (first delivery) | +17 |
| First delivery | 161 |
| A5 expanded — deep-equality loop + all-5-key idempotency + key-set assertions | +24 |
| A4.5 added — N in flight | +10 |
| Section 1 corrected — sense inverted, count unchanged | 0 |
| **This delivery** | **195** |

Runner output: **195 passed, 0 failed**. Arithmetic closes.

---

## Type check

Command: `npx tsc --noEmit`
Exit: 0
Output: no output

---

## Summary of changes

**A1 — Prioritise tab and scoring infrastructure removed.** 13 files deleted (see above). Rank pool, RICE/WSJF editors, Must-Do modal, preset system, quadrant view, ValueDots, BulkBar all gone.

**A2 — Workload heatmap removed.** HeatmapView.tsx deleted. Workload tab removed from Workspace sub-nav. WorkspaceView type drops 'heatmap'.

**A3 — Nav: Roadmap · Timeline · Archive.** Prioritise removed from TopView and NAV_ITEMS.

**A4.1 — Backlog reachability.** Pre-existing. Features with `projectId: null` already surfaced in Roadmap Section 3 under a Backlog portfolio group. No action required.

**A4.3 — Saved preset safety.** `paramsToFilter()` silently ignores unknown keys. Presets referencing deleted filter fields (effortSizes, riceMin, riceMax, mustDo, unscored, stale) load without error.

**A4.4 — Export clean.** Roadmap slide export: Top RICE line and effortEstimate chip removed. No gaps.

**A4.5 — N in flight intact.** `LIVE_GROUP_STATUSES` is the only constant driving the chip. Both consumers (`ProjectCard.tsx`, `ProjectDrawer.tsx`) read zero scoring state — the computation always ran on delivery status and child item status, never on rice/wsjf/rank. 10 boot-test assertions verify against the real exported constant.

**A5 — schemaVersion 4 prune migration.** Pure subtraction. Removes rice, wsjf, mustDo, valueRating, effortEstimate from all ProjectV2 / FeatureV2 / ModuleV2 records, and the `framework` key from `workspaceSettings` (container preserved). Unconditional rice/wsjf backfills that ran on every `migrate()` call removed from `migrate.ts` — these would have silently re-added the deleted fields on every subsequent load. `getV4PruneCount()` exported for diagnostics overlay. Idempotent: boot-tested with key-set assertion on both first and second `migrate()` run.

**Boot-test audit.** `simulateMigrate` (local reimplementation of migration logic) deleted; section 1 now calls real `migrate()`. Dead Phase B helper block deleted (`simBuildRankedIds` etc). `rice` stripped from `realShape` fixture. Section 1 assertions corrected: now assert rice absent, not present.

**Diagnostics overlay.** Settings removed from nav (framework was its only content; SettingsPanel.tsx deleted). Overlay renamed "System diagnostics". Batch A prune count surfaces at the top of the panel whenever `getV4PruneCount() > 0` — visible regardless of localMode. "Diagnostics ⓘ" button in nav appears whenever `localMode || getV4PruneCount() > 0`.

**Dead exports removed.** `IN_DELIVERY_STATUSES` and `DELIVERY_EXCLUDED_STATUSES` — no consumers outside filterV2.ts after scoring removal. Both deleted. Their job was rank exclusion; ranking is gone. `LIVE_GROUP_STATUSES` stays — it has two live consumers.

---

## Files

### Deleted (14)
- `src/components/v2/PrioritizeView.tsx`
- `src/components/v2/PrioritizeTable.tsx`
- `src/components/v2/PrioritizeSection.tsx`
- `src/components/v2/PrioritizeJumpBar.tsx`
- `src/components/v2/QuadrantView.tsx`
- `src/components/v2/RiceEditor.tsx`
- `src/components/v2/WsjfEditor.tsx`
- `src/components/v2/MustDoModal.tsx`
- `src/components/v2/BulkBar.tsx`
- `src/components/v2/ValueDots.tsx`
- `src/components/v2/SettingsPanel.tsx`
- `src/lib/rank.ts`
- `src/lib/prioritizeSections.ts`
- `src/components/views/HeatmapView.tsx`

### Modified
- `src/types.ts` — removed RiceScore, WsjfScore, MustDoTag, EffortSize; rice, wsjf, mustDo, valueRating, effortEstimate fields from all entity types; workspaceSettings typed as `Record<string, unknown>`
- `src/lib/filterV2.ts` — fully rewritten; scoring filter state removed; IN_DELIVERY_STATUSES and DELIVERY_EXCLUDED_STATUSES deleted (no consumers); LIVE_GROUP_STATUSES retained; paramsToFilter silently ignores unknown keys
- `src/lib/migrate.ts` — schemaVersion 4 prune migration; unconditional rice/wsjf backfills removed; workspaceSettings.framework default init removed; `getV4PruneCount()` export replaces console.info
- `src/lib/seed.ts` — all scoring fields removed from seed records
- `src/store/context.tsx` — scoring mutations and state removed; dead imports removed
- `src/components/shell/Nav.tsx` — TopView = Roadmap · Timeline · Archive; Settings button removed; "Diagnostics ⓘ" button added (visible when localMode or prune count > 0); overlay renamed, Batch A prune row at top
- `src/App.tsx` — prioritise route removed; SettingsPanel removed
- `src/components/workspace/Workspace.tsx` — HeatmapView removed; heatmap removed from WorkspaceView type and TABS
- `src/components/v2/FeatureCard.tsx` — rewritten; rank/totalScored props removed; no scoring badges; Backlog chip for projectId:null features
- `src/components/v2/ProjectCard.tsx` — rank/totalScored props removed; scoring badges removed
- `src/components/v2/ModuleCard.tsx` — rank/totalScored props removed; effortEstimate chip removed
- `src/components/v2/FeatureDrawer.tsx` — all scoring blocks removed
- `src/components/v2/ProjectDrawer.tsx` — all scoring blocks removed
- `src/components/v2/ModuleDrawer.tsx` — all scoring blocks removed
- `src/components/v2/ModulesSection.tsx` — rankedItemIds removed; rank and Must-Do badges removed
- `src/components/v2/RoadmapView.tsx` — rankedItemIds, rankOf, computeTopRice removed; rank/totalScored/topRiceScore arguments removed from all card call sites
- `src/components/v2/RoadmapExportLayout.tsx` — RICE imports, Top RICE render, effortEstimate chip removed
- `src/components/v2/FilterBarV2.tsx` — all five scoring chip/input groups removed (RICE min/max, Unscored, Stale score, Must-Do, S/M/L/XL); activeCount updated; surviving: Status, Portfolio, Owner, Quarter, Module, On hold, In rework, Blocked tracks, Client timeline
- `src/components/v2/RoadmapBulkBar.tsx` — setStatusBulk, setValueRatingBulk, ValueDots, Set status and Business Value actions removed; Archive and Move to portfolio survive
- `boot-test.ts` — simulateMigrate deleted (real migrate() used); dead Phase B helpers deleted; rice stripped from realShape; section 1 corrected; stub props removed; A4.5 added (10); A5 expanded (41)

---

## Click verification

| # | Interaction | Result |
|---|---|---|
| 1 | Top nav | NEEDS UROOJ VERIFY — Roadmap · Timeline · Archive only; no Prioritise; no Settings |
| 2 | Timeline sub-nav | NEEDS UROOJ VERIFY — no Workload tab |
| 3 | Roadmap loads | NEEDS UROOJ VERIFY — no rank badges, score chips, Must-Do badges |
| 4 | Roadmap filter bar | NEEDS UROOJ VERIFY — no RICE min/max, no S/M/L/XL, no Unscored/Stale/Must-Do |
| 5 | Project drawer | NEEDS UROOJ VERIFY — no scoring editor, no effort buttons, no Must-Do |
| 6 | Feature drawer | NEEDS UROOJ VERIFY |
| 7 | Module drawer | NEEDS UROOJ VERIFY |
| 8 | Roadmap slide export | NEEDS UROOJ VERIFY — no Top RICE line, no effort chip |
| 9 | Feature with no parent project | NEEDS UROOJ VERIFY — Backlog amber chip renders |
| 10 | Load saved filter preset with old scoring keys | NEEDS UROOJ VERIFY — paramsToFilter ignores unknown keys |
| 11 | Edit and save previously-scored project | NEEDS UROOJ VERIFY |
| 12 | Hard-refresh twice | NEEDS UROOJ VERIFY |
| 13 | Archive view | NEEDS UROOJ VERIFY |
| 14 | N in flight chip on live project | NEEDS UROOJ VERIFY |
| 15 | Settings absent from nav | NEEDS UROOJ VERIFY |
| 16 | Diagnostics ⓘ button visible post-deploy | NEEDS UROOJ VERIFY — appears when prune count > 0 |
| 17 | Diagnostics overlay shows Batch A prune count | NEEDS UROOJ VERIFY — row at top of panel, always visible when open |

---

## Adapter statement

- `src/api/adapter.ts`: NOT TOUCHED
- `src/store/context.tsx` save-path (saveNow, saveMutation, queryFn): NOT TOUCHED
- `functions/api/*`: NOT TOUCHED
- `src/lib/migrate.ts`: TOUCHED — schemaVersion 4 prune migration. Idempotent. No console output.

---

## Owner action required (BLOCKING DEPLOY)

Export a backup JSON before deploying. The v4 migration permanently removes scoring fields from KV. The backup is the only recovery path if there is an unexpected edge case in production data.

---

## Known issues / post-1.0 list

- `workspaceSettings?: Record<string, unknown>` — loses type safety on the preserved container. Re-type when settings return.
- Boot-test fixtures use `as any` casts — if a future migration changes the record shape those tests will not catch it. Acceptable in fixtures.
- Batch B not started.
