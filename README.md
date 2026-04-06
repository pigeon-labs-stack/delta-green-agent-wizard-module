# Delta Green Character Creation Wizard — Foundry VTT Module

A step-by-step character creation wizard for the **Delta Green** RPG system in Foundry VTT.

## Requirements

- Foundry VTT v13+
- [Delta Green system](https://github.com/deltagreen-foundryvtt/delta-green-foundry-vtt-system) installed and active

## Installation

1. Copy the `delta-green-chargen` folder into your Foundry `Data/modules/` directory.
2. Launch Foundry and enable the module in your world's Module Management screen.

## Usage

Open any **Agent** actor sheet. A **Chargen** button appears in the sheet header. Click it to launch the six-step wizard:

1. **Statistics** — Set STR / CON / DEX / INT / POW / CHA (roll or type manually)
2. **Profession** — Choose from all official professions; description and bonds limit displayed
3. **Skills** — Required profession skills pre-filled; select optional picks
4. **Bonds** — Add bonds up to the profession's allowed maximum; suggest random bonds from the bonds pool
5. **Biography** — Profession title, employer, nationality, sex, age, education
6. **Review** — Confirm all data, then apply to the actor sheet

## Development

File layout:

```
delta-green-chargen/
  module.json
  scripts/
    main.js         ← Foundry hooks, header button injection
    wizard.js       ← ApplicationV2 wizard class
    professions.js  ← profession data (exported from website source)
    bonds.js        ← bond pool data (exported from website source)
  templates/
    wizard.hbs      ← Handlebars template for all wizard steps
  styles/
    module.css      ← Dark-themed UI matching the DG system aesthetic
```

## License

Released under [MIT](LICENSE).
