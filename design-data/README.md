# Design data

The JSON files here come from **UI UX Pro Max** (https://github.com/nextlevelbuilder/ui-ux-pro-max-skill),
© 2024 Next Level Builder, MIT licence (see `LICENSE-ui-ux-pro-max.txt`; keep that file with the data).

They are generated, not hand-edited: `node tools/import-design-data.js <path to the skill's data folder>`.
The app reads them through `designdata.js`; nothing needs Python.

| File | What it holds |
| --- | --- |
| `product-types.json` | 192 kinds of business/product: recommended styles, landing pattern, colour palette, effects, rules and "avoid" list |
| `styles.json` | 88 visual styles: what each is best and worst for, effects, light/dark support |
| `typography.json` | 74 font pairings with moods and Google Fonts links |
| `landing.json` | 34 landing-page patterns (section order, call-to-action placement) |
| `guidelines.json` | 109 web UX rules with a "do" and a "don't" and a severity |
