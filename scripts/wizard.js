import { PROFESSIONS } from './professions.js';
import { BONDS } from './bonds.js';

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

const STEPS = ['welcome', 'stats', 'profession', 'skills', 'bonds', 'biography', 'review'];

// ---------------------------------------------------------------------------
// Wizard Application (ApplicationV2, Foundry v13)
// ---------------------------------------------------------------------------
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class DeltaGreenChargenWizard extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @type {Actor} */
    #actor;

    /** @type {number}  index into STEPS[] */
    #step = 0;

    /** Transient data collected across steps before writing to the Actor. */
    #data = {
        stats: { str: 10, con: 10, dex: 10, int: 10, pow: 10, cha: 10 },
        professionKey: '',
        skills: {},          // key → value
        optionalPicks: [],   // indices of chosen optional skills
        bonds: [],           // array of { name, score }
        biography: { profession: '', employer: '', nationality: '', sex: '', age: '', education: '' },
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
        position: { width: 760, height: 680 },
        actions: {
            nextStep: DeltaGreenChargenWizard.#onNextStep,
            prevStep: DeltaGreenChargenWizard.#onPrevStep,
            rollStats: DeltaGreenChargenWizard.#onRollStats,
            addBond: DeltaGreenChargenWizard.#onAddBond,
            removeBond: DeltaGreenChargenWizard.#onRemoveBond,
            suggestBond: DeltaGreenChargenWizard.#onSuggestBond,
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
            professions: Object.entries(PROFESSIONS).map(([key, p]) => ({ key, title: p.title })),
            professionKey: profKey,
            profession: prof,
            skills: this.#buildSkillContext(prof),
            bonds: this.#data.bonds,
            bondLimit,
            bondsAtLimit: this.#data.bonds.length >= bondLimit,
            biography: this.#data.biography,
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
            skills: Object.entries(this.#data.skills).map(([k, v]) => ({ key: k, label: k, value: v })),
            bonds: this.#data.bonds,
            biography: this.#data.biography,
        };
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

        // Skills
        for (const [key, value] of Object.entries(this.#data.skills)) {
            if (SKILL_KEY_MAP[key]) {
                updates[`system.skills.${key}.proficiency`] = value;
            }
        }

        // Biography
        for (const [k, v] of Object.entries(this.#data.biography)) {
            updates[`system.biography.${k}`] = v;
        }

        await this.#actor.update(updates);

        // Bonds — create as Bond items
        if (this.#data.bonds.length > 0) {
            // Remove existing bonds first to avoid duplicates on re-run
            const existingBonds = this.#actor.items.filter(i => i.type === 'bond');
            if (existingBonds.length > 0) {
                await this.#actor.deleteEmbeddedDocuments('Item', existingBonds.map(i => i.id));
            }
            const bondItems = this.#data.bonds.map(b => ({
                name: b.name || 'Unnamed Bond',
                type: 'bond',
                system: {
                    score: b.score,
                    relationship: '',
                    description: '',
                },
            }));
            await this.#actor.createEmbeddedDocuments('Item', bondItems);
        }
    }
}
