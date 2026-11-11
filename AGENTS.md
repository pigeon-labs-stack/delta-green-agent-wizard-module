# AGENTS.md — Delta Green Character Creation Wizard (Foundry VTT module)

## What this is
Step-by-step character creation wizard for the Delta Green RPG (Foundry VTT, system `deltagreen`, Foundry V13). A direct port of the DELTA-GREEN-STATS web app: same profession data, skill rules, optional-pick logic, bond pool, and PDF field mappings. Only the presentation layer differs.

## Hard rules
- **No build step, no npm.** Plain JS + Handlebars + CSS, loaded via `module.json` (`esmodules: scripts/main.js`). Never add a package.json/bundler to this repo.
- **Data parity with DELTA-GREEN-STATS is the contract.** `professions.js`, `bonds.js`, skill rules, and optional-pick limits must stay byte-equivalent in meaning with the source app. Change data in both repos together, or state explicitly that this repo diverges and why.
- **PDF mappings target the real form.** `pdf-export.js` fills the official DD Form 315 (`assets/Delta-Green-RPG-Character-Sheet.pdf`). Verify field names against the template; never invent field names.
- Bump `version` in `module.json` with every user-visible change; `download` URL must match the tag.

## Layout
- `scripts/main.js` — Foundry hooks, sheet-bar button injection, actor PDF export (the only esmodule entry)
- `scripts/wizard.js` — ApplicationV2 step wizard class
- `scripts/constants.js` / `professions.js` / `bonds.js` / `equipment.js` / `bio-data.js` — data + generator
- `scripts/pdf-export.js` — DD Form 315 field mapper (pdf-lib; vendored at `scripts/vendor/pdf-lib.min.js`, CDN fallback)
- `templates/wizard.hbs`, `styles/module.css` (dark DG aesthetic)

## Verify changes by
1. `node --check scripts/<changed>.js` on every changed JS file.
2. Manifest sanity: `python3 -c "import json;json.load(open('module.json'))"`.
3. Logic changes: port the affected function to a scratch Node script and exercise it — there is no test runner here; keep it lightweight, one focused check per behavior.

## Commit style
Small diffs, one concern each. Commit identity: `-c user.name='pigeon-labs-stack' -c user.email='pigeon-labs-stack@users.noreply.github.com'`.
