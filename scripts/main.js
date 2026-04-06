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
const WIZARD_BAR_COLLAPSED_KEY = 'dg-wizard-bar-collapsed';

/**
 * Build a collectState()-compatible state object from a Foundry Actor document.
 * Used by the bar's "Export PDF" button for already-created agents.
 */
function buildActorPdfState(actor) {
    const sys  = actor.system ?? {};
    const st   = sys.statistics ?? {};

    const csStats = {
        STR: st.str?.value ?? 10,
        CON: st.con?.value ?? 10,
        DEX: st.dex?.value ?? 10,
        INT: st.int?.value ?? 10,
        POW: st.pow?.value ?? 10,
        CHA: st.cha?.value ?? 10,
    };

    const hp  = sys.health?.max   ?? sys.health?.value  ?? 0;
    const wp  = sys.wp?.max       ?? sys.wp?.value       ?? 0;
    const san = sys.sanity?.value ?? 0;
    const bp  = sys.sanity?.currentBreakingPoint ?? 0;
    const derived = { hp, wp, san, bp };

    // Plain skills
    const skills = {};
    const sysSkills = sys.skills ?? {};
    for (const [key, sk] of Object.entries(sysSkills)) {
        const val = sk?.proficiency ?? sk?.value;
        if (val) skills[key] = val;
    }

    // Typed skills (specialty instances)
    const GROUP_KEY_MAP = {
        Art:            'art',
        Craft:          'craft',
        ForeignLanguage:'foreign_language',
        Science:        'science',
        Pilot:          'pilot',
        MilitaryScience:'military_science',
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
    const bio = {
        name:            actor.name,
        profession:      bioSys.profession    ?? '',
        employer:        bioSys.employer      ?? '',
        nationality:     bioSys.nationality   ?? '',
        sex:             bioSys.sex           ?? '',
        age:             bioSys.age           ?? '',
        education:       bioSys.education     ?? '',
        physicalDesc:    sys.physicalDescription ?? '',
        motivations:     motivationStrings,
        personalDetails: bioSys.notes         ?? '',
    };

    return {
        csStats, derived, bio, skills,
        skillSpecs:           {},
        customSkills:         [],
        specialtyInstances,
        bonds,
        sanity:               { violence: [false, false, false], helplessness: [false, false, false] },
        lpNotes:              { wounds: '', gear: '', remarks: '' },
        lpFeat:               {},
        lpWeapons:            [],
        equipment:            actor.items.filter(i => i.type === 'gear').map(i => i.name),
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

    const collapsed = localStorage.getItem(WIZARD_BAR_COLLAPSED_KEY) === '1';

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
        </div>
        <button type="button" class="dg-wizard-bar-toggle" title="Collapse wizard bar">
            <span class="dg-wizard-bar-triangle"></span>
            <span class="dg-wizard-bar-toggle-label">Collapse</span>
        </button>`;

    // Apply initial collapsed state directly via style so it works regardless of CSS specificity
    const buttonsEl = bar.querySelector('.dg-wizard-bar-buttons');
    const labelEl   = bar.querySelector('.dg-wizard-bar-toggle-label');
    if (collapsed) {
        buttonsEl.style.display = 'none';
        labelEl.textContent = 'Expand';
    }

    bar.querySelector('.dg-agent-wizard-launch').addEventListener('click', () => {
        new DeltaGreenChargenWizard(actor).render({ force: true });
    });

    bar.querySelector('.dg-agent-pdf-export').addEventListener('click', () => {
        exportToPDF(buildActorPdfState(actor));
    });

    bar.querySelector('.dg-wizard-bar-toggle').addEventListener('click', () => {
        const isNowCollapsed = bar.classList.toggle('dg-wizard-bar-collapsed');
        localStorage.setItem(WIZARD_BAR_COLLAPSED_KEY, isNowCollapsed ? '1' : '0');
        buttonsEl.style.display = isNowCollapsed ? 'none' : 'flex';
        labelEl.textContent     = isNowCollapsed ? 'Expand' : 'Collapse';
    });

    content.prepend(bar);
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
