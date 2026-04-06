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
    if (root.querySelector('[data-action="dg-agent-wizard"]')) return;

    const header = root.querySelector('.window-header');
    if (!header) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.action = 'dg-agent-wizard';
    btn.className = 'header-control dg-agent-wizard-btn';
    btn.setAttribute('data-tooltip', 'Agent Wizard');
    btn.innerHTML = '<i class="fa-solid fa-scroll"></i>';

    btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        new DeltaGreenChargenWizard(actor).render({ force: true });
    });

    // Insert before the close button so it sits at the right of the header
    const closeBtn = header.querySelector('[data-action="close"]');
    if (closeBtn) closeBtn.before(btn);
    else header.appendChild(btn);
}

// Cover both the default sheet and the opt-in V2 sheet
Hooks.on('renderDGAgentSheet', injectWizardButton);
Hooks.on('renderDGAgentSheetV2', injectWizardButton);

Hooks.once('ready', () => {
    console.log('delta-green-agent-wizard | Module loaded.');
});
