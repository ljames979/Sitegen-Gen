// Menu bar styles (Leo, 2026-11-02, after looking at a gallery of website menus; our own designs): one pick in the
// editor's "Buttons, spacing and header" changes how the top menu bar looks and works. The site's own name or logo,
// page links and call button stay the same in every style. The CSS is in public/sg-site.css (body.mnu-<id>), the
// markup bits (menu button, the panel for the overlay and drawer, the split order) in views/public-site.ejs, and the
// open and close behavior in public-site.ejs's own script.
const STYLES = [
  ['', 'Classic: name on the left, links on the right'],
  ['pill', 'Soft pills: the page you are on sits in a rounded pill'],
  ['underline', 'Underline: a line in your brand color slides under each link'],
  ['band', 'Brand bar: the whole bar in your brand color, white words'],
  ['tworow', 'Two rows: name on top, links in a colored bar underneath'],
  ['split', 'Split: name in the middle, links on both sides'],
  ['floating', 'Floating: a rounded bar that floats a little below the top'],
  ['overlay', 'Full-screen menu: a menu button opens big links over the whole page'],
  ['drawer', 'Side drawer: a menu button slides the links in from the right']
];
const IDS = STYLES.map(s => s[0]);
const clean = (v) => (IDS.includes(v) ? v : '');
// styles that hide the links behind a menu button (on every screen size)
const PANEL = ['overlay', 'drawer'];
const usesPanel = (v) => PANEL.includes(clean(v));
const bodyClass = (v) => (clean(v) ? ' mnu-' + clean(v) : '');
// Split style: the first half of the links sits left of the name, the rest on the right
const splitOrder = (i, n) => (i < Math.ceil(n / 2) ? 1 : 3);

module.exports = { STYLES, IDS, clean, usesPanel, bodyClass, splitOrder };
