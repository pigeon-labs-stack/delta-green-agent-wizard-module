import { PROFESSIONS } from './professions.js';
import { BONDS } from './bonds.js';
import { EQUIPMENT_CATALOG, EQUIPMENT_CATEGORIES } from './equipment.js';
import { generateBio } from './bio-data.js';
import { exportToPDF } from './pdf-export.js';

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
    { key: 'accounting', label: 'Accounting' },
    { key: 'alertness', label: 'Alertness' },
    { key: 'anthropology', label: 'Anthropology' },
    { key: 'archeology', label: 'Archeology' },
    { key: 'art_painting', label: 'Art (Painting)' },
    { key: 'art_photography', label: 'Art (Photography)' },
    { key: 'art_writing', label: 'Art (Writing)' },
    { key: '_custom_Art', label: 'Art (Other…)' },
    { key: 'artillery', label: 'Artillery' },
    { key: 'athletics', label: 'Athletics' },
    { key: 'bureaucracy', label: 'Bureaucracy' },
    { key: 'computer_science', label: 'Computer Science' },
    { key: 'craft_electrician', label: 'Craft (Electrician)' },
    { key: 'craft_locksmithing', label: 'Craft (Locksmithing)' },
    { key: 'craft_mechanic', label: 'Craft (Mechanic)' },
    { key: 'craft_microelectronics', label: 'Craft (Microelectronics)' },
    { key: '_custom_Craft', label: 'Craft (Other…)' },
    { key: 'criminology', label: 'Criminology' },
    { key: 'demolitions', label: 'Demolitions' },
    { key: 'disguise', label: 'Disguise' },
    { key: 'dodge', label: 'Dodge' },
    { key: 'drive', label: 'Drive' },
    { key: 'firearms', label: 'Firearms' },
    { key: 'first_aid', label: 'First Aid' },
    { key: 'foreign_language_arabic', label: 'Foreign Language (Arabic)' },
    { key: 'foreign_language_chinese', label: 'Foreign Language (Chinese)' },
    { key: 'foreign_language_french', label: 'Foreign Language (French)' },
    { key: 'foreign_language_russian', label: 'Foreign Language (Russian)' },
    { key: 'foreign_language_spanish', label: 'Foreign Language (Spanish)' },
    { key: '_custom_ForeignLanguage', label: 'Foreign Language (Other…)' },
    { key: 'forensics', label: 'Forensics' },
    { key: 'heavy_machiner', label: 'Heavy Machinery' },
    { key: 'heavy_weapons', label: 'Heavy Weapons' },
    { key: 'history', label: 'History' },
    { key: 'humint', label: 'HUMINT' },
    { key: 'law', label: 'Law' },
    { key: 'medicine', label: 'Medicine' },
    { key: 'melee_weapons', label: 'Melee Weapons' },
    { key: 'military_science_air', label: 'Military Science (Air)' },
    { key: 'military_science_land', label: 'Military Science (Land)' },
    { key: 'military_science_sea', label: 'Military Science (Sea)' },
    { key: 'military_science_special_operations', label: 'Military Science (Special Ops)' },
    { key: '_custom_MilitaryScience', label: 'Military Science (Other…)' },
    { key: 'navigate', label: 'Navigate' },
    { key: 'occult', label: 'Occult' },
    { key: 'persuade', label: 'Persuade' },
    { key: 'pharmacy', label: 'Pharmacy' },
    { key: 'pilot_airplane', label: 'Pilot (Airplane)' },
    { key: 'pilot_helicopter', label: 'Pilot (Helicopter)' },
    { key: '_custom_Pilot', label: 'Pilot (Other…)' },
    { key: 'psychotherapy', label: 'Psychotherapy' },
    { key: 'ride', label: 'Ride' },
    { key: 'science_biology', label: 'Science (Biology)' },
    { key: 'science_chemistry', label: 'Science (Chemistry)' },
    { key: 'science_mathematics', label: 'Science (Mathematics)' },
    { key: 'science_physics', label: 'Science (Physics)' },
    { key: '_custom_Science', label: 'Science (Other…)' },
    { key: 'search', label: 'Search' },
    { key: 'sigint', label: 'SIGINT' },
    { key: 'stealth', label: 'Stealth' },
    { key: 'surgery', label: 'Surgery' },
    { key: 'survival', label: 'Survival' },
    { key: 'swim', label: 'Swim' },
    { key: 'unarmed_combat', label: 'Unarmed Combat' },
    { key: 'unnatural', label: 'Unnatural' },
];

// Specialty skill bases and their Foundry DG.TypeSkills group key suffix.
const SPECIALTY_PREFIXES = {
    'Art': 'Art',
    'Craft': 'Craft',
    'Foreign Language': 'ForeignLanguage',
    'Science': 'Science',
    'Pilot': 'Pilot',
    'Military Science': 'MilitaryScience',
};

// Suggested subspecialties shown as datalist in the skills step.
const SPECIALTY_OPTIONS = {
    Art: ['Acting', 'Drawing', 'Fine Art', 'Music', 'Painting', 'Photography', 'Sculpture', 'Writing'],
    Craft: ['Carpentry', 'Electrician', 'Locksmithing', 'Mechanic', 'Microelectronics', 'Plumbing', 'Welding'],
    ForeignLanguage: ['Arabic', 'Chinese (Mandarin)', 'Farsi/Persian', 'French', 'German', 'Hebrew', 'Hindi', 'Italian', 'Japanese', 'Korean', 'Portuguese', 'Russian', 'Spanish', 'Swahili', 'Turkish'],
    Science: ['Astronomy', 'Biology', 'Chemistry', 'Geology', 'Mathematics', 'Meteorology', 'Oceanography', 'Pharmacology', 'Physics'],
    Pilot: ['Airplane', 'Drone', 'Helicopter', 'Jet Aircraft', 'Ship', 'Small Boat'],
    MilitaryScience: ['Air', 'Land', 'Sea', 'Special Operations'],
};

/**
 * Parse a skill display name like "Foreign Language (Spanish)" or bare "Science".
 * Returns {group, label} if it’s a specialty skill, otherwise null.
 * `label` is '' when bare (subspecialty not yet chosen).
 */
function parseSpecialtyFromName(name) {
    for (const [base, group] of Object.entries(SPECIALTY_PREFIXES)) {
        if (name === base) return { group, label: '' };
        if (name.startsWith(base + ' (') && name.endsWith(')')) {
            return { group, label: name.slice(base.length + 2, -1) };
        }
    }
    return null;
}

/**
 * Parse a normalised key like "craft_electrician" or "military_science_land".
 * Returns {group, label} for specialty bonus-pick keys, otherwise null.
 */
function parseSpecialtyFromKey(key) {
    // Order matters — check longer prefixes first to avoid false matches.
    const prefixMap = [
        ['military_science_', 'MilitaryScience'],
        ['foreign_language_', 'ForeignLanguage'],
        ['science_', 'Science'],
        ['craft_', 'Craft'],
        ['pilot_', 'Pilot'],
        ['art_', 'Art'],
    ];
    for (const [prefix, group] of prefixMap) {
        if (key.startsWith(prefix)) {
            const rawLabel = key.slice(prefix.length);
            const label = rawLabel.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            return { group, label };
        }
    }
    return null;
}

// Pre-built equipment loadouts — item names must match EQUIPMENT_CATALOG exactly.
const LOADOUTS = {
    federal_agent: [
        'Medium pistol', 'Tactical light or weapon light', 'Handcuffs', 'Kevlar vest',
        'Tablet computer or smartphone', 'Earpiece communication set',
        'Light rifle or carbine', 'Individual first aid kit',
    ],
    swat: [
        'Light rifle or carbine', 'Medium pistol', 'Tactical body armor', 'Kevlar helmet',
        'CED pistol', 'Pepper spray can', 'Halligan forcible-entry tool',
        'Flash-bang grenade, thrown', 'Tear gas grenade', 'Earpiece communication set',
    ],
    special_operator: [
        'Light rifle or carbine', 'Medium pistol', 'Hand grenade', 'Flash-bang grenade, thrown',
        'Long knife or combat dagger', 'Flexible cuffs', 'Tactical body armor', 'Kevlar helmet',
        'Military-grade night vision goggles', 'Short-range walkie talkie',
        'Holographic sight', 'Targeting laser', 'Sound suppressor',
    ],
    police_officer: [
        'Medium pistol', 'Kevlar vest', 'CED pistol', 'Pepper spray can',
        'Club, nightstick, or collapsible baton', 'Knife', 'Handcuffs',
        'Tactical light or weapon light', 'Short-range walkie talkie', 'Earpiece communication set',
    ],
};

const BOND_DATASETS = [
    { key: 'FRIENDS_FAMILY', label: 'Friends & Family' },
    { key: 'DELTA_GREEN', label: 'Delta Green' },
    { key: 'UNDERWORLD', label: 'Underworld / Criminal' },
    { key: 'LGBTQ', label: 'LGBTQ+' },
    { key: 'PISCES_UK', label: 'PISCES (British Intel)' },
];

// Background bonus packages from the Delta Green rulebook (p.20).
// Slot values use BONUS_SKILL_OPTIONS keys; '_custom_*' = type-your-own specialty; '' = free pick.
const BONUS_PACKAGES = [
    {
        label: 'Artist, Actor, or Musician',
        desc: 'Alertness · Craft (choose) · Disguise · Persuade · Art (choose) ×3 · HUMINT',
        skills: ['alertness', '_custom_Craft', 'disguise', 'persuade', '_custom_Art', '_custom_Art', '_custom_Art', 'humint']
    },
    {
        label: 'Athlete',
        desc: 'Alertness · Athletics · Dodge · First Aid · HUMINT · Persuade · Swim · Unarmed Combat',
        skills: ['alertness', 'athletics', 'dodge', 'first_aid', 'humint', 'persuade', 'swim', 'unarmed_combat']
    },
    {
        label: 'Author, Editor, or Journalist',
        desc: 'Anthropology · Art (choose) · Bureaucracy · History · HUMINT · Law · Occult · Persuade',
        skills: ['anthropology', '_custom_Art', 'bureaucracy', 'history', 'humint', 'law', 'occult', 'persuade']
    },
    {
        label: '"Black Bag" Training',
        desc: 'Alertness · Athletics · Craft (Electrician) · Craft (Locksmithing) · Criminology · Disguise · Search · Stealth',
        skills: ['alertness', 'athletics', 'craft_electrician', 'craft_locksmithing', 'criminology', 'disguise', 'search', 'stealth']
    },
    {
        label: 'Blue-Collar Worker',
        desc: 'Alertness · Craft (choose) ×2 · Drive · First Aid · Heavy Machinery · Navigate · Search',
        skills: ['alertness', '_custom_Craft', '_custom_Craft', 'drive', 'first_aid', 'heavy_machiner', 'navigate', 'search']
    },
    {
        label: 'Bureaucrat',
        desc: 'Accounting · Bureaucracy · Computer Science · Criminology · HUMINT · Law · Persuade · personal specialty (choose)',
        skills: ['accounting', 'bureaucracy', 'computer_science', 'criminology', 'humint', 'law', 'persuade', '']
    },
    {
        label: 'Clergy',
        desc: 'Foreign Language (choose) ×3 · History · HUMINT · Occult · Persuade · Psychotherapy',
        skills: ['_custom_ForeignLanguage', '_custom_ForeignLanguage', '_custom_ForeignLanguage', 'history', 'humint', 'occult', 'persuade', 'psychotherapy']
    },
    {
        label: 'Combat Veteran',
        desc: 'Alertness · Dodge · Firearms · First Aid · Heavy Weapons · Melee Weapons · Stealth · Unarmed Combat',
        skills: ['alertness', 'dodge', 'firearms', 'first_aid', 'heavy_weapons', 'melee_weapons', 'stealth', 'unarmed_combat']
    },
    {
        label: 'Computer Enthusiast or Hacker',
        desc: 'Computer Science · Craft (Microelectronics) · Science (Mathematics) · SIGINT · personal specialties ×4 (choose freely)',
        skills: ['computer_science', 'craft_microelectronics', 'science_mathematics', 'sigint', '', '', '', '']
    },
    {
        label: 'Counselor',
        desc: 'Bureaucracy · First Aid · Foreign Language (choose) · HUMINT · Law · Persuade · Psychotherapy · Search',
        skills: ['bureaucracy', 'first_aid', '_custom_ForeignLanguage', 'humint', 'law', 'persuade', 'psychotherapy', 'search']
    },
    {
        label: 'Criminalist',
        desc: 'Accounting · Bureaucracy · Computer Science · Criminology · Forensics · Law · Pharmacy · Search',
        skills: ['accounting', 'bureaucracy', 'computer_science', 'criminology', 'forensics', 'law', 'pharmacy', 'search']
    },
    {
        label: 'Firefighter',
        desc: 'Alertness · Demolitions · Drive · First Aid · Forensics · Heavy Machinery · Navigate · Search',
        skills: ['alertness', 'demolitions', 'drive', 'first_aid', 'forensics', 'heavy_machiner', 'navigate', 'search']
    },
    {
        label: 'Gangster or Deep Cover',
        desc: 'Alertness · Criminology · Dodge · Drive · Persuade · Stealth · choose 2 freely',
        skills: ['alertness', 'criminology', 'dodge', 'drive', 'persuade', 'stealth', '', '']
    },
    {
        label: 'Interrogator',
        desc: 'Criminology · Foreign Language (choose) ×2 · HUMINT · Law · Persuade · Pharmacy · Search',
        skills: ['criminology', '_custom_ForeignLanguage', '_custom_ForeignLanguage', 'humint', 'law', 'persuade', 'pharmacy', 'search']
    },
    {
        label: 'Liberal Arts Degree',
        desc: 'Anthropology · Art (choose) · Foreign Language (choose) · History · Persuade · personal specialties ×3',
        skills: ['anthropology', '_custom_Art', '_custom_ForeignLanguage', 'history', 'persuade', '', '', '']
    },
    {
        label: 'Military Officer',
        desc: 'Bureaucracy · Firearms · History · Military Science (choose) · Navigate · Persuade · Unarmed Combat · choose 1 freely',
        skills: ['bureaucracy', 'firearms', 'history', '_custom_MilitaryScience', 'navigate', 'persuade', 'unarmed_combat', '']
    },
    {
        label: 'MBA',
        desc: 'Accounting · Bureaucracy · HUMINT · Law · Persuade · personal specialties ×3 (choose freely)',
        skills: ['accounting', 'bureaucracy', 'humint', 'law', 'persuade', '', '', '']
    },
    {
        label: 'Nurse, Paramedic, or Pre-Med',
        desc: 'Alertness · First Aid · Medicine · Persuade · Pharmacy · Psychotherapy · Science (Biology) · Search',
        skills: ['alertness', 'first_aid', 'medicine', 'persuade', 'pharmacy', 'psychotherapy', 'science_biology', 'search']
    },
    {
        label: 'Occult Investigator or Conspiracy Theorist',
        desc: 'Anthropology · Archeology · Computer Science · Criminology · History · Occult · Persuade · Search',
        skills: ['anthropology', 'archeology', 'computer_science', 'criminology', 'history', 'occult', 'persuade', 'search']
    },
    {
        label: 'Outdoorsman',
        desc: 'Alertness · Athletics · Firearms · Navigate · Ride · Search · Stealth · Survival',
        skills: ['alertness', 'athletics', 'firearms', 'navigate', 'ride', 'search', 'stealth', 'survival']
    },
    {
        label: 'Photographer',
        desc: 'Alertness · Art (Photography) · Computer Science · Persuade · Search · Stealth · personal specialties ×2',
        skills: ['alertness', 'art_photography', 'computer_science', 'persuade', 'search', 'stealth', '', '']
    },
];

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
        bonusCustom: ['', '', '', '', '', '', '', ''],  // custom label text for '_custom_*' bonus slots
        bondDataset: 'FRIENDS_FAMILY',                  // active bond suggestion dataset
        selectedPackIdx: -1,                            // last applied background package index
        bonds: [],           // array of { name, score, relationship, description }
        specialtySlots: [],  // [{id, group, label, proficiency, required, optIndex}] typed/specialty skills
        optSpecialtyLabels: {},  // optIndex → label string for checked optional specialty picks
        biography: { name: '', profession: '', employer: '', nationality: '', sex: '', age: '', education: '', physicalDescription: '', notes: '' },
        motivations: ['', '', '', '', ''],               // up to 5 motivation strings
        equipment: [],       // array of item names from catalog
    };

    constructor(actor, options = {}) {
        super(options);
        this.#actor = actor;
        this.#loadState();
    }

    // -----------------------------------------------------------------------
    // Persist wizard progress to actor flags so it survives disconnects
    // -----------------------------------------------------------------------
    #saveState() {
        this.#actor.setFlag('delta-green-agent-wizard', 'wizardState', {
            step: this.#step,
            data: this.#data,
        }).catch(() => { });
    }

    #loadState() {
        const saved = this.#actor.getFlag('delta-green-agent-wizard', 'wizardState');
        if (!saved) return;
        if (typeof saved.step === 'number') this.#step = saved.step;
        if (saved.data) this.#data = foundry.utils.mergeObject(this.#data, saved.data, { inplace: false });
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
            removeBond: DeltaGreenChargenWizard.#onRemoveBond,
            suggestBond: DeltaGreenChargenWizard.#onSuggestBond,
            randomBio: DeltaGreenChargenWizard.#onRandomBio,
            clearEquipment: DeltaGreenChargenWizard.#onClearEquipment,
            finish: DeltaGreenChargenWizard.#onFinish,
            loadLoadout: DeltaGreenChargenWizard.#onLoadLoadout,
            fillPack: DeltaGreenChargenWizard.#onFillPack,
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
        const optLimit = prof ? (prof.optionalSkills?.[0]?.limit ?? 0) : 0;
        const optPicksUsed = this.#data.optionalPicks.length;
        const specialtyContext = step === 'skills' ? this.#buildSpecialtyContext(prof) : null;
        const optionalSkillItems = step === 'skills' ? this.#buildOptionalSkillItems(prof) : [];
        const hasOptionalSkills = optionalSkillItems.length > 0;

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
            professions: Object.entries(PROFESSIONS).map(([key, p]) => ({ key, title: p.title, description: p.description })),
            professionKey: profKey,
            profession: prof,
            skills: this.#buildSkillContext(prof),
            bonusSkills,
            optLimit,
            optPicksUsed,
            specialtyContext,
            optionalSkillItems,
            hasOptionalSkills,
            bonds: this.#data.bonds,
            bondLimit,
            bondsAtLimit: this.#data.bonds.length >= bondLimit,
            bondDataset: this.#data.bondDataset,
            bondDatasets: BOND_DATASETS,
            biography: this.#data.biography,
            motivations: this.#data.motivations,
            equipmentCount: this.#data.equipment.length,
            review: step === 'review' ? this.#buildReviewContext() : null,
        };
    }

    // -----------------------------------------------------------------------
    // Build sorted skill list for the skills step (REQUIRED only)
    // -----------------------------------------------------------------------
    #buildSkillContext(prof) {
        if (!prof) return [];
        const result = [];

        // Required skills — skip specialty types (shown in specialty section)
        for (const s of prof.requiredSkills ?? []) {
            if (parseSpecialtyFromName(s.name)) continue;
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
        return result;
    }

    // -----------------------------------------------------------------------
    // Build optional skill items for the skills step chooser section
    // -----------------------------------------------------------------------
    #buildOptionalSkillItems(prof) {
        if (!prof || !prof.optionalSkills?.length) return [];
        const items = [];
        for (let i = 0; i < prof.optionalSkills.length; i++) {
            const s = prof.optionalSkills[i];
            const sp = parseSpecialtyFromName(s.name);
            const picked = this.#data.optionalPicks.includes(i);
            if (sp) {
                const existingSlot = this.#data.specialtySlots.find(sl => sl.optIndex === i);
                items.push({
                    optIndex: i,
                    label: s.name,
                    profValue: s.value,
                    picked,
                    isSpecialty: true,
                    group: sp.group,
                    specialtyLabel: existingSlot?.label ?? this.#data.optSpecialtyLabels[i] ?? '',
                });
            } else {
                items.push({
                    optIndex: i,
                    label: s.name,
                    profValue: s.value,
                    picked,
                    isSpecialty: false,
                    group: '',
                    specialtyLabel: '',
                });
            }
        }
        return items;
    }

    // -----------------------------------------------------------------------
    // Build specialty skill context for the skills step
    // -----------------------------------------------------------------------
    #buildSpecialtyContext(prof) {
        if (!prof) return null;
        const optLimit = prof.optionalSkills?.[0]?.limit ?? 2;

        const SPECIALTY_EXAMPLES = {
            Art: 'Painting',
            Craft: 'Electrician',
            ForeignLanguage: 'Spanish',
            Science: 'Biology',
            Pilot: 'Airplane',
            MilitaryScience: 'Land',
        };

        // Required specialty slots (populated during profession step)
        const required = this.#data.specialtySlots
            .filter(sl => sl.required)
            .map(sl => ({
                ...sl,
                groupDisplay: Object.entries(SPECIALTY_PREFIXES).find(([, g]) => g === sl.group)?.[0] ?? sl.group,
                options: SPECIALTY_OPTIONS[sl.group] ?? [],
                example: SPECIALTY_EXAMPLES[sl.group] ?? sl.group,
            }));

        // Optional specialty picks from this profession
        const optional = [];
        for (let i = 0; i < (prof.optionalSkills?.length ?? 0); i++) {
            const s = prof.optionalSkills[i];
            const sp = parseSpecialtyFromName(s.name);
            if (!sp) continue;
            const existingSlot = this.#data.specialtySlots.find(sl => sl.optIndex === i);
            optional.push({
                optIndex: i,
                group: sp.group,
                groupDisplay: s.name,
                proficiency: s.value,
                picked: this.#data.optionalPicks.includes(i),
                label: existingSlot?.label ?? this.#data.optSpecialtyLabels[i] ?? '',
                options: SPECIALTY_OPTIONS[sp.group] ?? [],
                optLimit,
                example: SPECIALTY_EXAMPLES[sp.group] ?? sp.group,
            });
        }

        if (required.length === 0 && optional.length === 0) return null;

        // Deduplicated datalists (one per group used)
        const usedGroups = new Set([...required, ...optional].map(sl => sl.group));
        const dataLists = [...usedGroups].map(group => ({
            id: `dg-sp-${group}`,
            options: SPECIALTY_OPTIONS[group] ?? [],
        }));

        return {
            required: required.length > 0 ? required : null,
            optional: optional.length > 0 ? optional : null,
            dataLists,
        };
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
        const customLabels = this.#data.bonusCustom ?? [];
        const slots = rawSlots.map((key, i) => ({
            index: i,
            key,
            isCustom: key.startsWith('_custom_'),
            customLabel: customLabels[i] ?? '',
        }));
        const picksUsed = rawSlots.filter(k => k !== '').length;

        // Build options from profession specialty slots (e.g. Foreign Language (Swahili) typed in skills step)
        const profSlotOptions = this.#data.specialtySlots
            .filter(sl => sl.label.trim())
            .map(sl => {
                const groupDisplay = Object.entries(SPECIALTY_PREFIXES).find(([, g]) => g === sl.group)?.[0] ?? sl.group;
                return { key: `profslot__${sl.group}__${sl.label}`, label: `${groupDisplay} (${sl.label})` };
            });

        const packIdx = this.#data.selectedPackIdx ?? -1;
        const packDesc = packIdx >= 0 ? (BONUS_PACKAGES[packIdx]?.desc ?? '') : '';

        return { options: BONUS_SKILL_OPTIONS, profSlotOptions, packages: BONUS_PACKAGES, packIdx, packDesc, slots, picksUsed };
    }

    // -----------------------------------------------------------------------
    // Build summary for the review step
    // -----------------------------------------------------------------------
    #buildReviewContext() {
        const boostCounts = {};
        const customLabels = {};
        for (let i = 0; i < this.#data.bonusBoosts.length; i++) {
            const key = this.#data.bonusBoosts[i];
            if (!key) continue;
            if (key.startsWith('_custom_')) {
                const group = key.slice('_custom_'.length);
                const label = (this.#data.bonusCustom?.[i] ?? '').trim();
                if (!label) continue;
                const displayKey = `${group} (${label})`;
                customLabels[displayKey] = (customLabels[displayKey] ?? 0) + 1;
            } else {
                boostCounts[key] = (boostCounts[key] ?? 0) + 1;
            }
        }
        const bonusAllocations = [
            ...Object.entries(boostCounts).map(([key, count]) => {
                let label;
                if (key.startsWith('profslot__')) {
                    const parts = key.split('__');
                    const groupDisplay = Object.entries(SPECIALTY_PREFIXES).find(([, g]) => g === parts[1])?.[0] ?? parts[1];
                    label = `${groupDisplay} (${parts[2]})`;
                } else {
                    label = BONUS_SKILL_OPTIONS.find(s => s.key === key)?.label
                        ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                }
                return { label, count, total: count * 20 };
            }),
            ...Object.entries(customLabels).map(([label, count]) => ({ label, count, total: count * 20 })),
        ].sort((a, b) => a.label.localeCompare(b.label));

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
            specialtySkills: this.#data.specialtySlots
                .filter(sl => sl.label.trim())
                .map(sl => {
                    const groupDisplay = Object.entries(SPECIALTY_PREFIXES).find(([, g]) => g === sl.group)?.[0] ?? sl.group;
                    return { label: `${groupDisplay} (${sl.label})`, value: sl.proficiency };
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
    // Build state object in collectState() shape for exportToPDF
    // -----------------------------------------------------------------------
    #buildPdfState() {
        // Wizard group name → pdf-export.js skill key
        const GROUP_TO_KEY = {
            Art: 'art',
            Craft: 'craft',
            ForeignLanguage: 'foreign_language',
            Science: 'science',
            Pilot: 'pilot',
            MilitaryScience: 'military_science',
        };

        // Stats in uppercase-key format (matches csStats in collectState)
        const csStats = {
            STR: this.#data.stats.str,
            CON: this.#data.stats.con,
            DEX: this.#data.stats.dex,
            INT: this.#data.stats.int,
            POW: this.#data.stats.pow,
            CHA: this.#data.stats.cha,
        };

        const hp = Math.ceil((this.#data.stats.con + this.#data.stats.str) / 2);
        const wp = this.#data.stats.pow;
        const san = this.#data.stats.pow * 5;
        const bp = san - wp;
        const derived = { hp, wp, san, bp };

        // Compute effective plain-skill values (base + standard bonus boosts)
        const skills = { ...this.#data.skills };
        const boostCounts = {};
        for (let i = 0; i < this.#data.bonusBoosts.length; i++) {
            const key = this.#data.bonusBoosts[i];
            if (!key || key.startsWith('_custom_') || key.startsWith('profslot__')) continue;
            boostCounts[key] = (boostCounts[key] ?? 0) + 1;
        }
        for (const [key, count] of Object.entries(boostCounts)) {
            // Only boost plain skills here; specialty keys handled via specialtyInstances below
            if (!(key in skills) && !(key in SKILL_DEFAULTS)) continue;
            skills[key] = Math.min(80, (skills[key] ?? SKILL_DEFAULTS[key] ?? 0) + count * 20);
        }

        // Build specialtyInstances from profession specialty slots
        const specMap = new Map(); // `${key}||${specialty}` → instance object (for dedup/boost merging)
        for (const sl of this.#data.specialtySlots) {
            const label = sl.label.trim();
            if (!label) continue;
            const pdfKey = GROUP_TO_KEY[sl.group];
            if (!pdfKey) continue;
            const mapKey = `${pdfKey}||${label}`;
            if (specMap.has(mapKey)) {
                specMap.get(mapKey).value = Math.min(80, specMap.get(mapKey).value + sl.proficiency);
            } else {
                specMap.set(mapKey, { key: pdfKey, specialty: label, value: sl.proficiency });
            }
        }

        // Apply bonus boosts that target specialty slots (profslot__) or add new ones (_custom_)
        for (let i = 0; i < this.#data.bonusBoosts.length; i++) {
            const key = this.#data.bonusBoosts[i];
            if (!key) continue;

            if (key.startsWith('profslot__')) {
                // profslot__{group}__{label} — boost or create matching specialty instance
                const parts = key.split('__');
                const group = parts[1];  // e.g. 'ForeignLanguage'
                const label = parts[2];  // e.g. 'Spanish'
                const pdfKey = GROUP_TO_KEY[group];
                if (!pdfKey || !label) continue;
                const mapKey = `${pdfKey}||${label}`;
                if (specMap.has(mapKey)) {
                    specMap.get(mapKey).value = Math.min(80, specMap.get(mapKey).value + 20);
                } else {
                    specMap.set(mapKey, { key: pdfKey, specialty: label, value: 20 });
                }

            } else if (key.startsWith('_custom_')) {
                // _custom_{Group} — user typed a custom specialty label
                const group = key.slice('_custom_'.length);  // e.g. 'Art'
                const label = (this.#data.bonusCustom?.[i] ?? '').trim();
                if (!label) continue;
                const pdfKey = GROUP_TO_KEY[group];
                if (!pdfKey) continue;
                const mapKey = `${pdfKey}||${label}`;
                if (specMap.has(mapKey)) {
                    specMap.get(mapKey).value = Math.min(80, specMap.get(mapKey).value + 20);
                } else {
                    specMap.set(mapKey, { key: pdfKey, specialty: label, value: 20 });
                }
            }
        }

        const specialtyInstances = [...specMap.values()];

        const bio = {
            name: this.#data.biography.name,
            profession: this.#data.biography.profession,
            employer: this.#data.biography.employer,
            nationality: this.#data.biography.nationality,
            sex: this.#data.biography.sex,
            age: this.#data.biography.age,
            education: this.#data.biography.education,
            physicalDesc: this.#data.biography.physicalDescription,
            motivations: this.#data.motivations.filter(m => m.trim()).join('\n'),
            personalDetails: this.#data.biography.notes,
        };

        // Distinguishing features from stat descriptors
        const lpFeat = {};
        for (const k of ['str', 'con', 'dex', 'int', 'pow', 'cha']) {
            lpFeat[k.toUpperCase()] = getStatDescriptor(k, this.#data.stats[k]);
        }

        return {
            csStats, derived, bio, skills,
            skillSpecs: {},
            customSkills: [],
            specialtyInstances,
            bonds: this.#data.bonds,
            sanity: { violence: [false, false, false], helplessness: [false, false, false] },
            lpNotes: { wounds: '', gear: '', remarks: '' },
            lpFeat,
            lpWeapons: [],
            equipment: this.#data.equipment,
        };
    }

    // -----------------------------------------------------------------------
    // _onRender — called after every Handlebars re-render
    // -----------------------------------------------------------------------
    async _onRender(context, options) {
        await super._onRender?.(context, options);
        // Stop any previous pyramid loop when navigating away
        this.element?.querySelector('#dg-welcome-pyramid')?._stopPyramid?.();
        if (STEPS[this.#step] === 'profession') this.#setupProfessionUI();
        if (STEPS[this.#step] === 'equipment') this.#buildEquipmentUI();
        if (STEPS[this.#step] === 'skills') { this.#setupSkillsUI(); this.#setupSpecialtyUI(); }
        if (STEPS[this.#step] === 'bonus_skills') this.#setupBonusSkillsUI();
        if (STEPS[this.#step] === 'welcome') this.#initWelcomePyramid();
    }

    // -----------------------------------------------------------------------
    // Skills step: mark duplicate specialty inputs within the same group
    // -----------------------------------------------------------------------
    #setupSpecialtyUI() {
        const el = this.element;
        if (!el) return;
        const inputs = [...el.querySelectorAll('.dg-specialty-section .dg-specialty-input[data-group]')];
        if (inputs.length === 0) return;

        const checkDupes = () => {
            const byGroup = {};
            inputs.forEach(inp => {
                const g = inp.dataset.group;
                (byGroup[g] ??= []).push(inp);
            });
            Object.values(byGroup).forEach(group => {
                const vals = group.map(i => i.value.trim().toLowerCase());
                group.forEach((inp, idx) => {
                    const val = vals[idx];
                    const isDupe = val !== '' && vals.some((v, j) => j !== idx && v === val);
                    inp.classList.toggle('dg-specialty-dupe', isDupe);
                });
            });
        };

        inputs.forEach(inp => {
            inp.addEventListener('input', checkDupes);
            inp.addEventListener('change', checkDupes);
        });
        checkDupes();
    }

    // -----------------------------------------------------------------------
    // Welcome step: spinning wireframe pyramid (ported from DELTA-GREEN-STATS)
    // -----------------------------------------------------------------------
    #initWelcomePyramid() {
        const canvas = this.element?.querySelector('#dg-welcome-pyramid');
        if (!canvas) return;

        const verts = [
            [0, -1.2, 0],
            [-1, 0.6, -1],
            [1, 0.6, -1],
            [1, 0.6, 1],
            [-1, 0.6, 1],
        ];
        const edges = [[0,1],[0,2],[0,3],[0,4],[1,2],[2,3],[3,4],[4,1]];

        let ay = 0;
        const ax = 0.38;
        const ctx = canvas.getContext('2d');
        const FRAME_MS = 1000 / 24;
        let lastFrameTime = 0;
        let stopped = false;

        const rotY = (v, a) => [v[0]*Math.cos(a)+v[2]*Math.sin(a), v[1], -v[0]*Math.sin(a)+v[2]*Math.cos(a)];
        const rotX = (v, a) => [v[0], v[1]*Math.cos(a)-v[2]*Math.sin(a), v[1]*Math.sin(a)+v[2]*Math.cos(a)];
        const project = (v, cx, cy, scale) => {
            const fov = 4.5;
            const s = (fov / (v[2] + fov)) * scale;
            return [cx + v[0]*s, cy + v[1]*s];
        };

        const draw = (now) => {
            if (stopped || document.hidden) { if (!stopped) requestAnimationFrame(draw); return; }
            if (now - lastFrameTime < FRAME_MS) { requestAnimationFrame(draw); return; }
            const elapsed = now - lastFrameTime;
            lastFrameTime = now;

            const W = canvas.offsetWidth || 260;
            const H = canvas.offsetHeight || 200;
            if (canvas.width !== W) canvas.width = W;
            if (canvas.height !== H) canvas.height = H;

            ctx.clearRect(0, 0, W, H);
            const scale = Math.min(W, H) * 0.32;
            const pts = verts.map(v => project(rotX(rotY(v, ay), ax), W/2, H/2, scale));

            ctx.strokeStyle = 'rgba(0, 180, 30, 0.10)';
            ctx.lineWidth = 8;
            ctx.beginPath();
            edges.forEach(([a, b]) => { ctx.moveTo(pts[a][0], pts[a][1]); ctx.lineTo(pts[b][0], pts[b][1]); });
            ctx.stroke();

            ctx.strokeStyle = 'rgba(0, 130, 25, 0.70)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            edges.forEach(([a, b]) => { ctx.moveTo(pts[a][0], pts[a][1]); ctx.lineTo(pts[b][0], pts[b][1]); });
            ctx.stroke();

            ay += 0.00036 * elapsed;
            requestAnimationFrame(draw);
        };

        // Stop the loop when we navigate away from the welcome step
        canvas._stopPyramid = () => { stopped = true; };
        requestAnimationFrame(draw);
    }

    // -----------------------------------------------------------------------
    // Profession step: live description update on dropdown change
    // -----------------------------------------------------------------------
    #setupProfessionUI() {
        const el = this.element;
        if (!el) return;
        const select = el.querySelector('.dg-select-profession');
        const descEl = el.querySelector('.dg-profession-desc');
        if (!select || !descEl) return;

        const update = () => {
            const key = select.value;
            const prof = key ? PROFESSIONS[key] : null;
            if (prof) {
                descEl.style.display = '';
                descEl.querySelector('.dg-desc-text').textContent = prof.description;
            } else {
                descEl.style.display = 'none';
            }
        };

        select.addEventListener('change', update);
        update(); // run immediately in case a profession is already selected
    }

    // -----------------------------------------------------------------------
    // Bonus skills step: show/hide custom specialty input per slot
    // -----------------------------------------------------------------------
    #setupBonusSkillsUI() {
        const el = this.element;
        if (!el) return;
        const selects = [...el.querySelectorAll('.dg-bonus-slot-select')];

        const updateRow = (select) => {
            const row = select.closest('.dg-bonus-slot-row');
            const input = row?.querySelector('.dg-bonus-custom-input');
            if (input) input.style.display = select.value.startsWith('_custom_') ? 'inline-block' : 'none';
        };

        // Disable any option that is already chosen in another slot.
        // _custom_* options are exempt — different slots can pick different subspecialties.
        const syncOptions = () => {
            const chosen = new Set(
                selects.map(s => s.value).filter(v => v !== '' && !v.startsWith('_custom_'))
            );
            selects.forEach(sel => {
                sel.querySelectorAll('option').forEach(opt => {
                    if (opt.value === '' || opt.value === sel.value || opt.value.startsWith('_custom_')) {
                        opt.disabled = false;
                    } else {
                        opt.disabled = chosen.has(opt.value);
                    }
                });
            });
        };

        selects.forEach(select => {
            updateRow(select);
            select.addEventListener('change', () => {
                updateRow(select);
                syncOptions();
            });
        });

        syncOptions();
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
            // Enable specialty text inputs only when their checkbox is checked
            el.querySelectorAll('.dg-opt-skill-row').forEach(row => {
                const cb = row.querySelector('input[name="optPick"]');
                const inp = row.querySelector('.dg-opt-spec-input');
                if (cb && inp) inp.disabled = !cb.checked;
            });
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

        // Custom item add
        const customInput = el.querySelector('#dg-eq-custom-input');
        const customAddBtn = el.querySelector('#dg-eq-custom-add');
        if (customInput && customAddBtn) {
            customAddBtn.addEventListener('click', () => {
                const name = customInput.value.trim();
                if (name && !this.#data.equipment.includes(name)) {
                    this.#data.equipment.push(name);
                    customInput.value = '';
                    this.#renderEquipmentLoadout(loadoutEl);
                    this.#renderEquipmentCatalog(catalogEl);
                    this.#updateEquipCountBadge(el);
                }
            });
            customInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); customAddBtn.click(); }
            });
        }

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
            this.#saveState();
            this.render({ force: true });
        }
    }

    static async #onPrevStep(event, target) {
        if (this.#step > 0) {
            this.#collectCurrentStep();
            this.#step--;
            this.#saveState();
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

    static async #onRemoveBond(event, target) {
        const idx = Number(target.dataset.index);
        this.#data.bonds.splice(idx, 1);
        this.render({ force: true });
    }

    static async #onSuggestBond(event, target) {
        // Read the currently selected dataset from the live form before using stored value
        const form = this.element?.querySelector('form.dg-wizard-form');
        if (form) {
            const fd = new foundry.applications.ux.FormDataExtended(form);
            const dataset = (fd.object['bondDataset'] ?? '').toString().trim();
            if (dataset && BONDS[dataset]) this.#data.bondDataset = dataset;
        }
        const pool = BONDS[this.#data.bondDataset] ?? Object.values(BONDS).flat();
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
        await this.render({ force: true });
        // Foundry's DOM diff preserves existing input values, so set them directly after render
        const form = this.element?.querySelector('form.dg-wizard-form');
        if (form) {
            for (const [k, v] of Object.entries(this.#data.biography)) {
                const el = form.querySelector(`[name="biography.${k}"]`);
                if (el) el.value = v ?? '';
            }
        }
    }

    static async #onClearEquipment(event, target) {
        this.#data.equipment = [];
        this.render({ force: true });
    }

    static async #onFillPack(event, target) {
        const form = this.element?.querySelector('form.dg-wizard-form');
        if (!form) return;
        const sel = form.querySelector('#dg-bonus-pack-select');
        if (!sel || sel.value === '') return;
        const idx = parseInt(sel.value);
        const pkg = BONUS_PACKAGES[idx];
        if (!pkg) return;
        const newBoosts = pkg.skills.slice(0, 8);
        while (newBoosts.length < 8) newBoosts.push('');
        this.#data.bonusBoosts = newBoosts;
        this.#data.bonusCustom = ['', '', '', '', '', '', '', ''];
        this.#data.selectedPackIdx = idx;
        this.render({ force: true });
    }

    static async #onLoadLoadout(event, target) {
        const key = target.dataset.loadout;
        const items = LOADOUTS[key] ?? [];
        for (const name of items) {
            if (!this.#data.equipment.includes(name)) this.#data.equipment.push(name);
        }
        const el = this.element;
        if (el) {
            const loadoutEl = el.querySelector('#dg-eq-loadout');
            const catalogEl = el.querySelector('#dg-eq-catalog');
            if (loadoutEl) this.#renderEquipmentLoadout(loadoutEl);
            if (catalogEl) this.#renderEquipmentCatalog(catalogEl);
            this.#updateEquipCountBadge(el);
        }
    }

    static async #onFinish(event, target) {
        if (!this.#collectCurrentStep()) return;
        await this.#applyToActor();
        // Clear saved wizard state now that it's been applied
        await this.#actor.unsetFlag('delta-green-agent-wizard', 'wizardState').catch(() => { });
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
            // Reset skills + specialty slots for the new profession
            this.#data.skills = {};
            this.#data.specialtySlots = [];
            this.#data.optSpecialtyLabels = {};
            let slotId = 0;
            // Required skills: specialty types → specialtySlots; plain skills → skills dict
            for (const s of prof.requiredSkills ?? []) {
                const sp = parseSpecialtyFromName(s.name);
                if (sp) {
                    this.#data.specialtySlots.push({
                        id: slotId++, group: sp.group, label: sp.label,
                        proficiency: s.value, required: true, optIndex: null,
                    });
                } else {
                    const sk = this.#findSkillKey(s.name);
                    this.#data.skills[sk] = Math.max(SKILL_DEFAULTS[sk] ?? 0, s.value);
                }
            }
        }

        if (step === 'skills') {
            const prof = PROFESSIONS[this.#data.professionKey];
            // Read optional picks from checked checkboxes
            const picks = [];
            const checkboxes = this.element?.querySelectorAll('input[name="optPick"]:checked') ?? [];
            for (const cb of checkboxes) {
                const idx = parseInt(cb.value, 10);
                if (!isNaN(idx)) picks.push(idx);
            }
            const optLimit = prof?.optionalSkills?.[0]?.limit ?? 0;
            if (optLimit > 0 && picks.length < optLimit) {
                const remaining = optLimit - picks.length;
                ui.notifications.warn(`Choose ${remaining} more optional skill${remaining > 1 ? 's' : ''} before continuing.`);
                return false;
            }
            this.#data.optionalPicks = picks;

            // Update required specialty slot labels
            for (const slot of this.#data.specialtySlots.filter(sl => sl.required)) {
                slot.label = (raw[`specialty.req.${slot.id}`] ?? slot.label).toString().trim();
            }

            // Block duplicate required specialties within the same group
            {
                const reqByGroup = {};
                for (const slot of this.#data.specialtySlots.filter(sl => sl.required)) {
                    const val = slot.label.toLowerCase();
                    if (!val) continue;
                    (reqByGroup[slot.group] ??= []).push(val);
                }
                for (const [group, vals] of Object.entries(reqByGroup)) {
                    if (new Set(vals).size < vals.length) {
                        const display = Object.entries(SPECIALTY_PREFIXES).find(([, g]) => g === group)?.[0] ?? group;
                        ui.notifications.warn(`Each ${display} specialty must be unique.`);
                        return false;
                    }
                }
            }

            // Re-derive optional picks: specialty → specialty slots; plain → skills dict
            this.#data.specialtySlots = this.#data.specialtySlots.filter(sl => sl.required);
            this.#data.optSpecialtyLabels = {};
            for (const idx of picks) {
                const s = prof.optionalSkills[idx];
                const sp = parseSpecialtyFromName(s.name);
                if (sp) {
                    const label = (raw[`specialty.opt.${idx}`] ?? '').toString().trim();
                    this.#data.optSpecialtyLabels[idx] = label;
                    this.#data.specialtySlots.push({
                        id: `opt_${idx}`, group: sp.group, label,
                        proficiency: s.value, required: false, optIndex: idx,
                    });
                } else {
                    const sk = this.#findSkillKey(s.name);
                    this.#data.skills[sk] = Math.max(this.#data.skills[sk] ?? 0, s.value);
                }
            }
        }

        if (step === 'bonus_skills') {
            const slots = [];
            if (!this.#data.bonusCustom) this.#data.bonusCustom = ['', '', '', '', '', '', '', ''];
            for (let i = 0; i < 8; i++) {
                slots.push((raw[`bonusSlot.${i}`] ?? '').toString());
                this.#data.bonusCustom[i] = (raw[`bonusCustom.${i}`] ?? '').toString().trim();
            }
            this.#data.bonusBoosts = slots;
            return true;
        }

        if (step === 'bonds') {
            this.#data.bondDataset = (raw['bondDataset'] ?? 'FRIENDS_FAMILY').toString().trim();
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

        // Skills — base profession values (plain skills only; specialty handled via specialtySlots)
        for (const [key, value] of Object.entries(this.#data.skills)) {
            if (SKILL_KEY_MAP[key]) {
                updates[`system.skills.${key}.proficiency`] = value;
            }
        }

        // Bonus skill boosts — separate standard keys from custom specialty picks
        const boostCounts = {};
        const customBoostMap = {};  // '{group}__{label}' → {group, label, proficiency}
        for (let i = 0; i < this.#data.bonusBoosts.length; i++) {
            const key = this.#data.bonusBoosts[i];
            if (!key) continue;
            if (key.startsWith('_custom_')) {
                const group = key.slice('_custom_'.length);
                const label = (this.#data.bonusCustom?.[i] ?? '').trim();
                if (!label) continue;
                const mapKey = `${group}__${label}`;
                if (!customBoostMap[mapKey]) customBoostMap[mapKey] = { group, label, proficiency: 0 };
                customBoostMap[mapKey].proficiency = Math.min(80, customBoostMap[mapKey].proficiency + 20);
            } else {
                boostCounts[key] = (boostCounts[key] ?? 0) + 1;
            }
        }
        // Separate standard bonus boosts into plain skills and typed specialty skills
        const bonusTypedMap = {};  // tsKey → {group, label, proficiency}
        for (const [key, boosts] of Object.entries(boostCounts)) {
            if (boosts <= 0) continue;
            if (key.startsWith('profslot__')) {
                // Profession-typed specialty (e.g. Foreign Language (Swahili) from skills step)
                const parts = key.split('__');
                const group = parts[1];
                const label = parts[2];
                const tsKey = ('tskill_wiz_' + group + '_' + label)
                    .toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/_$/g, '');
                if (!bonusTypedMap[tsKey]) bonusTypedMap[tsKey] = { group, label, proficiency: 0 };
                bonusTypedMap[tsKey].proficiency = Math.min(80, bonusTypedMap[tsKey].proficiency + boosts * 20);
            } else if (SKILL_KEY_MAP[key]) {
                const base = this.#data.skills[key] ?? SKILL_DEFAULTS[key] ?? 0;
                updates[`system.skills.${key}.proficiency`] = Math.min(80, base + boosts * 20);
            } else {
                const sp = parseSpecialtyFromKey(key);
                if (sp) {
                    const tsKey = `tskill_wiz_${key}`;
                    bonusTypedMap[tsKey] = { group: sp.group, label: sp.label, proficiency: Math.min(80, boosts * 20) };
                }
            }
        }

        // Build the typed skills object, merging with any already on the actor
        const typedSkillsToWrite = foundry.utils.deepClone(this.#actor.system.typedSkills ?? {});

        // Specialty slots from the profession (required) and optional picks
        for (const slot of this.#data.specialtySlots) {
            const label = slot.label.trim();
            if (!label) continue;  // skip slots where the user left the subspecialty blank
            const tsKey = ('tskill_wiz_' + slot.group + '_' + label)
                .toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/_$/g, '');
            const boost = bonusTypedMap[tsKey];
            typedSkillsToWrite[tsKey] = {
                label: slot.label,
                group: slot.group,
                proficiency: boost ? Math.min(80, slot.proficiency + boost.proficiency) : slot.proficiency,
                failure: false,
            };
            if (boost) delete bonusTypedMap[tsKey];
        }

        // Remaining standard bonus typed skills (bonus-only picks not matching a specialty slot)
        for (const [tsKey, tsData] of Object.entries(bonusTypedMap)) {
            typedSkillsToWrite[tsKey] = { label: tsData.label, group: tsData.group, proficiency: tsData.proficiency, failure: false };
        }

        // Custom specialty picks from bonus slots
        for (const [, { group, label, proficiency }] of Object.entries(customBoostMap)) {
            const tsKey = ('tskill_wiz_c_' + group + '_' + label)
                .toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/_$/g, '');
            typedSkillsToWrite[tsKey] = { label, group, proficiency, failure: false };
        }

        if (Object.keys(typedSkillsToWrite).length > 0) {
            updates['system.typedSkills'] = typedSkillsToWrite;
        }

        // Biography — actor name is top-level; physicalDescription is system.physicalDescription
        const bioName = this.#data.biography.name;
        if (bioName) updates['name'] = bioName;
        for (const [k, v] of Object.entries(this.#data.biography)) {
            if (k === 'name') continue;
            if (k === 'physicalDescription') {
                updates['system.physicalDescription'] = v ? `<p>${v}</p>` : '';
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

        // Equipment — create as Items on the actor (catalog items get full data; custom names get generic gear)
        if (this.#data.equipment.length > 0) {
            const eqItems = this.#data.equipment
                .filter(name => name && name.trim())
                .map(name => {
                    const catalogItem = EQUIPMENT_CATALOG.find(i => i.name === name);
                    if (catalogItem) return catalogItem;
                    return {
                        name, type: 'gear', img: 'icons/svg/item-bag.svg', flags: {}, effects: [],
                        system: { name: '', description: '', equipped: true, expense: '' }
                    };
                });
            if (eqItems.length > 0) {
                await this.#actor.createEmbeddedDocuments('Item', eqItems);
            }
        }
    }
}
