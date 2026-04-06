import { DeltaGreenChargenWizard } from './wizard.js';

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
        <button type="button" class="dg-agent-wizard-launch">
            <i class="fa-solid fa-scroll"></i> Agent Wizard
        </button>
        <button type="button" class="dg-wizard-bar-toggle" title="Collapse wizard bar">
            <span class="dg-wizard-bar-triangle"></span>
        </button>`;

    bar.querySelector('.dg-agent-wizard-launch').addEventListener('click', () => {
        new DeltaGreenChargenWizard(actor).render({ force: true });
    });

    bar.querySelector('.dg-wizard-bar-toggle').addEventListener('click', () => {
        const isNowCollapsed = bar.classList.toggle('dg-wizard-bar-collapsed');
        localStorage.setItem(WIZARD_BAR_COLLAPSED_KEY, isNowCollapsed ? '1' : '0');
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
