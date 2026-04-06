import { DeltaGreenChargenWizard } from './wizard.js';

// ---------------------------------------------------------------------------
// Handlebars helpers
// ---------------------------------------------------------------------------
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('multiply', (a, b) => Number(a) * Number(b));
Handlebars.registerHelper('inc', (n) => n + 1);

// ---------------------------------------------------------------------------
// Hook into actor sheet header buttons
// Works for ApplicationV2 DocumentSheets (Foundry v13)
// ---------------------------------------------------------------------------
Hooks.on('getApplicationHeaderButtons', (app, buttons) => {
    if (app.document?.documentName !== 'Actor') return;
    if (app.document.type !== 'agent') return;
    buttons.push({
        action: 'dg-chargen-wizard',
        icon: 'fa-solid fa-scroll',
        label: 'Chargen',
        onclick: () => new DeltaGreenChargenWizard(app.document).render({ force: true }),
    });
});

// Fallback for any FormApplication-based actor sheets still in use
Hooks.on('getActorSheetHeaderButtons', (sheet, buttons) => {
    const actor = sheet.document ?? sheet.actor;
    if (!actor || actor.type !== 'agent') return;
    buttons.unshift({
        label: 'Chargen',
        class: 'dg-chargen-btn',
        icon: 'fas fa-scroll',
        onclick: () => new DeltaGreenChargenWizard(actor).render(true),
    });
});

Hooks.once('ready', () => {
    console.log('delta-green-chargen | Module loaded.');
});
