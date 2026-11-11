# Review: Delta Green Character Creation Wizard — Improvements Report

**Revision 2** (2026-11-11) — incorporates `DELTA-GREEN-REVIEW-CORRECTIONS.md`. Changes: **D2 (Unnatural) retracted** — the skill field exists in every supported system schema; new data-safety findings **D8 (JSON restore), D9 (Apply-to-Sheet atomicity), D10 (deselected optional picks persist)**; D1 expanded (current-vs-max resources); D3, D4, C1, C2 corrected per the corrections doc and re-verification against tagged system sources. — **Implementation/live status through rev 2.6 is recorded in §7 blockquotes (rev 2.6: id-preserving rollback with `keepId`/`keepEmbeddedIds`, flattened dot-key field reverts, 26/26 Node suite, v13+v14 forced-failure smoke PASS on the final patch).**
**Scope:** full repo (8 JS files, 1 HBS template, 1 CSS, `module.json`, workflow, README/AGENTS — 6,190 LOC)
**Baseline:** branch `master` @ `3017ba5` ("Add AGENTS.md project context"), synced with `origin/master`, **working tree clean** (no uncommitted changes). Tags: `0.1.0`, `v0.1.1` (mixed convention).
**Date:** 2026-11-11. Reviewer: Hermes agent. Report for developer review; **no code was changed** by this review.

---

## 1. Baseline

**Purpose.** Step-by-step character-creation wizard (9 steps: welcome → stats → profession → skills → bonus skills → bonds → biography → equipment → review) for the Foundry VTT **Delta Green** system (`deltagreen`), plus a DD Form 315 PDF exporter and JSON backup/restore on the agent sheet. Direct port of the DELTA-GREEN-STATS web app (per `AGENTS.md`, data parity with `../DELTA-GREEN-STATS` is the contract).

**Architecture.** No build step, no npm (per `AGENTS.md`). Plain ES modules loaded via `module.json` → `esmodules: ["scripts/main.js"]`:

| File | LOC | Role |
|---|---|---|
| `scripts/main.js` | 260 | Hooks, sheet-bar injection, actor→PDF state, JSON import/export |
| `scripts/wizard.js` | 1,521 | `DeltaGreenChargenWizard extends HandlebarsApplicationMixin(ApplicationV2)`, 9-step state machine, writes to Actor |
| `scripts/constants.js` | 337 | Skill defaults/tooltips, bonus packages, specialty parsing, loadouts |
| `scripts/professions.js` / `bonds.js` / `equipment.js` / `bio-data.js` | 1,270 | Data (parity with DELTA-GREEN-STATS) + random-bio generator |
| `scripts/pdf-export.js` | 307 | DD Form 315 AcroForm mapper (pdf-lib from CDN) |
| `templates/wizard.hbs` | 676 | All wizard steps in one template |
| `styles/module.css` | 1,807 | Dark DG styling |

**Declared compatibility (`module.json:6-16`):** `compatibility.minimum: "13"`, `compatibility.verified: "13"`, **no `maximum`**. `relationships.systems: [{ id: "deltagreen" }]` — **no system version range, no `compatibility` block on the relationship**. No `languages`, no dependencies on other modules, no socket use.

**Delta Green system landscape (verified 2026-11-11 against tagged sources, [package page](https://foundryvtt.com/packages/deltagreen)):**

| System version | Foundry compat | Notes |
|---|---|---|
| 2.0.1 (latest) | **14 – 14 (verified 14)** | JS `TypeDataModel` schema, single `DGAgentSheet` (AppV2); **2.0.0 added the system's own [Character Generation Wizard](https://github.com/deltagreen-foundryvtt/delta-green-foundry-vtt-system/blob/master/CHANGELOG.md)** (PR #400) |
| 1.7.0 | 13 – 14 (verified 14) | Same JS data-model layout as 2.x (tag `v1.7.0` verified) |
| 1.6.6 | 13 – 13 (verified 13) | AppV2 agent sheet era (matches module's `renderDGAgentSheet`/`renderDGAgentSheetV2` hooks; tag `v1.6.6` verified) |

The system's data model (agent statistics/skills/typedSkills/sanity/biography, bond/motivation/weapon/gear items) is consistent across the three tags — one module build can serve all combinations.

**Foundry core landscape:** **v14 is the current stable generation** (14.359 Stable 1, 2026-04-01; 14.370 Stable 12, 2026-11-02 — [release notes](https://foundryvtt.com/releases/14.370)). v13 (June 2025) is the previous generation; the module declares 13 only.

**Build/test commands (from `AGENTS.md`):** no test runner exists. Verification = `node --check scripts/<file>.js`, `python3 -c "json.load(...)"` on the manifest, and scratch Node scripts for logic changes. All of these were run in this review — see §6.

**Data-parity check (this review):** `bonds.js` 399/399 entries identical to source app; `pdf-export.js` field-name strings identical (only notification copy differs); `professions.js` 19/19 keys present, **15/19 byte-identical**; 4 professions (`anthropologist`, `foreign_service`, `intelligence_analyst`, `intelligence_case_officer`) intentionally strip preset subspecialty labels ("Foreign Language (Spanish)" → "Foreign Language"). This divergence is real and sensible for a wizard, but it is **not documented** — `AGENTS.md` requires deviations to be stated.

---

## 2. Assessment (short)

The module is well-built for its niche: a clean AppV2 wizard, correct DG rules math (HP ⌈(STR+CON)/2⌉, WP=POW, SAN=POW×5, BP=SAN−POW, 80% skill cap, 8×+20 bonus picks), correct typed-skill/bond/motivation data-model writes for the **current Delta Green system**, and disciplined adherence to the "no build step" project rule. The data-parity contract with DELTA-GREEN-STATS holds.

The main risks are, in order:
1. **Data safety on existing Agents.** Three independent write paths are destructive and non-atomic (JSON restore, Apply-to-Sheet, optional-pick recalculation). The README explicitly invites users to re-run the wizard on established Agents (`README.md:52`), so these paths sit on the intended happy path, not an edge case.
2. **Confirmed PDF mapping defects** — physical description/wounds/personal details read fields that don't exist, and current values are never distinguished from maxima (D1).
3. **Aging compatibility posture** — Foundry v14 and DG system 2.0.1 shipped while the module declared 13/13 with no system range. The static API audit found nothing proven broken on v14 (C1), so this is a test-and-declare task, not a migration task.
4. **README↔code drift and packaging gaps** (in-wizard PDF export that no longer exists, missing LICENSE, release workflow tag pattern that can't fire).

No runtime testing in Foundry was possible in this environment (no Foundry installation) — findings are from source reading, Node-stub reproductions, and verification against tagged Delta Green system sources; the exact runtime checks to close each item are stated per finding.

---

## 3. Findings — confirmed defects

### D8 · High · JSON restore can destroy actor items/effects and fails non-atomically
- **Files:** `scripts/main.js:203-228`
- **Evidence (code reading; corrections-doc stub reproduction of this handler):**
  - *Empty-list semantics:* `if (parsed.effects?.length)` (`:215`) and `if (parsed.items?.length)` (`:217`) treat an empty array as "skip". Export always writes both arrays (`:190-191`), so `items: []` / `effects: []` is a *legal* export meaning "no items, no effects" — restoring such a backup silently **keeps the destination's existing items/effects** and reports success. The resulting actor is a hybrid, not a restore.
  - *Non-atomic replacement:* existing items are deleted (`:219`) **before** `createEmbeddedDocuments` (`:220`). A throw in create (bad item type, permission loss for a player-owner) leaves the agent stripped of items; the "Import failed" toast follows the destruction.
  - *No confirmation:* one file-dialog click replaces system data, name, img, effects, and all items on the open sheet.
- **Repro (corrections doc, Node + stubbed actor):** backup with `items: []`, `effects: []` → success toast, destination item kept, effects omitted from update. Backup with valid metadata and one un-creatable item → originals deleted, replacement throws, items lost.
- **Fix:** (a) treat presence, not truthiness — `'items' in parsed ? replace : keep` (same for `effects`), matching the v1 export format; (b) validate the whole payload (format marker, `items` array with `type` in a DG allow-list) **before** any write; (c) confirm dialog naming the actor and what will be replaced; (d) create replacements first, delete originals only on success — or snapshot in memory and restore on partial failure; (e) verify player-owner behavior (OWNER rights can still hit permission walls on `effects`/item types).
- **Effort:** 2–3 h. **Benefit:** removes the module's only unrecoverable data-loss path.
- **Confidence:** High. **Verify:** stub matrix — valid restore, empty backup, invalid backup, injected failure during replacement; assert final actor/items/effects after each and after retry. Runtime: matrix restore check with an established Agent carrying bonds, gear, effects (GM + player-owner).

### D9 · High · Apply to Sheet is non-atomic; a failed write strands the Agent mid-update
- **Files:** `scripts/wizard.js:1461-1519` (update → bond delete/create → motivation delete/create → wizard-item delete/create)
- **Evidence (code reading; corrections-doc stub reproduction):** `#applyToActor` runs six sequential write batches. Simulated failure creating a replacement bond: `actor.update` had already landed and the original bond was already deleted — the agent ends with new stats/skills and a **lost bond**. Motivations and wizard equipment can be lost the same way. Mitigating factor: the wizard-state flag is cleared only after `#applyToActor` resolves (`wizard.js:1163-1165`), so a throw preserves the draft for retry — recovery exists by accident, not by design, and does not restore already-deleted items.
- **Repro:** stub reproduction above; in-app equivalent is any permission/quota failure mid-sequence (e.g. player-owner applying, concurrent delete).
- **Fix:** order each replacement create-then-delete (build and validate new bond/motivation/gear payloads first; create, then delete the old ids); on failure, one notification naming the failed section and stating the draft is preserved. For re-runs on established Agents, document in README that bonds/motivations/wizard gear are **replaced** while player-added items are untouched (the `fromWizard` flag scope at `wizard.js:1497-1499` is already correct).
- **Effort:** 2 h. **Confidence:** High. **Verify:** stub matrix (new agent; re-apply to established agent with bonds/gear/effects; injected failure at each of the six write steps → assert no net item loss); runtime matrix applies as GM and player-owner.

### D10 · Medium · Deselected optional profession skills keep their old values
- **Files:** `scripts/wizard.js:1289-1305` (skills recollect); context `1229-1246` (profession change resets `#data.skills` to required skills only), `1371-1374` (the full map is written to the actor)
- **Evidence (code reading; corrections doc reproduced with real handlers + stubbed actor):** on the skills step, selected plain optional picks merge with `skills[sk] = Math.max(skills[sk] ?? 0, s.value)` (`:1304`), but **deselected picks are never removed** — `#data.skills` only rebuilds on profession change. Reproduction: Federal Agent → pick **Accounting** (60) → Back → pick **Computer Science** instead → apply yields `Accounting 60` **and** `Computer Science 50` on the actor while only Computer Science is recorded as selected (and the review step shows both).
- **Impact:** every user who changes an optional pick gets inflated skills — on the intended "re-run to correct a mistake" flow (`README.md:52`).
- **Fix:** tag skill-map entries by origin (required vs `opt:<idx>`) when written; on recollect, drop entries whose pick is gone and re-add required + current picks. The specialty-slot path (`wizard.js:1290`, filter-to-required then re-derive) is the existing pattern to mirror.
- **Effort:** 1–2 h. **Confidence:** High. **Verify:** stub test — pick A, back, pick B → apply → actor has required + B only; A+B both kept → both present; a bonus boost targeting a later-deselected pick is also removed.

### D1 · High · PDF export: physical description/wounds/personal details lost; current values fed to max boxes
- **Files:** `scripts/main.js:90` (`sys.physicalDescription`), `:92` (`bioSys.notes`), `:41-45` (single value per resource), `:102` (`lpNotes` hard-coded empty); `scripts/pdf-export.js:172-178` (MAXIMUM* and CURRENT* fields fed the same values)
- **Evidence:** In system **1.6.6, 1.7.0 and 2.0.1** the agent schema has `system.physical.description` + `system.physical.wounds`, and `system.biography` has **no `notes` field** ([1.6.6](https://github.com/deltagreen-foundryvtt/delta-green-foundry-vtt-system/blob/v1.6.6/module/data/actor/agent.js) · [1.7.0](https://github.com/deltagreen-foundryvtt/delta-green-foundry-vtt-system/blob/v1.7.0/module/data/actor/agent.js) · [2.0.1](https://github.com/deltagreen-foundryvtt/delta-green-foundry-vtt-system/blob/v2.0.1/module/data/actor/agent.js) — all re-verified at tags in rev 2). So PDF sections 10 (Physical Description) and 17 (Personal Details) are always empty from the sheet-bar export. Separately, `hp = sys.health?.max ?? sys.health?.value` and the same single value for WP/SAN are written to both `MAXIMUM…` and `CURRENT…` PDF fields — for an agent who has taken damage, the PDF overstates current HP/WP/SAN.
- **Repro:** create agent, damage it (HP value < max), set Physical Description, Export PDF → section 10 empty, CURRENT HP = MAX HP.
- **Fix:** read `sys.physical?.description` (strip ProseMirror/HTML), map `sys.physical.wounds` → `lpNotes.wounds` ("14 WOUNDS AND AILMENTS_2"); thread `{value, max}` per resource through the state shape and fill the MAXIMUM/CURRENT pairs; keep personal details **blank** — no source field exists in any supported schema (do not invent one).
- **Effort:** ~1 h. **Confidence:** High (schemas read directly at all three tags). **Verify:** export from an established agent with **multiline** description + wounds text and reduced current HP/WP/SAN; check all six MAX/CURRENT boxes and sections 10/14 in the PDF.

### D4 · Medium · Release workflow's tag filter can't fire for the repo's own `v*` tag convention
- **Files:** `.github/workflows/release.yml:5-8` (`tags: ['[0-9]+.[0-9]+.[0-9]+']`), `module.json:31` (download URL uses `v0.1.1`), git tags: `0.1.0` (matches) and `v0.1.1` (does **not** match)
- **Evidence:** GitHub Actions tag filters use glob semantics ([docs](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#filter-pattern-cheat-sheet)); `v0.1.1` fails `[0-9]+.[0-9]+.[0-9]+`. The v0.1.1 release was evidently published by other means (Actions history not inspected — U4).
- **Repro:** Tag `v0.2.0` and push → no "Release" run → `releases/latest/download/module.zip` keeps serving 0.1.1 while `module.json` advertises 0.2.0 → in-app update 404s/version mismatch.
- **Fix:** standardize on `v*`; add trigger `v[0-9]+.[0-9]+.[0-9]+`; in the job assert `module.json.version` == tag (minus `v`) **and** that `module.json.download` points at that tag; unzip the built `module.zip` and assert `module.json` sits at its root. (`v9.9.9-test` intentionally won't match the stable pattern — correct behavior; verify the positive case `v9.9.9` on a fork.)
- **Effort:** ~30 min. **Confidence:** High on glob semantics; the historical claim is Medium. **Verify:** tag a fork `v9.9.9` → workflow runs, asset + URL checks pass.

### D3 · Medium · Point-buy budget (72) not enforced — scope corrected in rev 2
- **Files:** `scripts/wizard.js:1205-1214` (per-stat 3–18 validation only), `templates/wizard.hbs:84-85`, `scripts/wizard.js:116` (pointsRemaining display-only)
- **Evidence/repro:** Stats step, type 18 into all six inputs → "Points remaining: −36" renders, Next accepted, Apply writes 6×18. Randomize totals exactly 72; Roll All is 4d6-drop-lowest.
- **Rev 2 scope correction (per corrections doc):** `README.md:35` explicitly advertises **manual entry** as a third mode alongside point-buy and rolling — a blanket `sum > 72` block would break a documented feature. Fix must track the chosen method (point-buy / roll / manual, set by `randomizeStats` / `rollStats` / first manual edit): enforce 72 only in point-buy mode; preserve manual totals and rolled totals as-is. Any change to manual/roll semantics is an owner decision (Q4).
- **Effort:** ~1 h. **Confidence:** High.

### D5 · Low · README documents wizard features that no longer exist; LICENSE missing
- **Files:** `README.md:46` ("An **Export PDF** button is available on every step of the wizard"), `README.md:82` ("Released under MIT (LICENSE)")
- **Evidence:** The wizard's only nav buttons are Back / Next / Apply-to-Sheet (`templates/wizard.hbs:665-675`); PDF export lives solely on the sheet bar (`scripts/main.js:155-157`). Commit `e61b1ff` removed the in-wizard affordances. **No `LICENSE` file exists in the repo.**
- **Fix:** rewrite the PDF section; add `LICENSE` (MIT text — sibling DELTA-GREEN-STATS repo has one); state the 4-profession preset-label divergence per `AGENTS.md`. **Effort:** ~30 min. **Confidence:** High.

### D6 · Low · Dead code cluster around the removed in-wizard PDF export
- **Files:** `scripts/wizard.js:6` (imports `exportToPDF`, never called), `:471-594` (`#buildPdfState` — zero call sites), `:94,1170-1175` (`applyAndKeep` action, no button), `:573` (`personalDetails: this.#data.biography.notes` — `notes` is not a key of `#data.biography`, always `undefined`)
- **Fix:** delete, **or** re-add the button(s) if intended (owner decision, Q2). `#buildPdfState` is the only code that exports *unsaved wizard progress*; deleting it forecloses cheap re-add of mid-wizard export.
- **Effort:** ~20 min. **Confidence:** High (grep-verified).

### D7 · Low · Wizard-created items carry an unknown `category` key; bar-collapse state leaks across worlds
- **Files:** `scripts/wizard.js:1509` (`{ ...catalogItem }` spreads top-level `category` into `createEmbeddedDocuments('Item', …)` → schema-stripped with console warnings in v12+); `scripts/main.js:22` (localStorage key `dg-wizard-bar-collapsed` is per-origin, shared across worlds/accounts on a Foundry host).
- **Fix:** destructure out `category` before create; namespace the storage key with `game.world.id`. **Effort:** ~15 min. **Confidence:** High.

### D2 · RETRACTED (rev 1) · Unnatural bonus pick is *not* a schema defect
Rev 1 claimed `system.skills.unnatural` is absent from the system schema and the pick is silently dropped. **That was wrong.** The skills schema in `human-skills.js` — the file rev 1 cited for typed skills — defines `unnatural: new SchemaField({ proficiency, label: "Unnatural" })` as the final entry of `system.skills`, at [1.6.6](https://github.com/deltagreen-foundryvtt/delta-green-foundry-vtt-system/blob/v1.6.6/module/data/actor/base/human-skills.js), [1.7.0](https://github.com/deltagreen-foundryvtt/delta-green-foundry-vtt-system/blob/v1.7.0/module/data/actor/base/human-skills.js#L47) and [2.0.1](https://github.com/deltagreen-foundryvtt/delta-green-foundry-vtt-system/blob/v2.0.1/module/data/actor/base/human-skills.js#L49) (all re-verified at tags in rev 2). The wizard's write path (`wizard.js:1371-1374`, `:1409`) is schema-valid; the pick persists. Root cause of the error: rev 1 extracted the skill-key list from `agent-skill-defaults.js` (a numeric defaults table that omits `unnatural`) instead of the schema in `human-skills.js`.
**Residual open question (owner decision, Q3):** whether Unnatural should be offered as a bonus pick *at all* is a character-creation rules call (the module's own tooltip states it cannot be raised at creation), balanced against parity with DELTA-GREEN-STATS, which offers it. Verify the rule before changing the option. No code defect.

---

## 4. Findings — compatibility risks

### C1 · High · Module declares Foundry 13 only, while v14 is the current stable generation and the DG system has a 14-only release
- **Files:** `module.json:6-9`, `README.md:23`
- **Context:** Foundry 14 Stable shipped 2026-04-01; 14.370 is current. DG system 2.0.1 is **Foundry 14-only**; 1.7.0 covers 13–14; 1.6.6 is the 13-era release. On Foundry 14, Foundry shows a "not verified" warning for this module.
- **Static API audit of every version-sensitive call site** (this review):

| Call site | v13 | v14 | Source |
|---|---|---|---|
| `foundry.applications.api.ApplicationV2` + `HandlebarsApplicationMixin`, `DEFAULT_OPTIONS.actions`, `PARTS`, `_prepareContext`, `_onRender` (`wizard.js:17,74-104,109,599`) | stable | stable | [AppV2 v13 docs](https://foundryvtt.com/api/v13/classes/foundry.applications.api.ApplicationV2.html) |
| `render{ClassName}` hooks for AppV2 sheets (`main.js:241-242`) | stable, class-name based | stable | [v14 renderApplicationV2](https://foundryvtt.com/api/v14/functions/hookEvents.renderApplicationV2.html) |
| `new Roll('1d6')` + `await evaluate()` + `.total` (`wizard.js:1041-1043`) | works | works (documented example pattern) | [v14 Roll docs](https://foundryvtt.com/api/classes/foundry.dice.Roll.html) |
| `foundry.applications.ux.FormDataExtended` (`wizard.js:1095,1201`) | stable | stable | v12+ namespace |
| `foundry.applications.apps.FilePicker.implementation` + `.browse()` (`wizard.js:1185-1192`) | stable | namespaced and documented ([v14 FilePicker#implementation](https://foundryvtt.com/api/v14/classes/foundry.applications.apps.FilePicker.html#implementation)); AppV1 shim removal tracked for v15/16 (C4) |
| `actor.setFlag/getFlag/unsetFlag`, `update`, `createEmbeddedDocuments`, `effects.map(toObject)` | stable | stable | core doc APIs |
| `CONFIG.Actor.sheetClasses.agent` (`main.js:247`) | see C2 | see C2 | — |

  Nothing in the audit is *proven broken* on v14; the risk is untested surface (windowing, ProseMirror-adjacent CSS, DG 2.x sheet internals).
- **Support policy (adopted from corrections doc):** **one module release serves Foundry 13 and 14** — single ZIP, single `module.json`; the installed Delta Green system version differs by Foundry generation. Keep `minimum: "13"`; raise `verified` to `"14"` **after** both primary combinations pass. Base the minimum system version on the **oldest release actually tested/verified** — 1.6.6 in this matrix (rev 1's `1.6.1` proposal withdrawn: never established).
- **Test matrix protocol** — per cell: module install, sheet buttons (appear **once**; survive a sheet re-render), full wizard run incl. **draft resume** after close, Apply to Sheet, portrait selection, PDF export, JSON restore. **Run each cell as GM and as a player who owns the Agent.** Include an established Agent with bonds, gear, and effects in restore/apply checks. Record exact Foundry build + system release per cell.

| Foundry \ system | 1.6.6 | 1.7.0 | 2.0.1 |
|---|---|---|---|
| **13.x stable** | ✅ Primary v13 combination | test if 1.7.0 support is to be documented | ❌ N/A (system is 14-only) |
| **14.x stable** | not planned | test if 1.7.0 support is to be documented | ✅ Primary v14 combination |

- **New overlap to evaluate (2.x):** DG 2.0.0 added the system's **own Character Generation Wizard** ([CHANGELOG PR #400](https://github.com/deltagreen-foundryvtt/delta-green-foundry-vtt-system/blob/master/CHANGELOG.md)). On Foundry 14 + system 2.0.1 both entry points coexist — check how they appear together and use the comparison to position this module on v14 (emphasize DD Form 315 PDF export, JSON transfer, DELTA-GREEN-STATS-parity data) **after** verifying the actual overlap. ~2 h evaluation.
- **Tradeoff:** staying 13-only strands most current users (ecosystem moved to 14 in April 2026); a bare `verified: 14` without the matrix is the risky middle. The audit says risk concentrates in DG 2.x interactions, not core APIs.
- **Confidence:** High on version facts; Medium on "v14 runs cleanly" (no runtime test — F1–F6).

### C2 · Medium · Sheet-bar injection resilience — verify before changing (rev 2 reframe)
- **Files:** `scripts/main.js:241-259`
- **Rev 1 position corrected:** rev 1 proposed a registry fallback (`CONFIG.Actor.documentTypes?.agent?.sheetClasses`) because `CONFIG.Actor.sheetClasses` was relocated in v12. That registry path is **not verified for v13/v14** and should not be coded ahead of evidence. The primary mechanism — the two render hooks — is documented and current ([v14 renderApplicationV2](https://foundryvtt.com/api/v14/functions/hookEvents.renderApplicationV2.html)); the code already uses the namespaced APIs v14 documents.
- **Test first (F4):** on each matrix cell and each registered agent sheet: (a) the wizard bar renders **exactly once** on first render, (b) renders **once after a re-render** (open sheet → Apply → reopen), (c) appears on every registered agent sheet option. The startup line "Patched N agent sheet class(es)" counts prototype patches only — it is **not** evidence the bar appears, and rev 1 used it as a proxy in error.
- **Only if a cell shows a missing/duplicated bar:** implement a targeted fix then (modern registry lookup for the patch loop, dedupe guard around `content.prepend(bar)`). **Confidence:** High on hook docs; the fallback-path proposal remains unverified (U3).

### C3 · Medium · pdf-lib is fetched from the unpkg CDN at runtime
- **Files:** `scripts/pdf-export.js:31`
- **Evidence/risk:** every PDF export needs `https://unpkg.com/pdf-lib@1.17.1/…`. Breaks: offline play, LAN-only/air-gapped servers, restricted networks, unpkg outages; supply-chain trust shifts to unpkg. Self-hosted Foundry's CSP permits external `https:` scripts (the web-app original ships the same pattern), so it *works*; CSP behavior on hosted/sandboxed Foundry environments was **not verified** (U2).
- **Fix:** vendor `pdf-lib.min.js` (~500 KB, MIT) as `scripts/vendor/pdf-lib.min.js` and point the URL constant at the module asset (keep the constant so sync with the web app stays mechanical). A committed file respects the no-build rule. **Effort:** ~20 min. **Confidence:** High.

### C4 · Low · Forward-compatibility watch items (v15/16)
- Legacy AppV1 shims (e.g. `foundry.applications.apps.FilePicker`) are removal-tracked around v15/16 ([v14 migration guide](https://github.com/mordachai/vagabond/blob/main/FOUNDRY_V14_MIGRATION.md)); the portrait picker will need a namespaced replacement then. The v14-documented `FilePicker.implementation` path is current today — no action now.
- Foundry v14 deprecates `dependencies` in favor of `relationships` — already compliant.
- Wizard state lives in actor flags (`wizard.js:61-71`), broadcast to every client. Fine at this payload size; two users editing the same agent's wizard race each other (last write wins). Document, don't engineer, for now.

---

## 5. Findings — optional enhancements

1. **E1 · Accessibility** (`templates/wizard.hbs:398-422`, `styles/module.css`): bond name/score/relationship inputs have placeholders only; only one `:focus` rule in 1,807 CSS lines — verify keyboard focus in the dark theme; progress dots carry `title` tooltips suggesting interactivity they don't have. ~2 h.
2. **E2 · HTML-escape user-supplied strings** (`wizard.js:1005-1008`): custom equipment names interpolated into `innerHTML` unescaped (self-XSS via crafted loadout JSON). `textContent`-based row builder, ~30 min.
3. **E3 · Tiny pure-function test harness**: `scripts/dev/checks.mjs` on `node:test` covering `parseSpecialtyFromName/Key`, `getStatDescriptor`, bond-limit parsing, plus **stub-actor fixtures for the D8/D9/D10 write paths** (the corrections doc's stubs show these are cheap — formalize them). Keeps AGENTS' "no runner" rule for shipping code. ~2–3 h.
4. **E4 · Bond scores track CHA**: slots snapshot CHA at creation (`wizard.js:132`); re-sync untouched scores when re-entering the bonds step. ~30 min.
5. **E5 · Localization**: strings hard-coded, `languages: []`. Defer until non-English demand.
6. **E6 · Import hardening** — absorbed by **D8**; use its fix list (includes type allow-list + confirm dialog).

---

## 6. Runtime validation performed, and required follow-ups

**Executed in this review (host: Linux, Node v26.7, no Foundry available):**

| Command / check | Result |
|---|---|
| `node --check scripts/*.js` (all 8) | **all OK** (AGENTS.md check #1) |
| `python3 -c "json.load(open('module.json'))"` | **valid** (AGENTS.md check #2) |
| `git status` / `git tag` | clean tree @ `3017ba5`; tags `0.1.0`, `v0.1.1` |
| Data-parity scripts (professions/bonds/pdf-map vs `/storage/Projects/DELTA-GREEN-STATS`) | bonds 399=399; PDF fields identical; professions 15/19 identical, 4 intentional divergences |
| DG system schema extraction at **tags** `v1.6.6`, `v1.7.0`, `v2.0.1` (+ master): `agent.js`, `human-skills.js`, item models, typed-skill mixin, profession groups | module writes match; D1 field paths confirmed absent/renamed at all three tags; **D2 retraction established here** (`skills.unnatural` present at all three); `physical.description`/`wounds` present, biography has no `notes` |
| DG CHANGELOG | 2.0.0 adds system-side Character Generation Wizard (PR #400) |
| Version research | Foundry 14.370 current; system 2.0.1 = F14-only, 1.7.0 = F13–14, 1.6.6 = F13 ([package page](https://foundryvtt.com/packages/deltagreen)) |
| Corrections-doc reproductions (JSON restore, bond-create failure, optional-pick swap) | mechanisms independently confirmed by code reading at the cited lines in rev 2; the stub runs themselves were performed by the corrections author, not re-executed here (U7) |

**No Foundry installation exists in this environment — zero runtime cells of the matrix in C1 were executed.** Follow-up checks (~15–30 min each on a local Foundry install + DG system), per the matrix protocol in C1:

- **F1** Foundry **13.x** + system **1.6.6** — full protocol (GM + player-owner, established agent included).
- **F2** Foundry **14.x** + system **2.0.1** — same, plus dual-wizard coexistence evaluation (C1).
- **F3** Foundry **13.x/14.x** + system **1.7.0** — only if 1.7.0 support is to be documented.
- **F4** In F1/F2: bar renders once on open **and after re-render** on every registered agent sheet (decides C2); record console for module-emitted deprecation warnings (`CONFIG.debug.hooks = true` for hook coverage).
- **F5** In F2: D1 verification — established agent with multiline physical description, wounds, reduced current HP/WP/SAN → PDF check of all MAX/CURRENT boxes and sections 10/14.
- **F6** In F1/F2, GM **and** player-owner: Apply to Sheet on an established agent (bonds/gear/effects present) and JSON restore of an existing-agent backup → confirms D8/D9 fixes.
- **F7** After fixes: re-run the D8/D9/D10 stub harness (E3) and keep it in the repo.

---

## 7. Suggested implementation order

| # | Item | Effort | Depends on |
|---|---|---|---|
| 1 | **Data safety:** D8 (restore semantics + atomicity + confirm), D9 (create-then-delete ordering, failure messaging) | 4–5 h | stub harness (F7) |
| 2 | **Correctness:** D10 (optional-pick recalc), D1 (PDF field paths + current/max pairs) | 2–3 h | F5 to verify D1 |
| 3 | **Release & docs:** D4 tag filter + manifest/ZIP validation, D5 README rewrite + LICENSE + parity-divergence note, D6 dead-code decision, D7 minor keys, C3 vendor pdf-lib | 2 h | Q2, Q5 |
| 4 | **Matrix & manifest:** run F1–F6 (incl. dual-wizard evaluation), then set `verified: "14"`, system relationship range from oldest tested, README requirements section, v14 feature positioning | 1 day | Q1 |
| 5 | **Polish:** E1, E2, E3, E4 | 0.5–1 day | — |

Commit each numbered row as focused commits (AGENTS.md style); bump `module.json.version` once for the user-visible batch and tag per the convention fixed in step 3.

> **Status 2026-11-11 (rev 2.1):** rows 1–3 implemented + stub-verified on branch `experimental/review-fixes` (D8, D9, D10, D1, D3 method-tracking, D4, D5, D6 = removed dead code, D7, C3 vendored pdf-lib, E2 escaping; version bumped 0.1.2). Row 4 (matrix F1–F6, `verified: 14`, system range) intentionally NOT done — needs a Foundry install. Row 5 remainder (E1, E3 formal harness, E4) not done. License: README's "MIT" claim was wrong — source DELTA-GREEN-STATS is **PolyForm Noncommercial 1.0.0**; LICENSE added as PolyForm NC (owner to confirm, Q5).

> **Runtime results 2026-11-11 (rev 2.2) — F2 COMPLETE on Foundry 14.370 + DG 2.0.1 (LAN server):** full wizard → apply (stats, skills incl. specialty boosts, motivation + 8 gear items, derived HP/WP/SAN/BP, flag cleared, 0 console errors); **D10 confirmed on a live sheet** (mid-run pick swap: dropped skill reverts to base, new skill applied); **D1 confirmed end-to-end** (DD Form 315 PDF contains `system.physical.description`, `wounds` → field `14 WOUNDS AND AILMENTS_2`, name/employer/stats/skills/derived all correctly filled — the module's PDF export works on 2.0.1); JSON export → mutate → restore roundtrip restores exactly; **D8 rejections live-verified** (wrong `_format`, truncated JSON, string `system` — each errors with a specific message, actor untouched). Two live-only defects found and fixed (commit `2143a1c`): (a) DG 2.x sheets grid the window-content, so the prepended bar auto-placed at the bottom — bar now mounts on the window frame when content is grid; (b) Foundry ≥13 `DialogV2.confirm` resolves to `'yes'/'no'` strings, so the old truthiness check **proceeded with the restore even when the user clicked No** — answer now normalized. `verified: "14"` set. **F1 (v13 + 1.6.5) and F3 (v13 + 1.7.0) still open** — v13 cells use the same APIs that passed, but 0.1.2 has no v13 runtime run yet. Test lesson: verify AcroForm fills by field NAME (`form.getTextField(name).getText()`); filtering by `constructor.name === 'PDFTextField'` silently matches nothing against the minified vendored pdf-lib and produced a false "blank PDF" alarm during this session.

> **F1 COMPLETE 2026-11-11 (rev 2.3) — Foundry 13.351 + DG 1.6.5 (dedicated `delta-green-test` world, user-named):** 0.1.2 active; bar at y=45 via classic prepend (grid-frame path correctly scoped to 2.x sheets); wizard full walk → apply persisted (37 skills incl. boost chains, typed `Foreign Language (Spanish)` slot, derived HP/WP/SAN/BP, flag cleared); PDF export fills 60 fields correctly (verified offline by field name, incl. distinguishing features and specialty overflow slots); JSON export → mutate → confirm → restore exact (v13's confirm dialog path verified with the normalized answer); D8 rejections 3/3 (format/truncated/system-string), actor untouched. **PDF/asset deployment pitfall (test-infra, not module):** a deploy that omits `assets/` makes the template 404 — v13 + cloud browser crashed the tab on export; always ship `assets/` with the module.

> **Recovery-bug fixes 2026-11-11 (rev 2.5) — commits `25d389b` + `afa8071`, 0.1.2 RC.** Two data-loss defects, both reproduced first with stubbed-Foundry Node checks against the ACTUAL handler code (restore handler extracted verbatim from `main.js`; wizard apply driven via the real class), then fixed: (1) **JSON restore** — the recovery snapshot captured only name/img/system, so a restore of `effects: []` + items that failed at item creation **permanently destroyed the original active effects** while the dialog claimed a rollback. Snapshot now captures items (incl. their effects) and active effects; recovery deletes created items, recreates deleted originals, reverts fields, and **verifies content equality before claiming "rolled back"**; incomplete recovery reports exactly which pieces may have changed (verified: state changed + INCOMPLETE named "fields/active effects not reverted"). (2) **Apply to Sheet** — sections committed independently, so a failed motivation create left the bond replacement and all actor-field writes in place under a message claiming items were preserved. The item phase is now one transaction with verified rollback; wizard draft kept (flag cleared only on success); **retry after rollback verified duplicate-free** (old ids recomputed from restored sheet; wizard-flagged gear replaced, not stacked). 24-check Node suite: success (incl. empty-array clearing semantics), create-fails, delete-fails, delete-applied-then-fails (recreation path), recovery-fails, retry, No-click zero writes, validation pre-dialog. **Live-found bug in the first fix iteration:** `Item#toObject()` carries `_id`, not `id` — the lost-item filter matched nothing and recovery needlessly recreated everything; live v13 smoke caught it, stub `toObject()` made faithful (`_id`), suite extended. **v13 live smoke (delta-green-test, disposable `SMOKE v13`): all PASS** — No-click = zero writes; repro scenario (create injected-fail mid-restore) → honest full-rollback warning, items/name intact; apply-mid-fail (motivation create injected) → bond/motivation recovered, stats reverted, draft kept; clean retry → exactly one bond (60) + one motivation, derived stats applied, draft cleared. **v14 live smoke: BLOCKED by environment** — the cloud automation browser's tab crashes during DG 2.0.1 client init (3/3 joins since ~13:10; earlier today identical joins were fine; served module bytes md5-identical to repo). v14 module activation previously F2-verified; the changed code paths are Foundry-version-agnostic and now v13-live-verified. Limitations: recovered/recreated documents get new ids (Foundry regenerates; content-verified comparison accounts for it); v13 sheet shows a display-value flash of applied stats mid-apply (render artifact; base data verified reverted).

> **F3 (v13 + DG 1.7.0) CLOSED AS INFEASIBLE 2026-11-11 (rev 2.4) — system-side, not module-side.** Installed DG 1.7.0 into the v13 container: the world row became non-launchable and every launch click silently no-oped (the setup app's click handler returns early on non-launchable rows; server log never received a launch). Root cause: **DG 1.6.6+ ships v14-format systems — no `template.json` and no `template` key in `system.json`** (replaced by `documentTypes`); v13.351's manifest validation rejects them, so the `compatibility: {minimum: "13"}` metadata on 1.6.6/1.7.0 is aspirational. Verified against release assets: v1.6.5 (2026-02) is the **last v13-installable DG release**; v1.6.6, v1.7.0, v2.x all lack the template file. Impact: the compatibility matrix collapses to two real cells — **v13 users can only run DG ≤1.6.5 (module F1-verified ✓), v14 users run 2.0.1 (F2-verified ✓)** — and 1.7.0 is not testable on any box, v13 being below its de-facto floor and v14 already covered by F2. Rolled back to 1.6.5; world relaunched; F1 agent data byte-identical (HP 18/18, 37 skills, law 30) — the world never ran on 1.7.0, so no migration touched the data. Lesson for all v13 modules: a system missing `template.json` renders worlds silently non-launchable on 13.x.

> **ID-preserving rollback + verified full-rollback checks 2026-11-11 (rev 2.6) — commits `0413b9a` + `2713fc2`, 0.1.2 RC, both live cells re-run on the final patch.**
>
> *What changed.* Recovery in both JSON Restore (`main.js`) and Apply to Sheet (`wizard.js`) recreates lost items with `createEmbeddedDocuments(…, {keepId: true, keepEmbeddedIds: true})` and reverts actor active effects with `update(…, {keepEmbeddedIds: true})` — pre-existing item/effect UUIDs (compendium references, effect origins, journal links) therefore survive a rolled-back transaction. The flags were confirmed present in the shipped bundles of both containers (Foundry 13.351 and 14.370 `foundry.mjs`). The pre-report verification is **id-strict**: the comparison keys now carry item ids, active-effect ids and effect state, via a key-ordered canonical JSON helper (flatten-revert reorders nested keys, which value-equal `JSON.stringify` misses — this produced false INCOMPLETE reports until fixed).
>
> *Defect found by the requested v14 re-run (live-only, then fixed in `2713fc2`).* Recovery's whole-object `update({system: snapshot.system})` is **silently discarded by DG 2.0.1's preUpdate recompute on Foundry 14**: the update resolves locally (the optimistic client made the comparator pass) while the **server kept the post-apply values** — law 40 / STR 70 / employer MI5 persisted under a "full rollback" message. Isolation in the live console: dot-key updates stick; whole-object `system` reverts are no-ops (and with `{diff:false}` too). Recovery now writes **flattened leaf keys** (exactly the shape a successful apply uses, including the deletion of leaves the apply added, empty-object containers included via a local `flatLeaves`).
>
> *Node suite: 26/26* — success paths, create-fails, delete-fails, delete-applied-then-fails, recovery-fails, No-click, validation, apply success/full-rollback/recovery-fails/retry, wizard gear re-apply — now with id-strict rollback, recreated-with-original-ids, and **UUID-set equality across forced failures** (harness honors keepId/keepEmbeddedIds).
>
> *v14 live smoke on the final patch (bytes md5-identical to repo; served on 14.370 + DG 2.0.1):* **restore + forced create-failure** → honest "rolled back" warning, all 4 item ids identical, name/fields intact, and **every item UUID resolves** (verified from a fresh join; mid-session `fromUuid` misses were a stale client index, server state healthy). **Apply + forced failure mid-transaction** → bond recovered with its **original id**, `fromUuid` resolves, score 55, and law/STR/employer reverted **on the server** (the bug class the v14 re-run was designed to catch); wizard draft kept. **Clean retry** → "ready for fieldwork", exactly one bond (Sarah/60), motivation swapped, gear added, draft flag cleared, no duplicates. Earlier "v14 join crashes" were environmental: the headless viewport was below Foundry's 1024×768 minimum; at 1280×900 the world joins in ~6 s with 0 module errors.
>
> *v13 live smoke re-run on the final patch (DG 1.6.5, byte-identical deploy):* **restore + forced failure** → honest full-rollback, ids identical, all UUIDs resolve, name/fields intact. **Apply + forced failure** → bond kept its id (`fromUuid` resolves, score 55), **law/STR/employer all reverted live**, draft kept. **Clean retry** → apply succeeds, bondCount 1, no duplicates, draft cleared. Bonus evidence for the strict comparator: during seeding a harness race left the client's item collection stale, and the id-strict check correctly reported **INCOMPLETE** ("state does not match the pre-restore state") instead of falsely claiming a rollback — the honesty mechanism catching a real divergence, from its own test harness.
>
> *System limitation (documented, not module-side):* both DG 1.6.5 and DG 2.0.1 **strip `ActiveEffect` sub-documents from agent sheet item types** (bond/motivation/gear create with `effects:[…]` is rejected or emptied; actor-level effects are also stripped on agents), so live item-effect-UUID preservation is not exercisable on this system — it is covered by the Node suite's effect-id/UUID-set assertions. Live runs cover item-UUID preservation and effect-state preservation (the empty set, which stays intact).

> **0.1.3 persistent-build + diff-apply, player-ownership live matrix 2026-11-11 (rev 2.7) — working-tree wizard changes, tested as a regular **player** owning a disposable Agent on both test worlds. ALL 5 FLOWS PASS on both cells.**
>
> | Flow | Foundry 14.370 + DG 2.0.1 | Foundry 13.351 + DG 1.6.5 |
> |---|---|---|
> | 1. Fill wizard, close before applying, reopen | **PASS** — reopened at Review, all choices (stats, profession, bonus picks, bonds, bio, gear) intact | **PASS** |
> | 2. Apply, reload Foundry, reopen wizard | **PASS** — opens at Review ("Apply Changes", saved-choices hint), choices intact, `wizardApplied` set, draft cleared | **PASS** |
> | 3. Apply again, nothing changed | **PASS — ZERO actor writes** (instrumented `Actor.prototype.update/create/delete/update/setFlag/unsetFlag`: 0 calls) | **PASS — ZERO writes** |
> | 4. Change employer only (with HP damaged to 7/12) | **PASS** — exactly 2 writes (`system.biography.employer` + applied flag); HP stayed **7/12**, WP/SAN/BP, law/firearms, bond ids+scores, item count and hand-added **Manual Charm** all untouched | **PASS** — 2 writes, same invariants held |
> | 5. Replace one wizard item (Knife → Ordinary binoculars) | **PASS** — old removed, replacement exactly once, Manual Charm untouched, HP damage preserved; net write = 1 create + 1 delete + flag | **PASS** — 1 create + 1 delete + flag |
>
> Supporting observations: (a) the **rebuild confirm dialog** fires for a player's pre-built agent with no saved build (existing sheet data is not silently clobbered) and applies on Yes; (b) a no-change Apply that follows in-session draft edits writes only the flags (draft-cleanup `-=wizardState`), verified byte-identical `wizardApplied` payload — not a sheet write; (c) one intermittent 3-create/3-delete churn was observed on v14 during a mid-session equipment swap — sheet outcome stayed correct (old gone, replacement once, hand-made items untouched) and the identical swap re-ran 1/1 clean on v14 and v13; logged as an open (cosmetic, write-amplification-only) item. (d) The intermittent **"items is undefined" from the earlier GM run did not recur** across 5 full player flows × 2 environments (~12 applies, wizard opens from cold flag state each time) in this session — not reproducible, no stack captured; the flow that would trigger it is unknown; re-instrument at next sighting.
>
> **Manifest v12:** `compatibility` declares `minimum: "13", verified: "14"` — **the manifest makes no v12 claim**; v12 is out of scope and untested (marked unverified).
>
> Test infra: disposable `TestPlayer` (role Player) + `P14 Agent`/`P13 Agent` (player-owned, hand-added gear) created per world and **deleted after the run**; both worlds restored to pre-test actors/users; container module files restored byte-identical to the committed HEAD.

> **JSON Restore × saved wizard builds — fixed and live-verified 2026-11-11 (rev 2.8). Player-owned Agent on both cells; 3/3 scenarios PASS each.**
>
> Defect: JSON export dropped the wizard flags and item ids; restore recreated every item with a new id, so the applied build's `itemIds` pointed at deleted documents. A wizard swap after a restore deleted the phantom old ids and **left the restored item on the sheet** (reproduced: Knife survived a Knife→Binoculars swap).
> Fix (`scripts/main.js`): export embeds `_wizard` (applied build + draft) and per-item `_id`/`_fromWizard` metadata; restore creates fresh documents, **remaps the applied build's item ids** onto them, re-tags wizard-created items, and writes the remapped flags. Backups without `_wizard` (older exports) stay readable and **clear stale wizard state** so the wizard starts fresh on the restored sheet. The failure rollback also reverts wizard flags, and the snapshot-verification includes them.
>
> | Scenario (as Player) | Foundry 14.370 + DG 2.0.1 | Foundry 13.351 + DG 1.6.5 |
> |---|---|---|
> | Apply Knife build → export → restore → reopen wizard | **PASS** — new Knife id remapped into `wizardApplied.itemIds`, `fromWizard` tag restored; wizard opens at Review with choices | **PASS** |
> | Swap Knife → Binoculars after restore | **PASS** — Knife 0, Binoculars exactly 1 (tracked+tagged), Manual Charm untouched | **PASS** |
> | Older backup (no `_wizard`) | **PASS** — wizard flags cleared, wizard opens at Welcome, gear survives | **PASS** |
> | Forced restore failure (injected delete throw) | **PASS** — full rollback: item ids byte-identical, system canon-equal, wizard flags unchanged | **PASS** |
>
> Note: a loadout pack that itself contains a Knife makes the swap outcome ambiguous by design (two identical wizard selections — removing one row removes one of them, the other stays tracked). Verified with an unambiguous one-Knife build. "items is undefined" did not recur in this session.

**Open questions for the owner:**

1. **Support policy:** confirm single-release 13+14 policy, `verified: 14` gated on F1+F2, system minimum = oldest tested (1.6.6) — and whether 1.7.0 combinations are documented support or best-effort.
2. **In-wizard PDF export** (D6): keep the removal from `e61b1ff` permanent (delete `#buildPdfState`) or restore the button?
3. **Unnatural bonus pick** (D2 rev 2): keep (DELTA-GREEN-STATS parity) or remove from bonus picks (creation-rule restriction per the module's own tooltip)? Verify the rulebook reading first; no schema change needed either way.
4. **Point-buy** (D3): adopt method-tracking (budget enforced only for point-buy mode), and is 4d6-drop-lowest allowed to exceed 72 by design?
5. **License:** confirm MIT; add the `LICENSE` file README already claims.
6. **v14 positioning** (C1): after F2, how aggressively to differentiate against the system's own 2.x wizard (PDF/JSON emphasis)?
7. **Restore semantics** (D8): confirm the documented contract — export arrays are authoritative, so `items: []` / `effects: []` means replace-with-empty (rev 2 recommendation), missing arrays means leave untouched.

---

## 8. Explicitly good — keep these patterns

- Wizard→system writes for stats (`statistics.*.value` + `distinguishing_feature`), derived (HP/WP/SAN/BP), plain skills (`system.skills.<key>.proficiency` — including `unnatural`, which is schema-valid), typed skills (`{label, group, proficiency, failure}` with groups exactly matching `TYPED_SKILL_TEMPLATE_GROUPS`), bond items (`score`, `relationship`, `description`) and motivation items (`disorder`, `crossedOut`, `disorderCured`) are **all correct against the system data model at 1.6.6, 1.7.0 and 2.0.1** (tags verified independently in rev 2).
- Rules math and caps (80%, 8×+20, bond limit parsed from profession text, optional-pick limit enforcement at `wizard.js:1260`) match the rulebook/source app; the specialty-slot recalculation pattern (`wizard.js:1290`) is exactly the right model for the D10 fix on the plain-skill side.
- Correct v13-native idioms throughout: AppV2 + `HandlebarsApplicationMixin`, static action handlers, `FormDataExtended` in `foundry.applications.ux`, class-name render hooks with jQuery/HTMLElement normalization, wizard-state persistence in actor flags (and state intentionally surviving a failed Apply, which D9's fix should preserve as the recovery hook).
- Discipline about the project's hard rules: no bundler creep, data parity genuinely holds, PDF field map byte-identical to the source app.
- `AGENTS.md` matches reality — the verification commands in it are exactly the right ones and all pass.

## 9. Uncertainties / missing evidence

- **U1:** No Foundry runtime available — every "works on v14" statement is a static-audit conclusion, not a test (F1–F7 close this).
- **U2:** Foundry CSP on hosted (non-self-hosted) environments not verified; C3's motivation (offline/reliability/supply-chain) stands regardless.
- **U3:** The C2 registry-fallback path (`CONFIG.Actor.documentTypes…sheetClasses`) remains unverified for v13/v14 — explicitly not to be implemented before F4 reproduces a failure.
- **U4:** How the v0.1.1 GitHub release/assets were actually produced (workflow trigger cannot have fired for tag `v0.1.1`) — Actions history not inspected.
- **U5:** DG system ≤ 1.4.x (Foundry 11/12, `template.json` era) compatibility out of scope; `minimum: 13` declares those combinations unsupported.
- **U6:** `customSkillTarget`, `armorPiercing`, `isLethal` etc. in `equipment.js` validated against 1.6.6/1.7.0/2.x weapon schemas only.
- **U7:** The D8/D9/D10 stub reproductions were performed by the corrections-doc author (Node + Foundry stubs); this review confirmed the mechanisms by independent code reading at the cited lines and by schema verification, but did not re-execute their harness.
- **U8:** Feature-overlap assessment vs the system's 2.x generation wizard (C1) is a documented task, not yet performed — requires F2 runtime.
