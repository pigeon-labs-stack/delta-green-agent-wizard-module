import { DeltaGreenChargenWizard } from './wizard.js';

// ---------------------------------------------------------------------------
// Handlebars helpers
// ---------------------------------------------------------------------------
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('multiply', (a, b) => Number(a) * Number(b));
Handlebars.registerHelper('inc', (n) => n + 1);

// ---------------------------------------------------------------------------
// Inject wizard button into the DG agent sheet header (Foundry v13 / AppV2)
// DGAgentSheet and DGAgentSheetV2 are AppV2-based, so Foundry fires
// render{ClassName} — not the old generic renderActorSheet hook.
// ---------------------------------------------------------------------------
function injectWizardButton(app, element) {
    const actor = app.document ?? app.actor;
    if (!actor || actor.type !== 'agent') return;

    const root = element instanceof HTMLElement ? element : element[0];
    if (!root) return;

    // Prevent duplicate buttons on re-render
    if (root.querySelector('.dg-agent-wizard-btn')) return;

    // The Foundry AppV2 window chrome header
    const header = root.querySelector('.window-header');
    if (!header) {
        console.warn('delta-green-agent-wizard | .window-header not found. Root classes:', root.className);
        return;
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.action = 'dg-agent-wizard';
    btn.className = 'dg-agent-wizard-btn header-control';
    btn.setAttribute('data-tooltip', 'Agent Wizard');
    btn.innerHTML = '<i class="fa-solid fa-scroll"></i> Wizard';

    btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        new DeltaGreenChargenWizard(actor).render({ force: true });
    });

    // In AppV2 the close button lives inside .window-controls or directly in header
    const closeBtn = header.querySelector('[data-action="close"]') 
                  ?? header.querySelector('.close');
    if (closeBtn) {
        closeBtn.before(btn);
    } else {
        // Fallback: append to header
        header.appendChild(btn);
        console.log('delta-green-agent-wizard | Appended wizard button to header (no close btn found).');
    }

    console.log('delta-green-agent-wizard | Wizard button injected for actor:', actor.name);
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
