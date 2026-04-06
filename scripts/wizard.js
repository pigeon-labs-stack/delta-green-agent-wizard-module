import { PROFESSIONS } from './professions.js';
import { BONDS } from './bonds.js';
import { EQUIPMENT_CATALOG, EQUIPMENT_CATEGORIES } from './equipment.js';
import { generateBio } from './bio-data.js';

// ---------------------------------------------------------------------------
// Skill key → Foundry system.skills path mapping
// Keys match both the website's CONFIG.SKILLS and the DG Foundry system.
// ---------------------------------------------------------------------------
const SKILL_KEY_MAP = {
    accounting: 'accounting',
    alertness: 'alertness',
    anthropology: 'anthropology',
    archeology: 'archeology',
    athletics: 'athletics',
    artillery: 'artillery',
    bureaucracy: 'bureaucracy',
    computer_science: 'computer_science',
    criminology: 'criminology',
    demolitions: 'demolitions',
    disguise: 'disguise',
    dodge: 'dodge',
    drive: 'drive',
    firearms: 'firearms',
    first_aid: 'first_aid',
    forensics: 'forensics',
    heavy_machiner: 'heavy_machiner',      // system uses this key
    heavy_weapons: 'heavy_weapons',
    history: 'history',
    humint: 'humint',
    law: 'law',
    medicine: 'medicine',
    melee_weapons: 'melee_weapons',
    navigate: 'navigate',
    occult: 'occult',
    persuade: 'persuade',
    pharmacy: 'pharmacy',
    psychotherapy: 'psychotherapy',
    ride: 'ride',
    search: 'search',
    sigint: 'sigint',
    stealth: 'stealth',
    surgery: 'surgery',
    survival: 'survival',
    swim: 'swim',
    unarmed_combat: 'unarmed_combat',
    unnatural: 'unnatural',
};

// Base skill defaults (mirrors CONFIG.SKILLS in website scripts.js)
const SKILL_DEFAULTS = {
    accounting: 10, alertness: 20, anthropology: 0, archeology: 0,
    athletics: 30, artillery: 0, bureaucracy: 10, computer_science: 0,
    criminology: 10, demolitions: 0, disguise: 10, dodge: 30, drive: 20,
    firearms: 20, first_aid: 10, forensics: 0, heavy_machiner: 10,
    heavy_weapons: 0, history: 10, humint: 10, law: 0, medicine: 0,
    melee_weapons: 30, navigate: 10, occult: 10, persuade: 20,
    pharmacy: 0, psychotherapy: 10, ride: 10, search: 20, sigint: 0,
    stealth: 10, surgery: 0, survival: 10, swim: 20, unarmed_combat: 40,
    unnatural: 0,
};

const STAT_LABELS = { str: 'STR', con: 'CON', dex: 'DEX', int: 'INT', pow: 'POW', cha: 'CHA' };

const STAT_DESCRIPTOR_TIERS = {
    str: [[3, 'Feeble'], [5, 'Weak'], [9, 'Average'], [13, 'Muscular'], [17, 'Huge']],
    dex: [[3, 'Barely Mobile'], [5, 'Clumsy'], [9, 'Average'], [13, 'Nimble'], [17, 'Acrobatic']],
    con: [[3, 'Bedridden'], [5, 'Sickly'], [9, 'Average'], [13, 'Perfect health'], [17, 'Indefatigable']],
    int: [[3, 'Imbecilic'], [5, 'Slow'], [9, 'Average'], [13, 'Perceptive'], [17, 'Brilliant']],
    pow: [[3, 'Spineless'], [5, 'Nervous'], [9, 'Average'], [13, 'Strong willed'], [17, 'Indomitable']],
    cha: [[3, 'Unbearable'], [5, 'Awkward'], [9, 'Average'], [13, 'Charming'], [17, 'Magnetic']],
};

function getStatDescriptor(key, value) {
    const tiers = STAT_DESCRIPTOR_TIERS[key];
    if (!tiers) return '';
    let desc = tiers[0][1];
    for (const [min, label] of tiers) { if (value >= min) desc = label; }
    return desc;
}

const STEPS = ['welcome', 'stats', 'profession', 'skills', 'bonus_skills', 'bonds', 'biography', 'equipment', 'review'];

// ---------------------------------------------------------------------------
// Wizard Application (ApplicationV2, Foundry v13)
// ---------------------------------------------------------------------------
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class DeltaGreenChargenWizard extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @type {Actor} */
    #actor;

    /** @type {number}  index into STEPS[] */
    #step = 0;

    /** Active equipment category filter */
    #equipCategory = 'All';

    /** Equipment catalog search query */
    #equipSearch = '';

    /** Transient data collected across steps before writing to the Actor. */
    #data = {
        stats: { str: 10, con: 10, dex: 10, int: 10, pow: 10, cha: 10 },
        professionKey: '',
        skills: {},          // key → value
        optionalPicks: [],   // indices of chosen optional skills
        bonusBoosts: {},     // key → number of +20 boosts applied
        bonds: [],           // array of { name, score }
        biography: { name: '', profession: '', employer: '', nationality: '', sex: '', age: '', education: '', notes: '' },
        equipment: [],       // array of item names from catalog
    };

    constructor(actor, options = {}) {
        super(options);
        this.#actor = actor;
    }

    static DEFAULT_OPTIONS = {
        id: 'dg-chargen-wizard',
        classes: ['dg-chargen'],
        window: {
            title: 'Delta Green — Character Creation Wizard',
            resizable: true,
        },
        position: { width: 900, height: 700 },
        actions: {
            nextStep: DeltaGreenChargenWizard.#onNextStep,
            prevStep: DeltaGreenChargenWizard.#onPrevStep,
            rollStats: DeltaGreenChargenWizard.#onRollStats,
            adjustStat: DeltaGreenChargenWizard.#onAdjustStat,
            randomizeStats: DeltaGreenChargenWizard.#onRandomizeStats,
            resetStats: DeltaGreenChargenWizard.#onResetStats,
            boostSkill: DeltaGreenChargenWizard.#onBoostSkill,
            unboostSkill: DeltaGreenChargenWizard.#onUnboostSkill,
            addBond: DeltaGreenChargenWizard.#onAddBond,
            removeBond: DeltaGreenChargenWizard.#onRemoveBond,
            suggestBond: DeltaGreenChargenWizard.#onSuggestBond,
            randomBio: DeltaGreenChargenWizard.#onRandomBio,
            clearEquipment: DeltaGreenChargenWizard.#onClearEquipment,
            finish: DeltaGreenChargenWizard.#onFinish,
        },
    };

    static PARTS = {
        main: { template: 'modules/delta-green-agent-wizard/templates/wizard.hbs' },
    };

    // -----------------------------------------------------------------------
    // Context passed to the Handlebars template
    // -----------------------------------------------------------------------
    async _prepareContext(options) {
        const step = STEPS[this.#step];
        const profKey = this.#data.professionKey;
        const prof = profKey ? PROFESSIONS[profKey] : null;
        const bondLimit = prof ? this.#getBondLimit(prof) : 0;

        const statValues = this.#data.stats;
        const pointsRemaining = 72 - Object.values(statValues).reduce((a, b) => a + b, 0);
        const statDescriptors = Object.fromEntries(
            Object.entries(statValues).map(([k, v]) => [k, getStatDescriptor(k, v)])
        );

        const bonusSkills = step === 'bonus_skills' ? this.#buildBonusSkillContext() : null;

        return {
            step,
            stepIndex: this.#step,
            totalSteps: STEPS.length,
            isFirst: this.#step === 0,
            isLast: this.#step === STEPS.length - 1,
            actor: this.#actor,
            // step-specific
            stats: this.#data.stats,
            statLabels: STAT_LABELS,
            statDescriptors,
            pointsRemaining,
            professions: Object.entries(PROFESSIONS).map(([key, p]) => ({ key, title: p.title })),
            professionKey: profKey,
            profession: prof,
            skills: this.#buildSkillContext(prof),
            bonusSkills,
            bonds: this.#data.bonds,
            bondLimit,
            bondsAtLimit: this.#data.bonds.length >= bondLimit,
            biography: this.#data.biography,
            equipmentCount: this.#data.equipment.length,
            review: step === 'review' ? this.#buildReviewContext() : null,
        };
    }

    // -----------------------------------------------------------------------
    // Build sorted skill list for the skills step
    // -----------------------------------------------------------------------
    #buildSkillContext(prof) {
        if (!prof) return [];
        const result = [];

        // Required skills
        for (const s of prof.requiredSkills ?? []) {
            const key = this.#findSkillKey(s.name);
            result.push({
                key,
                label: s.name,
                base: SKILL_DEFAULTS[key] ?? 0,
                profValue: s.value,
                current: this.#data.skills[key] ?? Math.max(SKILL_DEFAULTS[key] ?? 0, s.value),
                required: true,
                optional: false,
            });
        }

        // Optional skills with pick limit
        const optLimit = prof.optionalSkills?.[0]?.limit ?? 2;
        for (let i = 0; i < (prof.optionalSkills?.length ?? 0); i++) {
            const s = prof.optionalSkills[i];
            const key = this.#findSkillKey(s.name);
            result.push({
                key,
                label: s.name,
                base: SKILL_DEFAULTS[key] ?? 0,
                profValue: s.value,
                current: this.#data.skills[key] ?? SKILL_DEFAULTS[key] ?? 0,
                required: false,
                optional: true,
                optIndex: i,
                picked: this.#data.optionalPicks.includes(i),
                optLimit,
            });
        }
        return result;
    }

    // -----------------------------------------------------------------------
    // Map a display name like "Computer Science" → system key "computer_science"
    // -----------------------------------------------------------------------
    #findSkillKey(name) {
        const normalized = name.toLowerCase().replace(/[^a-z]/g, '_').replace(/__+/g, '_');
        // direct match
        if (SKILL_KEY_MAP[normalized]) return normalized;
        // fuzzy: find first key that appears in the normalized name
        return Object.keys(SKILL_KEY_MAP).find(k => normalized.includes(k)) ?? normalized;
    }

    // -----------------------------------------------------------------------
    // Parse BONDS: N from profession description
    // -----------------------------------------------------------------------
    #getBondLimit(prof) {
        const m = prof.description?.match(/BONDS:\s*(\d+)/);
        return m ? parseInt(m[1], 10) : 4;
    }

    // -----------------------------------------------------------------------
    // Build bonus skill context for the bonus_skills step
    // -----------------------------------------------------------------------
    #buildBonusSkillContext() {
        const picksUsed = Object.values(this.#data.bonusBoosts).reduce((a, b) => a + b, 0);
        const picksRemaining = 8 - picksUsed;

        const skills = Object.entries(SKILL_DEFAULTS).map(([key, baseValue]) => {
            const profValue = this.#data.skills[key] ?? baseValue;
            const boosts = this.#data.bonusBoosts[key] ?? 0;
            const current = Math.min(80, profValue + boosts * 20);
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return {
                key, label, current, boosts,
                canBoost: picksRemaining > 0 && current < 80,
                canUnboost: boosts > 0,
            };
        });
        return { skills, picksUsed, picksRemaining };
    }

    // -----------------------------------------------------------------------
    // Build summary for the review step
    // -----------------------------------------------------------------------
    #buildReviewContext() {
        return {
            stats: Object.entries(this.#data.stats).map(([k, v]) => ({
                key: k, label: STAT_LABELS[k], value: v, x5: v * 5,
            })),
            profession: this.#data.professionKey
                ? PROFESSIONS[this.#data.professionKey]?.title ?? this.#data.professionKey
                : '—',
            skills: Object.entries(this.#data.skills).map(([k, v]) => {
                const boosts = this.#data.bonusBoosts[k] ?? 0;
                const effective = Math.min(80, v + boosts * 20);
                const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                return { key: k, label, value: effective };
            }),
            bonds: this.#data.bonds,
            biography: this.#data.biography,
            equipment: this.#data.equipment,
        };
    }

    // -----------------------------------------------------------------------
    // _onRender — called after every Handlebars re-render; wire up equipment UI
    // -----------------------------------------------------------------------
    async _onRender(context, options) {
        await super._onRender?.(context, options);
        if (STEPS[this.#step] === 'equipment') this.#buildEquipmentUI();
    }

    // -----------------------------------------------------------------------
    // Equipment step: build interactive catalog + loadout panels
    // -----------------------------------------------------------------------
    #buildEquipmentUI() {
        const el = this.element;
        if (!el) return;

        const searchInput = el.querySelector('#dg-eq-search');
        const catTabsEl   = el.querySelector('#dg-eq-cat-tabs');
        const catalogEl   = el.querySelector('#dg-eq-catalog');
        const loadoutEl   = el.querySelector('#dg-eq-loadout');
        if (!searchInput || !catTabsEl || !catalogEl || !loadoutEl) return;

        // Sync search input to stored state
        searchInput.value = this.#equipSearch;
        searchInput.addEventListener('input', (e) => {
            this.#equipSearch = e.target.value;
            this.#renderEquipmentCatalog(catalogEl);
        });

        // Catalog click delegation — add item to loadout
        catalogEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-item-name]');
            if (!btn) return;
            const name = btn.dataset.itemName;
            if (name && !this.#data.equipment.includes(name)) {
                this.#data.equipment.push(name);
                this.#renderEquipmentLoadout(loadoutEl);
                this.#renderEquipmentCatalog(catalogEl);
                this.#updateEquipCountBadge(el);
            }
        });

        // Loadout click delegation — remove item
        loadoutEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-item-idx]');
            if (!btn) return;
            const idx = parseInt(btn.dataset.itemIdx, 10);
            if (!isNaN(idx)) {
                this.#data.equipment.splice(idx, 1);
                this.#renderEquipmentLoadout(loadoutEl);
                this.#renderEquipmentCatalog(catalogEl);
                this.#updateEquipCountBadge(el);
            }
        });

        this.#renderEquipmentTabs(catTabsEl, catalogEl);
        this.#renderEquipmentCatalog(catalogEl);
        this.#renderEquipmentLoadout(loadoutEl);
        this.#updateEquipCountBadge(el);
    }

    #renderEquipmentTabs(tabsEl, catalogEl) {
        tabsEl.innerHTML = '';
        for (const cat of EQUIPMENT_CATEGORIES) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = cat;
            btn.className = 'dg-eq-cat-btn' + (cat === this.#equipCategory ? ' active' : '');
            btn.addEventListener('click', () => {
                this.#equipCategory = cat;
                tabsEl.querySelectorAll('.dg-eq-cat-btn').forEach(b =>
                    b.classList.toggle('active', b.textContent === cat));
                this.#renderEquipmentCatalog(catalogEl);
            });
            tabsEl.appendChild(btn);
        }
    }

    #renderEquipmentCatalog(catalogEl) {
        const query = this.#equipSearch.toLowerCase().trim();
        const filtered = EQUIPMENT_CATALOG.filter(item => {
            const catMatch = this.#equipCategory === 'All' || item.category === this.#equipCategory;
            const srchMatch = !query
                || item.name.toLowerCase().includes(query)
                || item.category.toLowerCase().includes(query);
            return catMatch && srchMatch;
        });

        if (filtered.length === 0) {
            catalogEl.innerHTML = '<div class="dg-eq-empty">No items match.</div>';
            return;
        }
        catalogEl.innerHTML = filtered.map(item => {
            const inLoadout = this.#data.equipment.includes(item.name);
            const exp = item.system?.expense ?? '';
            const expClass = `dg-exp-${exp.toLowerCase()}`;
            const safeName = item.name.replace(/"/g, '&quot;');
            return `<div class="dg-eq-item${inLoadout ? ' in-loadout' : ''}">
  <div class="dg-eq-item-info">
    <span class="dg-eq-item-name">${item.name}</span>
    <span class="dg-eq-expense ${expClass}">${exp}</span>
  </div>
  <button type="button" class="dg-eq-add-btn" data-item-name="${safeName}"${inLoadout ? ' disabled' : ''}>
    ${inLoadout ? '✓' : '+'}
  </button>
</div>`;
        }).join('');
    }

    #renderEquipmentLoadout(loadoutEl) {
        if (this.#data.equipment.length === 0) {
            loadoutEl.innerHTML = '<div class="dg-eq-empty">No items selected.</div>';
            return;
        }
        loadoutEl.innerHTML = this.#data.equipment.map((name, idx) => {
            const item = EQUIPMENT_CATALOG.find(i => i.name === name);
            const exp = item?.system?.expense ?? '';
            const expClass = `dg-exp-${exp.toLowerCase()}`;
            return `<div class="dg-eq-loadout-item">
  <span class="dg-eq-loadout-name">${name}</span>
  <span class="dg-eq-expense ${expClass}">${exp}</span>
  <button type="button" class="dg-eq-remove-btn" data-item-idx="${idx}" title="Remove">✕</button>
</div>`;
        }).join('');
    }

    #updateEquipCountBadge(el) {
        const badge = el.querySelector('.dg-eq-count');
        if (badge) badge.textContent = this.#data.equipment.length > 0 ? `${this.#data.equipment.length} selected` : '';
    }

    // -----------------------------------------------------------------------
    // Static action handlers (Foundry v13 ApplicationV2 pattern)
    // -----------------------------------------------------------------------
    static async #onNextStep(event, target) {
        if (!this.#collectCurrentStep()) return;
        if (this.#step < STEPS.length - 1) {
            this.#step++;
            this.render({ force: true });
        }
    }

    static async #onPrevStep(event, target) {
        if (this.#step > 0) {
            this.#step--;
            this.render({ force: true });
        }
    }

    static async #onRollStats(event, target) {
        const rollStat = async () => {
            const results = await Promise.all([1, 2, 3, 4].map(() => new Roll('1d6').evaluate()));
            const sorted = results.map(r => r.total).sort((a, b) => b - a);
            return sorted[0] + sorted[1] + sorted[2];  // keep highest 3
        };
        for (const stat of Object.keys(this.#data.stats)) {
            this.#data.stats[stat] = await rollStat();
        }
        this.render({ force: true });
    }

    static async #onAdjustStat(event, target) {
        const stat = target.dataset.stat;
        const delta = parseInt(target.dataset.delta, 10);
        const input = this.element?.querySelector(`input[name="stats.${stat}"]`);
        const current = input ? (parseInt(input.value, 10) || 3) : (this.#data.stats[stat] || 3);
        this.#data.stats[stat] = Math.max(3, Math.min(18, current + delta));
        this.render({ force: true });
    }

    static async #onRandomizeStats(event, target) {
        const statKeys = Object.keys(this.#data.stats);
        const TOTAL = 72, MIN = 3, MAX = 18;
        statKeys.forEach(k => { this.#data.stats[k] = MIN; });
        let remaining = TOTAL - statKeys.length * MIN;
        while (remaining > 0) {
            for (const k of statKeys) {
                if (remaining <= 0) break;
                const cur = this.#data.stats[k];
                if (cur < MAX) {
                    const maxAdd = Math.min(remaining, MAX - cur);
                    const add = Math.floor(Math.random() * maxAdd) + 1;
                    this.#data.stats[k] = cur + add;
                    remaining -= add;
                }
            }
        }
        this.render({ force: true });
    }

    static async #onResetStats(event, target) {
        for (const k of Object.keys(this.#data.stats)) this.#data.stats[k] = 3;
        this.render({ force: true });
    }

    static async #onAddBond(event, target) {
        const prof = this.#data.professionKey ? PROFESSIONS[this.#data.professionKey] : null;
        const limit = prof ? this.#getBondLimit(prof) : 4;
        if (this.#data.bonds.length >= limit) {
            ui.notifications.warn(`This profession allows a maximum of ${limit} bonds.`);
            return;
        }
        this.#data.bonds.push({ name: '', score: this.#data.stats.cha });
        this.render({ force: true });
    }

    static async #onRemoveBond(event, target) {
        const idx = Number(target.dataset.index);
        this.#data.bonds.splice(idx, 1);
        this.render({ force: true });
    }

    static async #onSuggestBond(event, target) {
        const pool = Object.values(BONDS).flat();
        const suggestion = pool[Math.floor(Math.random() * pool.length)];
        const idx = Number(target.dataset.index);
        if (this.#data.bonds[idx]) this.#data.bonds[idx].name = suggestion.name;
        this.render({ force: true });
    }

    static async #onBoostSkill(event, target) {
        const key = target.dataset.skill;
        if (!key) return;
        const picksUsed = Object.values(this.#data.bonusBoosts).reduce((a, b) => a + b, 0);
        if (picksUsed >= 8) { ui.notifications.warn('You have used all 8 bonus skill picks.'); return; }
        const profValue = this.#data.skills[key] ?? SKILL_DEFAULTS[key] ?? 0;
        const boosts = this.#data.bonusBoosts[key] ?? 0;
        if (Math.min(80, profValue + boosts * 20) >= 80) {
            ui.notifications.warn('Skills cannot exceed 80% during character creation.');
            return;
        }
        this.#data.bonusBoosts[key] = boosts + 1;
        this.render({ force: true });
    }

    static async #onUnboostSkill(event, target) {
        const key = target.dataset.skill;
        if (!key) return;
        const boosts = this.#data.bonusBoosts[key] ?? 0;
        if (boosts <= 0) return;
        this.#data.bonusBoosts[key] = boosts - 1;
        this.render({ force: true });
    }

    static async #onRandomBio(event, target) {
        const bio = generateBio(this.#data.stats, this.#data.professionKey);
        Object.assign(this.#data.biography, bio);
        this.render({ force: true });
    }

    static async #onClearEquipment(event, target) {
        this.#data.equipment = [];
        this.render({ force: true });
    }

    static async #onFinish(event, target) {
        if (!this.#collectCurrentStep()) return;
        await this.#applyToActor();
        this.close();
        ui.notifications.info(`${this.#actor.name} is ready for fieldwork.`);
    }

    // -----------------------------------------------------------------------
    // Collect form data from the current step before advancing
    // -----------------------------------------------------------------------
    #collectCurrentStep() {
        const form = this.element?.querySelector('form.dg-wizard-form');
        if (!form) return true;
        const fd = new FormDataExtended(form);
        const raw = fd.object;
        const step = STEPS[this.#step];

        if (step === 'stats') {
            for (const k of Object.keys(this.#data.stats)) {
                const v = parseInt(raw[`stats.${k}`], 10);
                if (isNaN(v) || v < 3 || v > 18) {
                    ui.notifications.warn(`${STAT_LABELS[k]} must be between 3 and 18.`);
                    return false;
                }
                this.#data.stats[k] = v;
            }
        }

        if (step === 'profession') {
            const key = raw['professionKey'];
            if (!key) { ui.notifications.warn('Please select a profession.'); return false; }
            this.#data.professionKey = key;
            // Pre-fill required skill values
            const prof = PROFESSIONS[key];
            for (const s of prof.requiredSkills ?? []) {
                const sk = this.#findSkillKey(s.name);
                this.#data.skills[sk] = Math.max(SKILL_DEFAULTS[sk] ?? 0, s.value);
            }
        }

        if (step === 'skills') {
            const prof = PROFESSIONS[this.#data.professionKey];
            const optLimit = prof?.optionalSkills?.[0]?.limit ?? 2;
            // Collect optional picks from checkboxes
            const picks = [];
            form.querySelectorAll('input[name="optPick"]:checked').forEach(cb => {
                picks.push(Number(cb.dataset.index));
            });
            if (picks.length > optLimit) {
                ui.notifications.warn(`You may only choose ${optLimit} optional skills.`);
                return false;
            }
            this.#data.optionalPicks = picks;
            for (const idx of picks) {
                const s = prof.optionalSkills[idx];
                const sk = this.#findSkillKey(s.name);
                this.#data.skills[sk] = Math.max(this.#data.skills[sk] ?? 0, s.value);
            }
        }

        if (step === 'bonus_skills') {
            // Boosts are already applied via action buttons — nothing to collect from form
            return true;
        }

        if (step === 'bonds') {
            this.#data.bonds = this.#data.bonds.map((bond, i) => ({
                name: (raw[`bonds.${i}.name`] ?? bond.name).toString().trim(),
                score: parseInt(raw[`bonds.${i}.score`], 10) || bond.score,
            }));
        }

        if (step === 'biography') {
            for (const k of Object.keys(this.#data.biography)) {
                this.#data.biography[k] = (raw[`biography.${k}`] ?? '').toString().trim();
            }
        }

        if (step === 'equipment') {
            // Equipment is managed via DOM actions — nothing to collect from form
            return true;
        }

        return true;
    }

    // -----------------------------------------------------------------------
    // Write all collected data to the Foundry Actor document
    // -----------------------------------------------------------------------
    async #applyToActor() {
        const updates = {};

        // Statistics
        for (const [k, v] of Object.entries(this.#data.stats)) {
            updates[`system.statistics.${k}.value`] = v;
        }

        // HP = (CON + STR) / 2, rounded up; WP = POW
        const hp = Math.ceil((this.#data.stats.con + this.#data.stats.str) / 2);
        updates['system.health.max'] = hp;
        updates['system.health.value'] = hp;
        updates['system.wp.max'] = this.#data.stats.pow;
        updates['system.wp.value'] = this.#data.stats.pow;

        // Sanity = POW × 5
        updates['system.sanity.value'] = this.#data.stats.pow * 5;
        updates['system.sanity.currentBreakingPoint'] = this.#data.stats.pow * 5 - this.#data.stats.pow;

        // Skills — base profession values
        for (const [key, value] of Object.entries(this.#data.skills)) {
            if (SKILL_KEY_MAP[key]) {
                updates[`system.skills.${key}.proficiency`] = value;
            }
        }

        // Bonus skill boosts — added on top of profession values, capped at 80
        for (const [key, boosts] of Object.entries(this.#data.bonusBoosts)) {
            if (boosts > 0 && SKILL_KEY_MAP[key]) {
                const base = this.#data.skills[key] ?? SKILL_DEFAULTS[key] ?? 0;
                updates[`system.skills.${key}.proficiency`] = Math.min(80, base + boosts * 20);
            }
        }

        // Biography — actor name is top-level; remaining fields go to system.biography
        const bioName = this.#data.biography.name;
        if (bioName) updates['name'] = bioName;
        for (const [k, v] of Object.entries(this.#data.biography)) {
            if (k === 'name') continue;
            updates[`system.biography.${k}`] = v;
        }

        await this.#actor.update(updates);

        // Bonds — create as Bond items (remove existing first to avoid duplicates)
        if (this.#data.bonds.length > 0) {
            const existingBonds = this.#actor.items.filter(i => i.type === 'bond');
            if (existingBonds.length > 0) {
                await this.#actor.deleteEmbeddedDocuments('Item', existingBonds.map(i => i.id));
            }
            const bondItems = this.#data.bonds.map(b => ({
                name: b.name || 'Unnamed Bond',
                type: 'bond',
                system: { score: b.score, relationship: '', description: '' },
            }));
            await this.#actor.createEmbeddedDocuments('Item', bondItems);
        }

        // Equipment — create as Items on the actor
        if (this.#data.equipment.length > 0) {
            // Map 'gear' type to 'item' for DG system compatibility
            const typeMap = { gear: 'item' };
            const eqItems = this.#data.equipment
                .map(name => {
                    const item = EQUIPMENT_CATALOG.find(i => i.name === name);
                    if (!item) return null;
                    return { ...item, type: typeMap[item.type] ?? item.type };
                })
                .filter(Boolean);
            if (eqItems.length > 0) {
                await this.#actor.createEmbeddedDocuments('Item', eqItems);
            }
        }
    }
}
