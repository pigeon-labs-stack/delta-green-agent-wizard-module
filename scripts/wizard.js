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

// All skill options for bonus picks: base skills + common subspecialties, sorted alphabetically.
const BONUS_SKILL_OPTIONS = [
    { key: 'accounting',              label: 'Accounting' },
    { key: 'alertness',               label: 'Alertness' },
    { key: 'anthropology',            label: 'Anthropology' },
    { key: 'archeology',              label: 'Archeology' },
    { key: 'art_painting',            label: 'Art (Painting)' },
    { key: 'art_photography',         label: 'Art (Photography)' },
    { key: 'art_writing',             label: 'Art (Writing)' },
    { key: 'artillery',               label: 'Artillery' },
    { key: 'athletics',               label: 'Athletics' },
    { key: 'bureaucracy',             label: 'Bureaucracy' },
    { key: 'computer_science',        label: 'Computer Science' },
    { key: 'craft_electrician',       label: 'Craft (Electrician)' },
    { key: 'craft_locksmithing',      label: 'Craft (Locksmithing)' },
    { key: 'craft_mechanic',          label: 'Craft (Mechanic)' },
    { key: 'craft_microelectronics',  label: 'Craft (Microelectronics)' },
    { key: 'criminology',             label: 'Criminology' },
    { key: 'demolitions',             label: 'Demolitions' },
    { key: 'disguise',                label: 'Disguise' },
    { key: 'dodge',                   label: 'Dodge' },
    { key: 'drive',                   label: 'Drive' },
    { key: 'firearms',                label: 'Firearms' },
    { key: 'first_aid',               label: 'First Aid' },
    { key: 'foreign_language_arabic', label: 'Foreign Language (Arabic)' },
    { key: 'foreign_language_chinese',label: 'Foreign Language (Chinese)' },
    { key: 'foreign_language_french', label: 'Foreign Language (French)' },
    { key: 'foreign_language_russian',label: 'Foreign Language (Russian)' },
    { key: 'foreign_language_spanish',label: 'Foreign Language (Spanish)' },
    { key: 'forensics',               label: 'Forensics' },
    { key: 'heavy_machiner',          label: 'Heavy Machinery' },
    { key: 'heavy_weapons',           label: 'Heavy Weapons' },
    { key: 'history',                 label: 'History' },
    { key: 'humint',                  label: 'HUMINT' },
    { key: 'law',                     label: 'Law' },
    { key: 'medicine',                label: 'Medicine' },
    { key: 'melee_weapons',           label: 'Melee Weapons' },
    { key: 'navigate',                label: 'Navigate' },
    { key: 'occult',                  label: 'Occult' },
    { key: 'persuade',                label: 'Persuade' },
    { key: 'pharmacy',                label: 'Pharmacy' },
    { key: 'psychotherapy',           label: 'Psychotherapy' },
    { key: 'ride',                    label: 'Ride' },
    { key: 'science_biology',         label: 'Science (Biology)' },
    { key: 'science_chemistry',       label: 'Science (Chemistry)' },
    { key: 'science_mathematics',     label: 'Science (Mathematics)' },
    { key: 'science_physics',         label: 'Science (Physics)' },
    { key: 'search',                  label: 'Search' },
    { key: 'sigint',                  label: 'SIGINT' },
    { key: 'stealth',                 label: 'Stealth' },
    { key: 'surgery',                 label: 'Surgery' },
    { key: 'survival',                label: 'Survival' },
    { key: 'swim',                    label: 'Swim' },
    { key: 'unarmed_combat',          label: 'Unarmed Combat' },
    { key: 'unnatural',               label: 'Unnatural' },
];

// Map from wizard skill key → DG Foundry typed skill {group, label}.
// group must be the localization key suffix used by DG.TypeSkills.{group}.
const TYPED_SKILL_MAP = {
    art_painting:             { group: 'Art',             label: 'Painting' },
    art_photography:          { group: 'Art',             label: 'Photography' },
    art_writing:              { group: 'Art',             label: 'Writing' },
    craft_electrician:        { group: 'Craft',           label: 'Electrician' },
    craft_locksmithing:       { group: 'Craft',           label: 'Locksmithing' },
    craft_mechanic:           { group: 'Craft',           label: 'Mechanic' },
    craft_microelectronics:   { group: 'Craft',           label: 'Microelectronics' },
    foreign_language_arabic:  { group: 'ForeignLanguage', label: 'Arabic' },
    foreign_language_chinese: { group: 'ForeignLanguage', label: 'Chinese (Mandarin)' },
    foreign_language_french:  { group: 'ForeignLanguage', label: 'French' },
    foreign_language_russian: { group: 'ForeignLanguage', label: 'Russian' },
    foreign_language_spanish: { group: 'ForeignLanguage', label: 'Spanish' },
    science_biology:          { group: 'Science',         label: 'Biology' },
    science_chemistry:        { group: 'Science',         label: 'Chemistry' },
    science_mathematics:      { group: 'Science',         label: 'Mathematics' },
    science_physics:          { group: 'Science',         label: 'Physics' },
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
        bonusBoosts: ['', '', '', '', '', '', '', ''],  // 8 bonus-pick slots (each holds a skill key)
        bonds: [],           // array of { name, score, relationship, description }
        biography: { name: '', profession: '', employer: '', nationality: '', sex: '', age: '', education: '', physicalDescription: '' },
        motivations: ['', '', '', '', ''],               // up to 5 motivation strings
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
        const optLimit = prof ? (prof.optionalSkills?.[0]?.limit ?? 2) : 0;
        const optPicksUsed = this.#data.optionalPicks.length;

        // Pre-fill all bond slots when entering the bonds step
        if (step === 'bonds' && prof) {
            const limit = this.#getBondLimit(prof);
            while (this.#data.bonds.length < limit) {
                this.#data.bonds.push({ name: '', score: this.#data.stats.cha, relationship: '', description: '' });
            }
        }

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
            optLimit,
            optPicksUsed,
            bonds: this.#data.bonds,
            bondLimit,
            bondsAtLimit: this.#data.bonds.length >= bondLimit,
            biography: this.#data.biography,
            motivations: this.#data.motivations,
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
        const normalized = name.toLowerCase()
            .replace(/[^a-z]/g, '_')
            .replace(/__+/g, '_')
            .replace(/^_+|_+$/g, '');  // strip leading/trailing underscores
        if (SKILL_KEY_MAP[normalized]) return normalized;
        if (TYPED_SKILL_MAP[normalized]) return normalized;
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
    // Build bonus skill context for the bonus_skills step (8 dropdown slots)
    // -----------------------------------------------------------------------
    #buildBonusSkillContext() {
        const rawSlots = this.#data.bonusBoosts;
        const slots = rawSlots.map((key, i) => ({ index: i, key }));
        const picksUsed = rawSlots.filter(k => k !== '').length;
        return { options: BONUS_SKILL_OPTIONS, slots, picksUsed };
    }

    // -----------------------------------------------------------------------
    // Build summary for the review step
    // -----------------------------------------------------------------------
    #buildReviewContext() {
        const boostCounts = {};
        for (const key of this.#data.bonusBoosts) {  // eslint-disable-line no-unused-vars
            if (key) boostCounts[key] = (boostCounts[key] ?? 0) + 1;
        }
        const bonusAllocations = Object.entries(boostCounts)
            .map(([key, count]) => {
                const label = BONUS_SKILL_OPTIONS.find(s => s.key === key)?.label
                    ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                return { label, count, total: count * 20 };
            })
            .sort((a, b) => a.label.localeCompare(b.label));

        return {
            stats: Object.entries(this.#data.stats).map(([k, v]) => ({
                key: k, label: STAT_LABELS[k], value: v, x5: v * 5,
            })),
            profession: this.#data.professionKey
                ? PROFESSIONS[this.#data.professionKey]?.title ?? this.#data.professionKey
                : '—',
            skills: Object.entries(this.#data.skills).map(([k, v]) => {
                const boosts = boostCounts[k] ?? 0;
                const effective = Math.min(80, v + boosts * 20);
                const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                return { key: k, label, value: effective };
            }),
            bonds: this.#data.bonds,
            biography: Object.entries(this.#data.biography)
                .filter(([, v]) => v)
                .map(([k, v]) => ({
                    key: k,
                    label: k === 'physicalDescription' ? 'Physical Description'
                        : k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    value: v,
                })),
            motivations: this.#data.motivations.filter(m => m.trim()),
            equipment: this.#data.equipment,
            bonusAllocations,
        };
    }

    // -----------------------------------------------------------------------
    // _onRender — called after every Handlebars re-render
    // -----------------------------------------------------------------------
    async _onRender(context, options) {
        await super._onRender?.(context, options);
        if (STEPS[this.#step] === 'equipment') this.#buildEquipmentUI();
        if (STEPS[this.#step] === 'skills') this.#setupSkillsUI();
    }

    // -----------------------------------------------------------------------
    // Skills step: live optional-pick counter + checkbox locking
    // -----------------------------------------------------------------------
    #setupSkillsUI() {
        const el = this.element;
        if (!el) return;
        const counterEl = el.querySelector('.dg-opt-picks-counter');
        if (!counterEl) return;
        const optLimit = parseInt(counterEl.dataset.limit, 10) || 2;

        const updateCounter = () => {
            const checked = el.querySelectorAll('input[name="optPick"]:checked').length;
            counterEl.innerHTML = `Optional picks: <strong>${checked} / ${optLimit}</strong>${checked >= optLimit ? ' 🔒' : ''}`;
            counterEl.classList.toggle('at-limit', checked >= optLimit);
            el.querySelectorAll('input[name="optPick"]:not(:checked)').forEach(cb => { cb.disabled = checked >= optLimit; });
            el.querySelectorAll('input[name="optPick"]:checked').forEach(cb => { cb.disabled = false; });
        };

        el.querySelectorAll('input[name="optPick"]').forEach(cb => cb.addEventListener('change', updateCounter));
        updateCounter();
    }

    // -----------------------------------------------------------------------
    // Equipment step: build interactive catalog + loadout panels
    // -----------------------------------------------------------------------
    #buildEquipmentUI() {
        const el = this.element;
        if (!el) return;

        const searchInput = el.querySelector('#dg-eq-search');
        const catTabsEl = el.querySelector('#dg-eq-cat-tabs');
        const catalogEl = el.querySelector('#dg-eq-catalog');
        const loadoutEl = el.querySelector('#dg-eq-loadout');
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
        if (this.#data.bonds[idx]) {
            this.#data.bonds[idx].name = suggestion.name;
            this.#data.bonds[idx].relationship = suggestion.relationship ?? '';
            this.#data.bonds[idx].description = suggestion.description ?? '';
        }
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
        const fd = new foundry.applications.ux.FormDataExtended(form);
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
            const prof = PROFESSIONS[key];
            // Auto-fill biography profession field from profession title
            if (!this.#data.biography.profession) {
                this.#data.biography.profession = prof.title;
            }
            // Pre-fill required skill values
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
            const slots = [];
            for (let i = 0; i < 8; i++) {
                slots.push((raw[`bonusSlot.${i}`] ?? '').toString());
            }
            this.#data.bonusBoosts = slots;
            return true;
        }

        if (step === 'bonds') {
            this.#data.bonds = this.#data.bonds.map((bond, i) => ({
                name: (raw[`bonds.${i}.name`] ?? bond.name).toString().trim(),
                score: parseInt(raw[`bonds.${i}.score`], 10) || bond.score,
                relationship: bond.relationship ?? '',
                description: bond.description ?? '',
            }));
        }

        if (step === 'biography') {
            for (const k of Object.keys(this.#data.biography)) {
                this.#data.biography[k] = (raw[`biography.${k}`] ?? '').toString().trim();
            }
            for (let i = 0; i < 5; i++) {
                this.#data.motivations[i] = (raw[`motivation.${i}`] ?? '').toString().trim();
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

        // Statistics + stat descriptors (distinguishing_feature)
        for (const [k, v] of Object.entries(this.#data.stats)) {
            updates[`system.statistics.${k}.value`] = v;
            updates[`system.statistics.${k}.distinguishing_feature`] = getStatDescriptor(k, v);
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

        // Skills — base profession values; typed skills collected separately
        const typedSkillUpdates = {};  // key → {label, group, proficiency}
        for (const [key, value] of Object.entries(this.#data.skills)) {
            if (SKILL_KEY_MAP[key]) {
                updates[`system.skills.${key}.proficiency`] = value;
            } else if (TYPED_SKILL_MAP[key]) {
                typedSkillUpdates[key] = { ...TYPED_SKILL_MAP[key], proficiency: value };
            }
        }

        // Bonus skill boosts — count occurrences in the 8-slot array, capped at 80
        const boostCounts = {};
        for (const key of this.#data.bonusBoosts) {
            if (key) boostCounts[key] = (boostCounts[key] ?? 0) + 1;
        }
        for (const [key, boosts] of Object.entries(boostCounts)) {
            if (boosts <= 0) continue;
            if (SKILL_KEY_MAP[key]) {
                const base = this.#data.skills[key] ?? SKILL_DEFAULTS[key] ?? 0;
                updates[`system.skills.${key}.proficiency`] = Math.min(80, base + boosts * 20);
            } else if (TYPED_SKILL_MAP[key]) {
                const existing = typedSkillUpdates[key];
                const base = existing?.proficiency ?? 0;
                typedSkillUpdates[key] = { ...TYPED_SKILL_MAP[key], proficiency: Math.min(80, base + boosts * 20) };
            }
        }

        // Apply typed/specialty skills as system.typedSkills entries
        for (const [key, tsData] of Object.entries(typedSkillUpdates)) {
            const tsKey = `tskill_wiz_${key}`;
            updates[`system.typedSkills.${tsKey}.label`] = tsData.label;
            updates[`system.typedSkills.${tsKey}.group`] = tsData.group;
            updates[`system.typedSkills.${tsKey}.proficiency`] = tsData.proficiency;
            updates[`system.typedSkills.${tsKey}.failure`] = false;
        }

        // Biography — actor name is top-level; physicalDescription is system.physicalDescription
        const bioName = this.#data.biography.name;
        if (bioName) updates['name'] = bioName;
        for (const [k, v] of Object.entries(this.#data.biography)) {
            if (k === 'name') continue;
            if (k === 'physicalDescription') {
                updates['system.physicalDescription'] = v;
            } else {
                updates[`system.biography.${k}`] = v;
            }
        }

        await this.#actor.update(updates);

        // Bonds — create as Bond items (remove existing first to avoid duplicates)
        if (this.#data.bonds.length > 0) {
            const existingBonds = this.#actor.items.filter(i => i.type === 'bond');
            if (existingBonds.length > 0) {
                await this.#actor.deleteEmbeddedDocuments('Item', existingBonds.map(i => i.id));
            }
            const bondItems = this.#data.bonds
                .filter(b => b.name)
                .map(b => ({
                    name: b.name,
                    type: 'bond',
                    system: { score: b.score, relationship: b.relationship ?? '', description: b.description ?? '' },
                }));
            if (bondItems.length > 0) {
                await this.#actor.createEmbeddedDocuments('Item', bondItems);
            }
        }

        // Motivations — create as motivation items
        const motivationStrings = this.#data.motivations.filter(m => m.trim());
        if (motivationStrings.length > 0) {
            const motivationItems = motivationStrings.map(m => ({
                name: m,
                type: 'motivation',
                system: { disorder: '', crossedOut: false, disorderCured: false },
            }));
            await this.#actor.createEmbeddedDocuments('Item', motivationItems);
        }

        // Equipment — create as Items on the actor
        if (this.#data.equipment.length > 0) {
            const eqItems = this.#data.equipment
                .map(name => EQUIPMENT_CATALOG.find(i => i.name === name))
                .filter(Boolean);
            if (eqItems.length > 0) {
                await this.#actor.createEmbeddedDocuments('Item', eqItems);
            }
        }
    }
}
