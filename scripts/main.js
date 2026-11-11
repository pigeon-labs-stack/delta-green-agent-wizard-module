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
        <div class="dg-wizard-bar-buttons">
            <button type="button" class="dg-agent-wizard-launch">
                <i class="fa-solid fa-user-secret"></i> Agent Wizard
            </button>
            <button type="button" class="dg-agent-pdf-export" title="Export to DD Form 315 PDF">
                <i class="fa-solid fa-file-pdf"></i> Export PDF
            </button>
            <button type="button" class="dg-agent-json-export" title="Export wizard state to JSON">
                <i class="fa-solid fa-file-export"></i> Export JSON
            </button>
            <button type="button" class="dg-agent-json-import" title="Import wizard state from JSON">
                <i class="fa-solid fa-file-import"></i> Import JSON
            </button>
        </div>
        <button type="button" class="dg-wizard-bar-toggle" title="Collapse wizard bar">
            <span class="dg-wizard-bar-triangle"></span>
            <span class="dg-wizard-bar-toggle-label">Collapse</span>
        </button>`;

    // Always set display via inline style — Foundry CSS can override class-based flex/block rules
    const buttonsEl = bar.querySelector('.dg-wizard-bar-buttons');
    const labelEl = bar.querySelector('.dg-wizard-bar-toggle-label');
    buttonsEl.style.display = collapsed ? 'none' : 'flex';
    labelEl.style.display = collapsed ? 'none' : '';

    bar.querySelector('.dg-agent-wizard-launch').addEventListener('click', () => {
        new DeltaGreenChargenWizard(actor).render({ force: true });
    });

    bar.querySelector('.dg-agent-pdf-export').addEventListener('click', () => {
        exportToPDF(buildActorPdfState(actor));
    });

    bar.querySelector('.dg-agent-json-export').addEventListener('click', () => {
        const exportData = {
            _format: 'dg-agent-sheet-v1',
            name: actor.name,
            img: actor.img,
            system: actor.system,
            effects: actor.effects.map(e => e.toObject()),
            items: actor.items.map(i => ({ name: i.name, type: i.type, img: i.img, system: i.system, effects: i.effects.map(e => e.toObject()) })),
        };
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

                // --- Snapshot for recovery ---
                const snapshot = {
                    name: actor.name,
                    img: actor.img,
                    system: foundry.utils.deepClone(actor.system),
                };

                const createdIds = [];
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
                        const created = parsed.items.length
                            ? await actor.createEmbeddedDocuments('Item', parsed.items)
                            : [];
                        createdIds.push(...created.map(d => d.id));
                        if (existingIds.length) {
                            await actor.deleteEmbeddedDocuments('Item', existingIds);
                        }
                    }
                } catch (restoreErr) {
                    // Best-effort recovery from the in-memory snapshot
                    try {
                        if (createdIds.length) {
                            await actor.deleteEmbeddedDocuments('Item', createdIds).catch(() => { });
                        }
                        await actor.update(snapshot);
                        ui.notifications.warn('Restore failed part-way — the agent was rolled back to its state before the restore.');
                    } catch (recoverErr) {
                        console.error('[DG Agent Wizard] Restore recovery failed:', recoverErr);
                        ui.notifications.error('Restore failed and rollback did not complete — check this agent sheet and the console before continuing.');
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

    bar.querySelector('.dg-wizard-bar-toggle').addEventListener('click', () => {
        const isNowCollapsed = bar.classList.toggle('dg-wizard-bar-collapsed');
        localStorage.setItem(wizardBarCollapsedKey(), isNowCollapsed ? '1' : '0');
        buttonsEl.style.display = isNowCollapsed ? 'none' : 'flex';
        labelEl.style.display = isNowCollapsed ? 'none' : '';
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
