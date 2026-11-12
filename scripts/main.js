import { DeltaGreenChargenWizard } from './wizard.js';
import { exportToPDF } from './pdf-export.js';

// ---------------------------------------------------------------------------
// Handlebars helpers
// ---------------------------------------------------------------------------
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('lt', (a, b) => a < b);
Handlebars.registerHelper('multiply', (a, b) => Number(a) * Number(b));
Handlebars.registerHelper('inc', (n) => n + 1);
Handlebars.registerHelper('range', (start, end) => {
    const result = [];
    for (let i = start; i < end; i++) result.push(i);
    return result;
});

// ---------------------------------------------------------------------------
// Inject wizard button into the DG agent sheet header (Foundry v13 / AppV2)
// DGAgentSheet and DGAgentSheetV2 are AppV2-based, so Foundry fires
// render{ClassName} — not the old generic renderActorSheet hook.
// ---------------------------------------------------------------------------
const WIZARD_BAR_COLLAPSED_KEY_BASE = 'dg-wizard-bar-collapsed';
// Item types accepted by JSON restore (Delta Green 1.6.6–2.0.1 item types)
const RESTORE_ITEM_TYPES = new Set([
    'weapon', 'armor', 'gear', 'bond', 'motivation', 'tome', 'ritual', 'profession', 'vehicle',
]);
// Flag scope shared with scripts/wizard.js: wizardState + wizardApplied live here.
const WIZARD_FLAG_SCOPE = 'delta-green-agent-wizard';

/** Strip document ids (incl. nested effect ids) so a document recreates fresh.
 * Also drops the export's restore-metadata keys (_id is destructured; the
 * `_fromWizard` marker is not part of the item schema). */
function stripDocumentIds(doc) {
    const { _id, id, effects, _fromWizard, ...rest } = structuredClone(doc);
    rest.effects = (effects ?? []).map(({ _id: e1, id: e2, ...r }) => r);
    return rest;
}

/** Deterministic key-ordered JSON for state comparison (flatten/revert updates
 * reorder nested keys on the live document, which value-equal JSON misses). */
function canonJson(v) {
    if (Array.isArray(v)) return v.map(canonJson);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, canonJson(v[k])]));
    return v;
}

/** Flatten to dot-keys, keeping empty objects as leaves (foundry's
 * flattenObject drops them, which would leave added/removed containers behind
 * when reverting a snapshot). */
function flatLeaves(o, prefix = '', out = {}) {
    for (const [k, v] of Object.entries(o ?? {})) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0) flatLeaves(v, key, out);
        else out[key] = v;
    }
    return out;
}

/** Content-level comparison of the live actor against a restore snapshot.
 * Includes document ids: recovery recreates with keepId/keepEmbeddedIds, so a
 * complete rollback must leave item ids, active-effect ids, and effect contents
 * exactly as they were. */
function restoreSnapshotMatches(actor, snap) {
    try {
        if (actor.name !== snap.name || actor.img !== snap.img) return false;
        if (JSON.stringify(canonJson(actor.system)) !== JSON.stringify(canonJson(snap.system))) return false;
        const liveFlags = canonJson(actor.toObject().flags?.[WIZARD_FLAG_SCOPE] ?? {});
        if (JSON.stringify(liveFlags) !== JSON.stringify(canonJson(snap.flags ?? {}))) return false;
        const fxKey = e => `${e.id ?? e._id}|${e.label}|${e.origin ?? ''}|${JSON.stringify(e.changes ?? [])}`;
        if (actor.effects.map(fxKey).sort().join('\n') !== snap.effects.map(fxKey).sort().join('\n')) return false;
        const itemKey = i => `${i.id ?? i._id}|${i.type}|${i.name}|${JSON.stringify(i.system)}|${(i.effects ?? []).map(fxKey).sort().join(';')}`;
        if (actor.items.map(itemKey).sort().join('\n') !== snap.items.map(itemKey).sort().join('\n')) return false;
        return true;
    } catch (err) {
        console.error('[DG Agent Wizard] snapshot comparison failed:', err);
        return false;
    }
}
// Per-world key so collapse state does not leak between worlds on a shared host.
// Evaluated lazily — `game.world` is not guaranteed at module load time.
const wizardBarCollapsedKey = () => `${WIZARD_BAR_COLLAPSED_KEY_BASE}:${globalThis.game?.world?.id ?? 'default'}`;

/**
 * Build a collectState()-compatible state object from a Foundry Actor document.
 * Used by the bar's "Export PDF" button for already-created agents.
 */
function buildActorPdfState(actor) {
    const sys = actor.system ?? {};
    const st = sys.statistics ?? {};

    const csStats = {
        STR: st.str?.value ?? 10,
        CON: st.con?.value ?? 10,
        DEX: st.dex?.value ?? 10,
        INT: st.int?.value ?? 10,
        POW: st.pow?.value ?? 10,
        CHA: st.cha?.value ?? 10,
    };

    // Current and maximum tracked separately (DD Form 315 has MAXIMUM and CURRENT boxes)
    const hpCur = sys.health?.value ?? sys.health?.max ?? 0;
    const hpMax = sys.health?.max ?? sys.health?.value ?? 0;
    const wpCur = sys.wp?.value ?? sys.wp?.max ?? 0;
    const wpMax = sys.wp?.max ?? sys.wp?.value ?? 0;
    const sanCur = sys.sanity?.value ?? 0;
    const sanMax = sys.sanity?.max ?? sys.sanity?.value ?? 0;
    const bp = sys.sanity?.currentBreakingPoint ?? 0;
    const derived = { hp: hpCur, hpMax, wp: wpCur, wpMax, san: sanCur, sanMax, bp };

    // Plain skills
    const skills = {};
    const sysSkills = sys.skills ?? {};
    for (const [key, sk] of Object.entries(sysSkills)) {
        const val = sk?.proficiency ?? sk?.value;
        if (val) skills[key] = val;
    }

    // Typed skills (specialty instances)
    const GROUP_KEY_MAP = {
        Art: 'art',
        Craft: 'craft',
        ForeignLanguage: 'foreign_language',
        Science: 'science',
        Pilot: 'pilot',
        MilitaryScience: 'military_science',
    };
    const specialtyInstances = [];
    for (const ts of Object.values(sys.typedSkills ?? {})) {
        const pdfKey = GROUP_KEY_MAP[ts.group];
        if (!pdfKey) continue;
        specialtyInstances.push({ key: pdfKey, specialty: ts.label, value: ts.proficiency ?? 0 });
    }

    // Bonds (items of type 'bond')
    const bonds = actor.items
        .filter(i => i.type === 'bond')
        .map(i => ({ name: i.name, score: i.system?.score ?? 0, relationship: i.system?.relationship ?? '' }));

    // Motivations (items of type 'motivation') → personalDetails
    const motivationStrings = actor.items
        .filter(i => i.type === 'motivation')
        .map(i => i.name).join('\n');

    const bioSys = sys.biography ?? {};
    // system.physical.description / system.physical.wounds exist in DG 1.6.6–2.0.1.
    // system.biography has no `notes` field in any supported schema — personal
    // details stay blank until a defined source exists.
    const physicalDesc = (sys.physical?.description ?? '').replace(/<[^>]+>/g, '').trim();
    const wounds = (sys.physical?.wounds ?? '').replace(/<[^>]+>/g, '').trim();
    const bio = {
        name: actor.name,
        profession: bioSys.profession ?? '',
        employer: bioSys.employer ?? '',
        nationality: bioSys.nationality ?? '',
        sex: bioSys.sex ?? '',
        age: bioSys.age ?? '',
        education: bioSys.education ?? '',
        physicalDesc,
        motivations: motivationStrings,
        personalDetails: '',
    };

    return {
        csStats, derived, bio, skills,
        skillSpecs: {},
        customSkills: [],
        specialtyInstances,
        bonds,
        sanity: { violence: [false, false, false], helplessness: [false, false, false] },
        lpNotes: { wounds, gear: '', remarks: '' },
        lpFeat: {
            STR: st.str?.distinguishing_feature ?? '',
            CON: st.con?.distinguishing_feature ?? '',
            DEX: st.dex?.distinguishing_feature ?? '',
            INT: st.int?.distinguishing_feature ?? '',
            POW: st.pow?.distinguishing_feature ?? '',
            CHA: st.cha?.distinguishing_feature ?? '',
        },
        lpWeapons: actor.items
            .filter(i => i.type === 'weapon')
            .slice(0, 7)
            .map(item => {
                const wsys = item.system ?? {};
                const skillKey = wsys.skill ?? '';
                const skillVal = skills[skillKey] ?? 0;
                const rawPct = skillVal + (wsys.skillModifier ?? 0);
                return {
                    name: item.name,
                    skillPct: rawPct || '',
                    range: wsys.range ?? '',
                    damage: wsys.damage ?? '',
                    lethality: wsys.lethality ? wsys.lethality + '%' : '',
                    killRadius: (wsys.killRadius && wsys.killRadius !== 'N/A') ? wsys.killRadius : '',
                    ammo: wsys.ammo ?? '',
                };
            }),
        equipment: actor.items.filter(i => i.type === 'gear').map(i => i.name),
    };
}

function injectWizardButton(app, element) {
    const actor = app.document ?? app.actor;
    if (!actor || actor.type !== 'agent') return;

    const root = element instanceof HTMLElement ? element : element[0];
    if (!root) return;

    if (root.querySelector('.dg-agent-wizard-bar')) return;

    // Inject into window-content so it's always visible regardless of header CSS
    const content = root.querySelector('.window-content');
    if (!content) return;

    const collapsed = localStorage.getItem(wizardBarCollapsedKey()) === '1';

    const bar = document.createElement('div');
    bar.className = 'dg-agent-wizard-bar' + (collapsed ? ' dg-wizard-bar-collapsed' : '');
    bar.innerHTML = `
        <div class="dg-wizard-bar-buttons" role="group" aria-label="Agent actions">
            <button type="button" class="dg-wizard-bar-button dg-agent-wizard-launch">
                <i class="fa-solid fa-user-secret" aria-hidden="true"></i>
                <span>Agent Wizard</span>
            </button>
            <button type="button" class="dg-wizard-bar-button dg-agent-pdf-export" title="Export the DD Form 315 PDF">
                <i class="fa-solid fa-file-pdf" aria-hidden="true"></i>
                <span>Export PDF</span>
            </button>
            <button type="button" class="dg-wizard-bar-button dg-agent-json-export" title="Back up this Agent to JSON">
                <i class="fa-solid fa-file-export" aria-hidden="true"></i>
                <span>Export JSON</span>
            </button>
            <button type="button" class="dg-wizard-bar-button dg-agent-json-import" title="Restore this Agent from a JSON backup">
                <i class="fa-solid fa-file-import" aria-hidden="true"></i>
                <span>Import JSON</span>
            </button>
        </div>
        <button type="button" class="dg-wizard-bar-button dg-wizard-bar-toggle"
                aria-label="Agent tools" aria-expanded="${!collapsed}" title="Show or hide Agent tools">
            <span class="dg-wizard-bar-toggle-label">Agent tools</span>
            <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
        </button>`;

    bar.querySelector('.dg-agent-wizard-launch').addEventListener('click', () => {
        new DeltaGreenChargenWizard(actor).render({ force: true });
    });

    bar.querySelector('.dg-agent-pdf-export').addEventListener('click', () => {
        exportToPDF(buildActorPdfState(actor));
    });

    bar.querySelector('.dg-agent-json-export').addEventListener('click', () => {
        const wizardFlags = actor.flags?.[WIZARD_FLAG_SCOPE];
        const exportData = {
            _format: 'dg-agent-sheet-v1',
            name: actor.name,
            img: actor.img,
            system: actor.system,
            effects: actor.effects.map(e => e.toObject()),
            // _id/_fromWizard are restore metadata only: restore creates fresh
            // documents and remaps the applied build's item ids through them,
            // so the wizard keeps tracking its items across a restore.
            items: actor.items.map(i => ({
                _id: i.id,
                _fromWizard: !!i.flags?.[WIZARD_FLAG_SCOPE]?.fromWizard,
                name: i.name,
                type: i.type,
                img: i.img,
                system: i.system,
                effects: i.effects.map(e => e.toObject()),
            })),
        };
        if (wizardFlags && (wizardFlags.wizardApplied !== undefined || wizardFlags.wizardState !== undefined)) {
            exportData._wizard = foundry.utils.deepClone({
                wizardApplied: wizardFlags.wizardApplied,
                wizardState: wizardFlags.wizardState,
            });
        }
        const payload = JSON.stringify(exportData, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(actor.name ?? 'agent').replace(/[^a-z0-9_\-]/gi, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    bar.querySelector('.dg-agent-json-import').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                // --- Validate the whole payload before touching the actor ---
                if (!parsed?._format?.startsWith('dg-agent-sheet')) throw new Error('Not a valid DG agent sheet backup.');
                if ('system' in parsed && (typeof parsed.system !== 'object' || parsed.system === null)) {
                    throw new Error('Backup has an invalid system block.');
                }
                const replaceItems = 'items' in parsed;   // presence = replace, incl. with an empty list
                const replaceEffects = 'effects' in parsed;
                if (replaceItems) {
                    if (!Array.isArray(parsed.items)) throw new Error('Backup items must be an array.');
                    for (const it of parsed.items) {
                        if (!it || typeof it !== 'object' || typeof it.type !== 'string') {
                            throw new Error('Backup contains a malformed item.');
                        }
                        if (!RESTORE_ITEM_TYPES.has(it.type)) {
                            throw new Error(`Backup contains unsupported item type "${it.type}".`);
                        }
                    }
                }
                if (replaceEffects && !Array.isArray(parsed.effects)) {
                    throw new Error('Backup effects must be an array.');
                }
                // Effect ids from the export are not meaningful on restore —
                // strip them so the collection is replaced deterministically.
                if (replaceEffects) parsed.effects = parsed.effects.map(stripDocumentIds);

                // --- Confirm what will be replaced ---
                // Foundry ≥13 DialogV2.confirm resolves to 'yes'/'no'/object,
                // not a boolean — a truthy string check would accept "No".
                const answer = await foundry.applications.api.DialogV2.confirm({
                    window: { title: 'Restore Agent Backup' },
                    content: `<p>Restore <strong>${file.name}</strong> onto <strong>${actor.name}</strong>?</p>`
                        + (replaceItems
                            ? `<p><strong>All existing items will be replaced${parsed.items.length
                                ? ` by the ${parsed.items.length} item(s) in the backup`
                                : ' with an empty inventory'}.</strong></p>`
                            : '')
                        + (replaceEffects ? '<p>Existing active effects will be replaced.</p>' : ''),
                });
                const confirmed = answer === true || answer === 'yes' || answer?.button === 'yes';
                if (!confirmed) return;

                // --- Snapshot every document the restore can touch, so a
                // mid-way failure can be fully undone (fields, active effects,
                // items incl. their effects) ---
                const snapshot = {
                    name: actor.name,
                    img: actor.img,
                    system: foundry.utils.deepClone(actor.system),
                    effects: actor.effects.map(e => e.toObject()),
                    items: actor.items.map(i => i.toObject()),
                    flags: foundry.utils.deepClone(actor.toObject().flags?.[WIZARD_FLAG_SCOPE]),
                };

                const createdIds = [];
                const idMap = new Map();   // exported item id -> created item id
                try {
                    const updates = {};
                    if (parsed.name !== undefined) updates.name = parsed.name;
                    if (parsed.img !== undefined) updates.img = parsed.img;
                    if (parsed.system !== undefined) updates.system = parsed.system;
                    if (replaceEffects) updates.effects = parsed.effects;
                    if (Object.keys(updates).length) await actor.update(updates);

                    if (replaceItems) {
                        // Create replacements first; delete originals only on success.
                        const existingIds = actor.items.map(i => i.id);
                        // stripDocumentIds drops the export's reference _id (and
                        // nested effect ids) so every document recreates fresh.
                        const created = parsed.items.length
                            ? await actor.createEmbeddedDocuments('Item', parsed.items.map(it => stripDocumentIds(it)))
                            : [];
                        createdIds.push(...created.map(d => d.id));
                        parsed.items.forEach((it, i) => { if (it?._id && created[i]) idMap.set(it._id, created[i].id); });
                        // Wizard-created items lose their flag through the export;
                        // re-tag them so the wizard's ownership tracking survives.
                        const reTag = created
                            .map((doc, i) => parsed.items[i]?._fromWizard
                                ? { _id: doc.id, [`flags.${WIZARD_FLAG_SCOPE}.fromWizard`]: true }
                                : null)
                            .filter(Boolean);
                        if (reTag.length) await actor.updateEmbeddedDocuments('Item', reTag);
                        if (existingIds.length) {
                            await actor.deleteEmbeddedDocuments('Item', existingIds);
                        }
                    }

                    // --- Wizard state follows the restored items ---
                    if ('_wizard' in parsed) {
                        // New-style backup: carry the applied build, remapping its
                        // item ids onto the freshly created documents.
                        const w = parsed._wizard ?? {};
                        const flagUpdates = {};
                        let applied = w.wizardApplied;
                        if (typeof applied === 'string') {
                            try {
                                const appliedObj = JSON.parse(applied);
                                for (const ids of Object.values(appliedObj?.itemIds ?? {})) {
                                    for (let i = 0; i < ids.length; i++) ids[i] = ids[i] ? (idMap.get(ids[i]) ?? null) : null;
                                }
                                applied = JSON.stringify(appliedObj);
                            } catch { applied = null; }   // unreadable build: start fresh
                        }
                        if (applied) flagUpdates[`flags.${WIZARD_FLAG_SCOPE}.wizardApplied`] = applied;
                        else flagUpdates[`flags.${WIZARD_FLAG_SCOPE}.-=wizardApplied`] = null;
                        if (typeof w.wizardState === 'string') flagUpdates[`flags.${WIZARD_FLAG_SCOPE}.wizardState`] = w.wizardState;
                        else flagUpdates[`flags.${WIZARD_FLAG_SCOPE}.-=wizardState`] = null;
                        await actor.update(flagUpdates);
                    } else {
                        // Older backup (no wizard block): its item ids no longer
                        // exist, so any saved build on the actor is stale — clear it
                        // and let the wizard start fresh on top of the restored sheet.
                        const had = actor.toObject().flags?.[WIZARD_FLAG_SCOPE];
                        if (had && (had.wizardApplied !== undefined || had.wizardState !== undefined)) {
                            await actor.update({
                                [`flags.${WIZARD_FLAG_SCOPE}.-=wizardApplied`]: null,
                                [`flags.${WIZARD_FLAG_SCOPE}.-=wizardState`]: null,
                            });
                        }
                    }
                } catch (restoreErr) {
                    // Best-effort recovery: undo every write this attempt made.
                    const problems = [];
                    // 1. Remove items this restore created.
                    if (createdIds.length) {
                        try { await actor.deleteEmbeddedDocuments('Item', createdIds); }
                        catch (e) { problems.push(`${createdIds.length} backup item(s) left on the sheet`); console.error(e); }
                    }
                    // 2. Recreate originals lost to a committed deletion,
                    // preserving their _ids (keepId) and effect _ids
                    // (keepEmbeddedIds) so existing UUIDs keep resolving.
                    const survivingIds = new Set(actor.items.map(i => i.id));
                    const lostItems = snapshot.items.filter(i => !survivingIds.has(i._id ?? i.id));
                    if (lostItems.length) {
                        try {
                            await actor.createEmbeddedDocuments('Item',
                                lostItems.map(i => foundry.utils.deepClone(i)),
                                { keepId: true, keepEmbeddedIds: true });
                        }
                        catch (e) { problems.push(`${lostItems.length} original item(s) not recovered`); console.error(e); }
                    }
                    // 3. Revert fields and active effects (effect _ids preserved).
                    // Flatten to dot-keys: DG 2.x's preUpdate recompute silently
                    // discards whole-object `system` reverts on Foundry 14, and
                    // leaf keys are removed when absent from the snapshot.
                    try {
                        const revert = flatLeaves({
                            name: snapshot.name,
                            img: snapshot.img,
                            system: snapshot.system,
                        });
                        const liveFlat = flatLeaves({
                            name: actor.name, img: actor.img, system: actor.system,
                        });
                        for (const k of Object.keys(liveFlat)) if (!(k in revert)) revert[k] = undefined;
                        revert.effects = foundry.utils.deepClone(snapshot.effects);
                        await actor.update(revert, { keepEmbeddedIds: true });
                    } catch (e) { problems.push('agent fields/active effects not reverted'); console.error(e); }
                    // 4. Revert wizard flags to their pre-restore values.
                    try {
                        const scope = snapshot.flags ?? {};
                        const revertFlags = {};
                        for (const key of ['wizardApplied', 'wizardState']) {
                            if (scope[key] !== undefined) revertFlags[`flags.${WIZARD_FLAG_SCOPE}.${key}`] = scope[key];
                            else revertFlags[`flags.${WIZARD_FLAG_SCOPE}.-=${key}`] = null;
                        }
                        await actor.update(revertFlags);
                    } catch (e) { problems.push('wizard state not reverted'); console.error(e); }
                    // Report a full rollback only when it verifiably completed.
                    if (problems.length === 0 && restoreSnapshotMatches(actor, snapshot)) {
                        ui.notifications.warn('Restore failed — the agent was rolled back to its state before the restore.');
                    } else {
                        const detail = problems.length ? problems.join('; ') : 'the rolled-back state does not match the pre-restore state';
                        console.error('[DG Agent Wizard] Restore rollback incomplete:', detail);
                        ui.notifications.error(`Restore failed and the rollback is INCOMPLETE (${detail}). Check this agent sheet and the console before continuing — the console has the pre-restore snapshot if needed.`);
                    }
                    throw restoreErr;
                }
                ui.notifications.info(`${parsed.name ?? 'Agent'} restored from backup.`);
            } catch (err) {
                if (err?.message) ui.notifications.error(`Import failed: ${err.message}`);
                console.error('[DG Agent Wizard] JSON import failed:', err);
            }
        });
        input.click();
    });

    bar.querySelector('.dg-wizard-bar-toggle').addEventListener('click', event => {
        const isNowCollapsed = bar.classList.toggle('dg-wizard-bar-collapsed');
        event.currentTarget.setAttribute('aria-expanded', String(!isNowCollapsed));
        localStorage.setItem(wizardBarCollapsedKey(), isNowCollapsed ? '1' : '0');
    });

    // v13-era sheets (DG ≤1.7) flow window-content as block: prepend puts the
    // bar at the top. DG 2.x agent sheets make window-content a CSS GRID whose
    // children occupy named cells; an auto-placed prepended bar lands in an
    // implicit row BELOW all content. For grid sheets, mount the bar as a
    // direct child of the window frame, just under .window-header.
    if (getComputedStyle(content).display === 'grid') {
        const frame = content.parentElement;
        const header = frame?.querySelector(':scope > .window-header');
        bar.classList.add('dg-wizard-bar-framed');
        if (frame) {
            frame.insertBefore(bar, header ? header.nextSibling : frame.firstChild);
        } else {
            content.prepend(bar); // last-resort fallback
        }
    } else {
        content.prepend(bar);
    }
}

// Cover both the default sheet and the opt-in V2 sheet via render hooks
Hooks.on('renderDGAgentSheet', injectWizardButton);
Hooks.on('renderDGAgentSheetV2', injectWizardButton);

// Belt-and-suspenders: patch _onRender directly on every registered agent
// sheet class. This works even if the render hook name ever changes.
Hooks.once('ready', () => {
    const agentSheets = Object.values(CONFIG.Actor.sheetClasses?.agent ?? {});
    let patched = 0;
    for (const entry of agentSheets) {
        const SheetClass = entry?.cls;
        if (!SheetClass?.prototype?._onRender) continue;
        const orig = SheetClass.prototype._onRender;
        SheetClass.prototype._onRender = async function (context, options) {
            await orig.call(this, context, options);
            injectWizardButton(this, this.element);
        };
        patched++;
    }
    console.log(`delta-green-agent-wizard | Module loaded. Patched ${patched} agent sheet class(es).`);
});
